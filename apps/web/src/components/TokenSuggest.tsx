import { useCallback, useMemo, useState } from 'react';

/**
 * Completion for the composer's `!Artefact` and `+Value` lines.
 *
 * The pool is *this card's own history* — every artefact and value already logged
 * against it. A card names the same deliverable over and over as it moves along, and
 * retyping it exactly is what makes the roll-ups fall apart: "Local WBS (AI)" and
 * "Local WBS(AI)" are two different artefacts to everything downstream.
 *
 * The list only opens on a line that already starts with `!` or `+`, so it never
 * intrudes on ordinary prose.
 */

interface Line {
  /** Whole-line bounds within the note, so accepting can rewrite just this line. */
  start: number;
  end: number;
  /** Leading whitespace, preserved on accept. */
  indent: string;
  marker: '!' | '+';
  /** What has been typed after the marker, up to the caret. */
  query: string;
}

export interface TokenSuggest {
  matches: string[];
  /** Which pool the open list is drawing from, for its row labels. */
  kind: 'Artefact' | 'Value';
  active: number;
  setActive: (index: number) => void;
  /** Recompute from the caret. Wire to the textarea's onChange and onSelect. */
  refresh: (field: HTMLTextAreaElement) => void;
  /** True when the list consumed the key and the caller should stop. */
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  accept: (match: string) => void;
  close: () => void;
}

export function useTokenSuggest({
  value,
  onChange,
  artefacts,
  values,
  fieldRef,
}: {
  value: string;
  onChange: (next: string) => void;
  artefacts: string[];
  values: string[];
  fieldRef: React.RefObject<HTMLTextAreaElement | null>;
}): TokenSuggest {
  const [caret, setCaret] = useState(0);
  // Esc dismisses the list without dismissing the line; the next keystroke reopens it.
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);

  const line = useMemo(() => currentTokenLine(value, caret), [value, caret]);

  const matches = useMemo(() => {
    if (!line || dismissed) return [];
    const pool = line.marker === '!' ? artefacts : values;
    const query = line.query.trim().toLowerCase();
    // Whatever is already written on the note's *other* lines is not worth offering.
    const taken = new Set(
      otherTokenLines(value, line).map((t) => t.toLowerCase()),
    );
    const hits = pool.filter(
      (name) =>
        !taken.has(name.toLowerCase()) &&
        name.toLowerCase() !== query &&
        (!query || name.toLowerCase().includes(query)),
    );
    // Prefixes first: they are what the typing was aiming at.
    return hits
      .sort((a, b) => {
        const rank = (n: string) => (query && n.toLowerCase().startsWith(query) ? 0 : 1);
        return rank(a) - rank(b) || a.localeCompare(b);
      })
      .slice(0, 6);
  }, [line, dismissed, artefacts, values, value]);

  const clampedActive = matches.length ? Math.min(active, matches.length - 1) : 0;

  const refresh = useCallback((field: HTMLTextAreaElement) => {
    setCaret(field.selectionStart ?? 0);
    setDismissed(false);
    setActive(0);
  }, []);

  const accept = useCallback(
    (match: string) => {
      if (!line) return;
      const next = `${value.slice(0, line.start)}${line.indent}${line.marker}${match}${value.slice(line.end)}`;
      const at = line.start + line.indent.length + 1 + match.length;
      const field = fieldRef.current;
      if (field) {
        // Same trick as the markdown shortcut: write through so the caret placement
        // survives React's re-render with an identical value.
        field.value = next;
        field.setSelectionRange(at, at);
      }
      setCaret(at);
      setDismissed(true);
      onChange(next);
    },
    [line, value, onChange, fieldRef],
  );

  const close = useCallback(() => setDismissed(true), []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!matches.length) return false;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((i) => (i + 1) % matches.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((i) => (i - 1 + matches.length) % matches.length);
        return true;
      }
      // Enter and Tab both accept: Enter because the line is finished, Tab because
      // this is a completion. ⌘Enter is the submit and is left to the caller.
      if ((event.key === 'Enter' && !event.metaKey && !event.ctrlKey) || event.key === 'Tab') {
        event.preventDefault();
        accept(matches[clampedActive]!);
        return true;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(true);
        return true;
      }
      return false;
    },
    [matches, clampedActive, accept],
  );

  return {
    matches,
    kind: line?.marker === '+' ? 'Value' : 'Artefact',
    active: clampedActive,
    setActive,
    refresh,
    handleKeyDown,
    accept,
    close,
  };
}

/** The `!`/`+` line the caret sits on, or null if it is anywhere else. */
function currentTokenLine(value: string, caret: number): Line | null {
  const start = value.lastIndexOf('\n', caret - 1) + 1;
  const newline = value.indexOf('\n', caret);
  const end = newline < 0 ? value.length : newline;
  const parsed = /^([ \t]*)([!+])/.exec(value.slice(start, end));
  if (!parsed) return null;

  const markerAt = start + parsed[1]!.length;
  // Behind the marker the caret is in the indent, not in the token.
  if (caret <= markerAt) return null;
  return {
    start,
    end,
    indent: parsed[1]!,
    marker: parsed[2] as '!' | '+',
    query: value.slice(markerAt + 1, caret),
  };
}

/** The same-marker tokens written on the note's other lines. */
function otherTokenLines(value: string, line: Line): string[] {
  const out: string[] = [];
  let at = 0;
  for (const text of value.split('\n')) {
    const lineStart = at;
    at += text.length + 1;
    if (lineStart === line.start) continue;
    const trimmed = text.trim();
    if (trimmed.startsWith(line.marker)) out.push(trimmed.slice(1).trim());
  }
  return out;
}

export function TokenSuggestList({ suggest }: { suggest: TokenSuggest }) {
  if (!suggest.matches.length) return null;
  return (
    <ul className="suggest" role="listbox" aria-label={`${suggest.kind} suggestions`}>
      {suggest.matches.map((match, i) => (
        <li key={match}>
          <button
            type="button"
            className="suggest__item"
            role="option"
            aria-selected={i === suggest.active}
            data-active={i === suggest.active || undefined}
            onMouseEnter={() => suggest.setActive(i)}
            // The textarea must not blur before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => suggest.accept(match)}
          >
            <span className="suggest__kind">{suggest.kind}</span>
            {match}
          </button>
        </li>
      ))}
    </ul>
  );
}
