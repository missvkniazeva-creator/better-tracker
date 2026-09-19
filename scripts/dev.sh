#!/usr/bin/env bash
#
# Idempotent dev launcher.
#
#   scripts/dev.sh [start|stop|restart|status|logs]
#
# Running `start` twice does not start two of anything. It converges on one state:
# the API and Vite both up, both answering, and the API serving the database you
# asked for.
#
# That last clause is why this script exists. `npm run dev` leaves its `node --watch`
# supervisor behind when a terminal goes away, and the orphan keeps port 8787 while
# answering from whatever database *it* was started with. A later `npm run dev` then
# loses the port silently, the browser talks to the orphan, and the board shows
# somebody else's data — indistinguishable from data loss until you check `lsof`.
# So: verify what is listening, not just that something is.
#
# Honours BT_DB_PATH, so a throwaway copy can be served without touching data/.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Pinned, not configurable: apps/web/vite.config.ts proxies /api to 127.0.0.1:8787,
# so moving the API without moving the proxy would only break the app quietly.
API_PORT=8787
WEB_PORT=5173

RUN_DIR="$REPO/.dev"
API_LOG="$RUN_DIR/api.log"
WEB_LOG="$RUN_DIR/web.log"
API_PIDFILE="$RUN_DIR/api.pid"
WEB_PIDFILE="$RUN_DIR/web.pid"

# The same default the API resolves internally (apps/api/src/db/index.ts).
WANT_DB="${BT_DB_PATH:-$REPO/data/better-tracker.db}"

say()  { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die()  { warn "error: $*"; exit 1; }

command -v lsof >/dev/null || die "lsof is required (it is how we tell which process owns a port)"

# ---------------------------------------------------------------- inspection

# `|| true` throughout: lsof exits non-zero when it finds nothing, and under
# `set -o pipefail` that would take the whole script down on a perfectly normal
# "nothing is listening yet".
listener_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }

# The .db file a running process has open. Empty when it has none yet.
open_db() {
  [ -n "${1:-}" ] || return 0
  lsof -p "$1" -Fn 2>/dev/null | sed -n 's/^n\(.*\.db\)$/\1/p' | head -1 || true
}

api_ok()  { curl -fsS -m 5 "http://127.0.0.1:$API_PORT/api/board" -o /dev/null 2>/dev/null; }
web_ok()  { curl -fsS -m 5 "http://127.0.0.1:$WEB_PORT/" -o /dev/null 2>/dev/null; }

# True when the API on the port is serving the database we want. An in-memory
# database has no file to compare, so it is taken on trust.
api_db_ok() {
  local pid="$1" actual
  [ "$WANT_DB" = ":memory:" ] && return 0
  actual="$(open_db "$pid")"
  [ -z "$actual" ] && return 0          # nothing open yet; the health check covers it
  [ "$actual" = "$WANT_DB" ]
}

# ------------------------------------------------------------------ stopping

# Wait for a port to go quiet, then stop being polite about it.
kill_port() {
  local port="$1" pid i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    pid="$(listener_pid "$port")"
    [ -z "$pid" ] && return 0
    if [ "$i" -le 6 ]; then kill "$pid" 2>/dev/null || true; else kill -9 "$pid" 2>/dev/null || true; fi
    sleep 0.4
  done
  [ -z "$(listener_pid "$port")" ]
}

# Every node process of ours whose working directory is inside this repo.
#
# Matched by cwd rather than by command line alone: `vite` and `src/index.ts` are
# common enough that a bare pkill would reach into somebody else's checkout.
repo_pids() {
  local pid cwd
  for pid in $(pgrep -f 'src/index\.ts|[/]bin/vite' 2>/dev/null || true); do
    cwd="$(lsof -a -d cwd -Fn -p "$pid" 2>/dev/null | sed -n 's/^n//p' | head -1)"
    case "$cwd" in "$REPO"|"$REPO"/*) printf '%s\n' "$pid" ;; esac
  done
}

# Kill our leftovers, keeping whatever is currently healthy. `node --watch` respawns
# its child, so the supervisor has to go first or it simply puts the squatter back.
reap() {
  local keep="${1:-}" pid parent killed=0
  for pid in $(repo_pids); do
    case " $keep " in *" $pid "*) continue ;; esac
    parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    case " $keep " in *" $parent "*) continue ;; esac
    kill "$pid" 2>/dev/null && killed=$((killed + 1)) || true
  done
  [ "$killed" -gt 0 ] && say "reaped $killed orphaned process(es) from a previous session"
  return 0
}

# The pids that make up a running service: the listener and its supervisor.
family() {
  local pid="$1" parent
  [ -z "$pid" ] && return 0
  printf '%s ' "$pid"
  parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
  [ -n "$parent" ] && [ "$parent" != "1" ] && printf '%s ' "$parent"
}

stop_api() {
  # Supervisor before child, or --watch just starts another one.
  [ -f "$API_PIDFILE" ] && { kill "$(cat "$API_PIDFILE")" 2>/dev/null || true; rm -f "$API_PIDFILE"; }
  kill_port "$API_PORT" || die "could not free port $API_PORT"
}

stop_web() {
  [ -f "$WEB_PIDFILE" ] && { kill "$(cat "$WEB_PIDFILE")" 2>/dev/null || true; rm -f "$WEB_PIDFILE"; }
  kill_port "$WEB_PORT" || die "could not free port $WEB_PORT"
}

# ------------------------------------------------------------------ starting

wait_for() {
  local check="$1" label="$2" i
  for i in $(seq 1 60); do
    "$check" && return 0
    sleep 0.5
  done
  warn "$label did not come up within 30s — last log lines:"
  tail -20 "$3" >&2 2>/dev/null || true
  return 1
}

ensure_api() {
  local pid; pid="$(listener_pid "$API_PORT")"

  if [ -n "$pid" ]; then
    if api_ok && api_db_ok "$pid"; then
      say "api    already running   pid $pid  ·  $(open_db "$pid")"
      return 0
    fi
    if api_ok; then
      say "api    replacing pid $pid — it is serving $(open_db "$pid"), not $WANT_DB"
    else
      say "api    replacing pid $pid — port held but not answering"
    fi
    stop_api
  fi

  # The redirections belong to the *subshell*, not to the command inside it.
  # Backgrounding a `cd && cmd` list leaves a subshell that lives as long as the
  # server does, and it keeps the caller's stdout open — so `dev.sh start | tee`
  # would hang forever with all the work already finished. `exec` then replaces the
  # subshell with the server, which also makes $! the pid we actually want to record.
  (
    cd "$REPO/apps/api" || exit 1
    export BT_DB_PATH="$WANT_DB"
    exec nohup node --watch src/index.ts
  ) </dev/null >"$API_LOG" 2>&1 &
  echo $! >"$API_PIDFILE"
  wait_for api_ok "api" "$API_LOG" || return 1

  pid="$(listener_pid "$API_PORT")"
  api_db_ok "$pid" || die "api came up on the wrong database ($(open_db "$pid")); expected $WANT_DB"
  say "api    started            pid $pid  ·  $WANT_DB"
}

ensure_web() {
  local pid; pid="$(listener_pid "$WEB_PORT")"

  if [ -n "$pid" ] && web_ok; then
    say "web    already running   pid $pid"
    return 0
  fi
  [ -n "$pid" ] && { say "web    replacing pid $pid — port held but not answering"; stop_web; }

  (
    cd "$REPO/apps/web" || exit 1
    exec nohup npm run dev
  ) </dev/null >"$WEB_LOG" 2>&1 &
  echo $! >"$WEB_PIDFILE"
  wait_for web_ok "web" "$WEB_LOG" || return 1
  say "web    started            pid $(listener_pid "$WEB_PORT")"
}

# -------------------------------------------------------------------- status

status() {
  local api web
  api="$(listener_pid "$API_PORT")"; web="$(listener_pid "$WEB_PORT")"

  if [ -n "$api" ]; then
    say "api    :$API_PORT  pid $api  $(api_ok && echo healthy || echo 'NOT ANSWERING')"
    say "       database  $(open_db "$api" | grep . || echo '(none open)')"
    api_db_ok "$api" || warn "       ^ not the database you asked for ($WANT_DB)"
  else
    say "api    :$API_PORT  stopped"
  fi

  if [ -n "$web" ]; then
    say "web    :$WEB_PORT  pid $web  $(web_ok && echo healthy || echo 'NOT ANSWERING')"
  else
    say "web    :$WEB_PORT  stopped"
  fi

  local strays; strays="$(reap_count)"
  [ "$strays" -gt 0 ] && say "       $strays stray process(es) — 'scripts/dev.sh start' will clear them"
  return 0
}

reap_count() {
  local keep pid parent n=0
  keep="$(family "$(listener_pid "$API_PORT")")$(family "$(listener_pid "$WEB_PORT")")"
  for pid in $(repo_pids); do
    case " $keep " in *" $pid "*) continue ;; esac
    parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    case " $keep " in *" $parent "*) continue ;; esac
    n=$((n + 1))
  done
  printf '%s' "$n"
}

# ---------------------------------------------------------------------- main

mkdir -p "$RUN_DIR"

case "${1:-start}" in
  start)
    ensure_api
    ensure_web
    # Only now, with both owners known, is it safe to clear everything else.
    reap "$(family "$(listener_pid "$API_PORT")")$(family "$(listener_pid "$WEB_PORT")")"
    say ""
    say "open http://localhost:$WEB_PORT   ·   logs: $RUN_DIR/{api,web}.log"
    ;;
  stop)
    stop_web
    stop_api
    reap ""
    say "stopped"
    ;;
  restart) "$0" stop; "$0" start ;;
  status)  status ;;
  logs)    tail -n 40 -F "$API_LOG" "$WEB_LOG" ;;
  *) die "usage: scripts/dev.sh [start|stop|restart|status|logs]" ;;
esac
