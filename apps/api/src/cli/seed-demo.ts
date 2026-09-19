/**
 * Loads the design prototype's demo content into an empty board, so every screen
 * (objectives tree, outcome bars, log roll-ups, obstacle cards) has something to
 * render. Refuses to run if the board already has tasks.
 */
import { getDb, closeDb, newId, tx } from '../db/index.ts';
import { bootstrap } from '../db/bootstrap.ts';
import { createLogEntry } from '../repo/log.ts';
import { createLane } from '../repo/lanes.ts';
import type { LaneColor, Priority, Severity } from '../../../../shared/types.ts';

const d = getDb();
bootstrap(d);

const { n } = d.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number };
if (n > 0) {
  console.error(`board already has ${n} tasks — run "npm run db:reset" first`);
  process.exit(1);
}

interface Seed {
  lane: string | null;
  col: string | null;
  title: string;
  prio?: Priority;
  sev?: Severity;
  labels?: string[];
  objectives?: string[];
  outcomes?: string[];
  dateline?: string;
  desc?: string;
  obstacles?: string;
  x?: number;
  y?: number;
  log?: { date: string; type: 'Focus' | 'Meeting' | 'Call' | 'Multitasking'; note: string; outcomes?: string[] }[];
}

const OBJECTIVES: { name: string; parent: string; measure: string }[] = [
  { name: 'FDE proficiency', parent: '', measure: 'Lead two client engagements end to end by Q2 2027 with sponsor NPS ≥ 8.' },
  { name: 'RAG pilot', parent: 'FDE proficiency', measure: 'Client RAG pilot live for 40 finance users by Sep 30; p50 latency under 1s.' },
  { name: 'SP connector', parent: 'RAG pilot', measure: 'Delta sync of 3 SharePoint sites without manual intervention by Sep 5.' },
  { name: 'Demos', parent: 'RAG pilot', measure: 'Finance, Legal, and IT demos delivered, each with a follow-up decision logged.' },
  { name: 'SA3 maturity', parent: '', measure: 'Reusable evaluation and integration playbook adopted by two teams.' },
  { name: 'Eval harness', parent: 'SA3 maturity', measure: 'Runner plus 100 golden cases, used on one client project by Sep 30.' },
  { name: 'Golden set', parent: 'Eval harness', measure: '50 reviewed cases; the CLI runner executes them in under 5 minutes.' },
  { name: 'Playbook', parent: 'SA3 maturity', measure: 'Three chapters reviewed by the architecture guild by Sep 30.' },
];

// Outcomes carry no objective links of their own. Each one reaches its objectives
// through the cards below that name both, which is what the panels read back.
const OUTCOMES: { name: string; desc: string; date: string }[] = [
  { name: 'SP connector handover', desc: 'Delta-query connector for 3 client sites, handed to client IT.', date: '2026-09-05' },
  { name: 'Latency 2.1s → 0.8s', desc: 'Embedding cache and chunking changes on the client retrieval path — 62% reduction.', date: '2026-08-28' },
  { name: 'Golden set v0.1', desc: '50-case evaluation asset, reusable across internal RAG projects.', date: '2026-09-04' },
  { name: 'Security review passed', desc: 'Sections 4–7 accepted without follow-up findings.', date: '2026-08-26' },
];

const TASKS: Seed[] = [
  { lane: null, col: null, title: 'Ask for read access to SharePoint audit logs', objectives: ['SP connector'], x: 16, y: 14, desc: 'Needed to verify delta-query coverage against real change history.' },
  { lane: null, col: null, title: 'Nightly eval run on golden set', labels: ['eval'], prio: 'P3', x: 16, y: 132, desc: 'Idea from Tuesday review. Needs the runner first.' },
  { lane: null, col: null, title: 'Legal wants PII redaction demo before pilot', labels: ['ai', 'security'], sev: 'High', obstacles: 'Legal contact not yet assigned on the client side.', x: 16, y: 250 },
  { lane: 'Client', col: 'Pending', title: 'Draft incremental sync design for SharePoint connector', labels: ['infra'], prio: 'P1', objectives: ['SP connector'], dateline: '2026-09-03', desc: 'Cover **token storage**, failure modes, and backfill.\n\n- Delta vs full crawl\n- Retry and 429 policy' },
  { lane: 'Client', col: 'Pending', title: 'Prepare demo script for finance stakeholders', labels: ['docs'], objectives: ['Demos'], dateline: '2026-09-04' },
  { lane: 'Client', col: 'In Action', title: 'Implement SharePoint delta-query ingestion', labels: ['infra', 'ai'], prio: 'P1', sev: 'High', objectives: ['SP connector', 'RAG pilot'], outcomes: ['SP connector handover'], dateline: '2026-09-05', desc: 'Replace the full crawl with Graph delta queries; persist delta tokens per site.', obstacles: 'Graph API returns 429 after ~2,000 items; backoff policy under review with client IT.', log: [ { date: '2026-09-01', type: 'Focus', note: 'Delta token persistence plus a retry wrapper.\n!PR #142', outcomes: ['SP connector handover'] }, { date: '2026-09-02', type: 'Call', note: 'Throttling limits with client IT. @R.Okafor\n+10 req/s ceiling agreed', outcomes: ['SP connector handover'] } ] },
  { lane: 'Client', col: 'In Action', title: 'Tune retrieval chunking for 10-K style documents', labels: ['ai', 'eval'], objectives: ['RAG pilot'], outcomes: ['Latency 2.1s → 0.8s'], log: [{ date: '2026-08-29', type: 'Focus', note: 'Section-aware chunking experiment.\n!Notebook chunking-v3\n+Recall@5 0.71 to 0.84', outcomes: ['Latency 2.1s → 0.8s'] }] },
  { lane: 'Client', col: 'Staged', title: 'Cache embeddings for repeat queries', labels: ['infra'], prio: 'P1', objectives: ['RAG pilot'], outcomes: ['Latency 2.1s → 0.8s'], log: [{ date: '2026-08-27', type: 'Focus', note: 'Redis cache layer with eviction policy.\n!PR #131\n+p50 latency 2.1s to 0.8s', outcomes: ['Latency 2.1s → 0.8s'] }] },
  { lane: 'Client', col: 'Staged', title: 'Security questionnaire sections 4–7', labels: ['docs', 'security'], outcomes: ['Security review passed'], log: [{ date: '2026-08-25', type: 'Meeting', note: 'Walkthrough with client security. @M.Lindqvist @A.Shah\n!Questionnaire v2', outcomes: ['Security review passed'] }] },
  { lane: 'Internal', col: 'Pending', title: 'Define eval metrics: faithfulness, groundedness', labels: ['eval'], objectives: ['Golden set'] },
  { lane: 'Internal', col: 'Pending', title: 'Outline SA3 playbook chapter: integration patterns', labels: ['docs'], prio: 'P3', objectives: ['Playbook'] },
  { lane: 'Internal', col: 'In Action', title: 'Build eval harness runner (CLI)', labels: ['eval', 'infra'], prio: 'P1', objectives: ['Golden set', 'Eval harness'], outcomes: ['Golden set v0.1'], dateline: '2026-09-04', log: [{ date: '2026-09-01', type: 'Focus', note: 'Runner skeleton and YAML case format.\n!eval-runner v0.1', outcomes: ['Golden set v0.1'] }] },
  { lane: 'Internal', col: 'In Action', title: 'Collect 50 golden-set Q/A pairs', labels: ['eval'], sev: 'Medium', objectives: ['Golden set'], outcomes: ['Golden set v0.1'], obstacles: 'Waiting on SME availability for the 20 remaining pairs.', log: [{ date: '2026-08-31', type: 'Meeting', note: 'Case review with the domain SME. @J.Park\n+30 cases approved', outcomes: ['Golden set v0.1'] }] },
  { lane: 'Internal', col: 'Staged', title: 'Eval harness repo scaffold and test script', labels: ['eval'], objectives: ['Golden set'] },
  { lane: 'Continuous', col: 'Now', title: 'Daily client standup 09:15', prio: 'P3', log: [ { date: '2026-09-02', type: 'Meeting', note: 'Standup.' }, { date: '2026-09-01', type: 'Meeting', note: 'Standup.' } ] },
  { lane: 'Continuous', col: 'Now', title: 'Weekly status note to sponsor', labels: ['docs'], dateline: '2026-09-05' },
  { lane: 'Continuous', col: 'Soon', title: 'Refresh FDE learning log', prio: 'P3', objectives: ['FDE proficiency'] },
  { lane: 'Continuous', col: 'Later', title: 'Reading backlog: retrieval evaluation papers', labels: ['ai'], prio: 'P3', objectives: ['FDE proficiency'] },
];

// The demo content needs its own project lanes; bootstrap only makes Continuous.
for (const spec of [
  { name: 'Client — Northwind Energy', color: 'lane1' },
  { name: 'Internal — AI projects', color: 'lane2' },
]) {
  const existing = d.prepare('SELECT id FROM lanes WHERE name = ?').get(spec.name);
  if (existing) continue;
  createLane(d, { name: spec.name, color: spec.color as LaneColor });
}

const laneRows = d.prepare('SELECT id, name FROM lanes').all() as { id: string; name: string }[];
const colRows = d.prepare('SELECT id, lane_id, name FROM columns').all() as {
  id: string;
  lane_id: string;
  name: string;
}[];
const labelRows = d.prepare('SELECT id, name FROM labels').all() as { id: string; name: string }[];

const laneByPrefix = (prefix: string) => laneRows.find((l) => l.name.startsWith(prefix));
const labelId = new Map(labelRows.map((l) => [l.name, l.id]));

const objectiveId = new Map<string, string>();
const outcomeId = new Map<string, string>();
const entriesToWrite: { taskId: string; seed: NonNullable<Seed['log']>[number] }[] = [];

tx(d, () => {
  const insObj = d.prepare(
    'INSERT INTO objectives (id, parent_id, name, measure, year, position) VALUES (?, ?, ?, ?, ?, ?)',
  );
  OBJECTIVES.forEach((o, i) => {
    const id = newId('obj');
    objectiveId.set(o.name, id);
    insObj.run(id, o.parent ? objectiveId.get(o.parent)! : null, o.name, o.measure, 2026, (i + 1) * 1000);
  });

  const insOut = d.prepare(
    'INSERT INTO outcomes (id, name, description, date, position) VALUES (?, ?, ?, ?, ?)',
  );
  OUTCOMES.forEach((o, i) => {
    const id = newId('out');
    outcomeId.set(o.name, id);
    insOut.run(id, o.name, o.desc, o.date, (i + 1) * 1000);
  });

  const insTask = d.prepare(
    'INSERT INTO tasks (id, lane_id, column_id, title, description, obstacles, priority, severity, dateline, x, y, position) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const link = (table: string, column: string) =>
    d.prepare(`INSERT OR IGNORE INTO ${table} (task_id, ${column}) VALUES (?, ?)`);
  const linkLabel = link('task_labels', 'label_id');
  const linkObj = link('task_objectives', 'objective_id');
  const linkOut = link('task_outcomes', 'outcome_id');

  TASKS.forEach((t, i) => {
    const lane = t.lane ? laneByPrefix(t.lane) : undefined;
    const col = lane && t.col ? colRows.find((c) => c.lane_id === lane.id && c.name === t.col) : undefined;
    const id = newId('task');
    insTask.run(
      id, lane?.id ?? null, col?.id ?? null, t.title, t.desc ?? '', t.obstacles ?? '',
      t.prio ?? 'P2', t.sev ?? 'Low', t.dateline ?? '', t.x ?? 0, t.y ?? 0, (i + 1) * 1000,
    );
    for (const name of t.labels ?? []) {
      const lid = labelId.get(name);
      if (lid) linkLabel.run(id, lid);
    }
    for (const name of t.objectives ?? []) linkObj.run(id, objectiveId.get(name)!);
    for (const name of t.outcomes ?? []) linkOut.run(id, outcomeId.get(name)!);
    for (const entry of t.log ?? []) entriesToWrite.push({ taskId: id, seed: entry });
  });
});

// createLogEntry opens its own transaction, so log entries are written after the
// bulk insert closes rather than nested inside it.
for (const { taskId, seed } of entriesToWrite) {
  createLogEntry(d, taskId, {
    date: seed.date,
    type: seed.type,
    note: seed.note,
    outcomeIds: (seed.outcomes ?? []).map((name) => outcomeId.get(name)!),
  });
}

console.log(
  `seeded: ${TASKS.length} tasks, ${OBJECTIVES.length} objectives, ` +
    `${OUTCOMES.length} outcomes, ${entriesToWrite.length} log entries`,
);
closeDb();
