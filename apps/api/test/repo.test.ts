import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/db/index.ts';
import { bootstrap } from '../src/db/bootstrap.ts';
import { readBoard } from '../src/repo/board.ts';
import { createLane, deleteLane } from '../src/repo/lanes.ts';
import { copyTask, createTask, moveTask } from '../src/repo/tasks.ts';
import { archiveObjective, createObjective, updateObjective } from '../src/repo/objectives.ts';
import { createOutcome, updateOutcome } from '../src/repo/outcomes.ts';
import { createLabel, updateLabel } from '../src/repo/labels.ts';
import { createLogEntry } from '../src/repo/log.ts';
import { parseNote } from '../../../shared/parse.ts';

// The npm script sets BT_DB_PATH=:memory:. Assert it rather than trusting it -- these
// tests create and delete lanes, and running them against the real board would eat it.
if (process.env.BT_DB_PATH !== ':memory:') {
  throw new Error('refusing to run: BT_DB_PATH must be :memory: (run via `npm test`)');
}

const d = getDb();
before(() => bootstrap(d));

describe('note parsing', () => {
  test('lifts !artefact and +value lines out, keeps the rest as the note', () => {
    const parsed = parseNote(
      ['Throttling limits with client IT.', '!Design note', '+10 req/s ceiling agreed'].join('\n'),
    );
    assert.equal(parsed.note, 'Throttling limits with client IT.');
    assert.deepEqual(parsed.artefacts, ['Design note']);
    assert.deepEqual(parsed.values, ['10 req/s ceiling agreed']);
  });

  test('@mentions are collected but left in the note', () => {
    // Removing them would leave "Reviewed with", which says nothing.
    const parsed = parseNote('Reviewed with @J.Park and @R.Okafor');
    assert.deepEqual(parsed.people, ['J.Park', 'R.Okafor']);
    assert.equal(parsed.note, 'Reviewed with @J.Park and @R.Okafor');
  });

  test('a sigil mid-line is ordinary text, not a token', () => {
    const parsed = parseNote('Latency fell 2.1s -> 0.8s (a 62% win!)');
    assert.deepEqual(parsed.artefacts, []);
    assert.deepEqual(parsed.values, []);
    assert.equal(parsed.note, 'Latency fell 2.1s -> 0.8s (a 62% win!)');
  });

  test('a note with no tokens yields empty lists', () => {
    const parsed = parseNote('Just a plain note.');
    assert.deepEqual(parsed.artefacts, []);
    assert.deepEqual(parsed.values, []);
    assert.deepEqual(parsed.people, []);
  });

  test('the stored entry keeps the prose, not the raw composer text', () => {
    const lane = readBoard(d).lanes[0]!;
    const task = createTask(d, { laneId: lane.id, columnId: lane.columns[0]!.id, title: 'T' });
    createLogEntry(d, task.id, {
      note: ['Walkthrough with client security.', '!Questionnaire v2'].join('\n'),
      type: 'Meeting',
    });

    const stored = readBoard(d).tasks.find((t) => t.id === task.id)!;
    assert.equal(stored.log.length, 1);
    assert.equal(stored.log[0]!.note, 'Walkthrough with client security.');
    assert.deepEqual(stored.log[0]!.artefacts, ['Questionnaire v2']);
    assert.equal(stored.log[0]!.hours, 1, 'a Meeting defaults to 1 hour');
  });
});

describe('deleting a lane', () => {
  test('merges cards by column name and recreates missing columns', () => {
    const source = createLane(d, { name: 'Source', columns: ['Triage', 'Doing'] });
    const target = createLane(d, { name: 'Target', columns: ['Doing'] });
    const triaged = createTask(d, {
      laneId: source.id,
      columnId: source.columns[0]!.id,
      title: 'in triage',
    });
    const doing = createTask(d, {
      laneId: source.id,
      columnId: source.columns[1]!.id,
      title: 'in doing',
    });

    deleteLane(d, source.id, target.id);
    const board = readBoard(d);
    const after = board.lanes.find((l) => l.id === target.id)!;

    assert.deepEqual(
      after.columns.map((c) => c.name),
      ['Doing', 'Triage'],
      'the column the target lacked is recreated',
    );
    const columnName = (id: string | null) => after.columns.find((c) => c.id === id)?.name;
    assert.equal(columnName(board.tasks.find((t) => t.id === triaged.id)!.columnId), 'Triage');
    assert.equal(columnName(board.tasks.find((t) => t.id === doing.id)!.columnId), 'Doing');
    assert.ok(!board.lanes.some((l) => l.id === source.id));
  });

  test('sends cards to Intake without stacking them on top of each other', () => {
    const source = createLane(d, { name: 'Doomed', columns: ['Only'] });
    const a = createTask(d, { laneId: source.id, columnId: source.columns[0]!.id, title: 'a' });
    const b = createTask(d, { laneId: source.id, columnId: source.columns[0]!.id, title: 'b' });

    deleteLane(d, source.id, 'intake');
    const tasks = readBoard(d).tasks;
    const [ta, tb] = [a, b].map((t) => tasks.find((x) => x.id === t.id)!);

    assert.equal(ta!.laneId, null);
    assert.equal(tb!.laneId, null);
    assert.notEqual(ta!.y, tb!.y);
  });
});

describe('moving a card', () => {
  test('lands at the requested index within its column', () => {
    const lane = createLane(d, { name: 'Ordering', columns: ['One'] });
    const column = lane.columns[0]!.id;
    const made = ['a', 'b', 'c'].map((title) =>
      createTask(d, { laneId: lane.id, columnId: column, title }),
    );

    moveTask(d, made[2]!.id, { laneId: lane.id, columnId: column, index: 0 });

    const order = readBoard(d)
      .tasks.filter((t) => t.columnId === column)
      .sort((x, y) => x.position - y.position)
      .map((t) => t.title);
    assert.deepEqual(order, ['c', 'a', 'b']);
  });
});

describe('objectives', () => {
  test('archiving promotes children to the archived objective’s parent', () => {
    const root = createObjective(d, { name: 'Root', year: 2026 });
    const middle = createObjective(d, { name: 'Middle', parentId: root.id });
    const leaf = createObjective(d, { name: 'Leaf', parentId: middle.id });

    archiveObjective(d, middle.id);
    const objectives = readBoard(d).objectives;

    assert.equal(objectives.find((o) => o.id === middle.id)!.archived, true);
    assert.equal(
      objectives.find((o) => o.id === leaf.id)!.parentId,
      root.id,
      'the grandchild is promoted rather than orphaned',
    );
  });

  test('children inherit their root’s year', () => {
    const root = createObjective(d, { name: 'Y root', year: 2027 });
    const child = createObjective(d, { name: 'Y child', parentId: root.id });
    assert.equal(readBoard(d).objectives.find((o) => o.id === child.id)!.year, 2027);
  });

  test('an objective cannot become its own descendant', () => {
    const root = createObjective(d, { name: 'C root', year: 2026 });
    const child = createObjective(d, { name: 'C child', parentId: root.id });
    assert.throws(() => updateObjective(d, root.id, { parentId: child.id }), /descendant/);
  });
});

describe('objectives and outcomes meet only on a card', () => {
  test('an outcome stores no objective links of its own', () => {
    const objective = createObjective(d, { name: 'Reliability', year: 2026 });
    const outcome = createOutcome(d, { name: 'Cache layer shipped' });
    const lane = readBoard(d).lanes[0]!;
    createTask(d, {
      laneId: lane.id,
      columnId: lane.columns[0]!.id,
      title: 'Ship the cache',
      objectiveIds: [objective.id],
      outcomeIds: [outcome.id],
    });

    const board = readBoard(d);
    const stored = board.outcomes.find((o) => o.id === outcome.id)!;
    assert.equal(
      'objectiveIds' in stored,
      false,
      'the relation lives on the card, not on the outcome',
    );

    // The card is the only place the two meet, and it carries both ids.
    const card = board.tasks.find((t) => t.title === 'Ship the cache')!;
    assert.deepEqual(card.objectiveIds, [objective.id]);
    assert.deepEqual(card.outcomeIds, [outcome.id]);
  });

  test('deleting an objective leaves the outcome and the card alone', () => {
    const objective = createObjective(d, { name: 'Doomed', year: 2026 });
    const outcome = createOutcome(d, { name: 'Survives' });
    const lane = readBoard(d).lanes[0]!;
    const task = createTask(d, {
      laneId: lane.id,
      columnId: lane.columns[0]!.id,
      title: 'Orphaned card',
      objectiveIds: [objective.id],
      outcomeIds: [outcome.id],
    });

    d.prepare('DELETE FROM objectives WHERE id = ?').run(objective.id);
    const board = readBoard(d);
    assert.ok(board.outcomes.some((o) => o.id === outcome.id), 'the outcome stands');

    const stored = board.tasks.find((t) => t.id === task.id)!;
    assert.deepEqual(stored.objectiveIds, [], 'the dead objective link cascades away');
    assert.deepEqual(stored.outcomeIds, [outcome.id], 'the outcome link is untouched');
  });
});

describe('copying a card', () => {
  test('carries fields and links but not the activity log', () => {
    const lane = readBoard(d).lanes[0]!;
    const objective = createObjective(d, { name: 'Copy target', year: 2026 });
    const outcome = createOutcome(d, { name: 'Copy outcome' });
    const source = createTask(d, {
      laneId: lane.id,
      columnId: lane.columns[0]!.id,
      title: 'Original',
      obstacles: 'blocked on X',
      priority: 'P1',
      severity: 'High',
      dateline: '2026-09-30',
      objectiveIds: [objective.id],
      outcomeIds: [outcome.id],
    });
    createLogEntry(d, source.id, { note: 'did a thing', type: 'Focus' });

    const copy = copyTask(d, source.id)!;
    const stored = readBoard(d).tasks.find((t) => t.id === copy.id)!;

    assert.equal(stored.title, 'Original');
    assert.equal(stored.obstacles, 'blocked on X');
    assert.equal(stored.priority, 'P1');
    assert.equal(stored.severity, 'High');
    assert.equal(stored.dateline, '2026-09-30');
    assert.deepEqual(stored.objectiveIds, [objective.id]);
    assert.deepEqual(stored.outcomeIds, [outcome.id]);
    assert.equal(stored.log.length, 0, 'the log belongs to the original');
    assert.notEqual(stored.id, source.id);
  });

  test('an Intake copy is offset so it does not sit on top of the original', () => {
    const source = createTask(d, { laneId: null, columnId: null, title: 'On canvas', x: 40, y: 60 });
    const copy = copyTask(d, source.id)!;
    assert.notEqual(copy.x, source.x);
    assert.notEqual(copy.y, source.y);
  });

  test('copying a card that does not exist returns null', () => {
    assert.equal(copyTask(d, 'task_nope'), null);
  });
});

describe('label colours', () => {
  test('a new label has no hue, so its colour derives from the name', () => {
    const label = createLabel(d, 'derived');
    assert.equal(readBoard(d).labels.find((l) => l.id === label.id)!.hue, null);
  });

  test('a chosen hue is stored and survives a rename', () => {
    const label = createLabel(d, 'chosen');
    updateLabel(d, label.id, { hue: 240 });
    updateLabel(d, label.id, { name: 'renamed' });

    const stored = readBoard(d).labels.find((l) => l.id === label.id)!;
    assert.equal(stored.name, 'renamed');
    assert.equal(stored.hue, 240, 'renaming must not reset the colour');
  });

  test('null resets a label to its name-derived colour', () => {
    const label = createLabel(d, 'reset me', 120);
    assert.equal(readBoard(d).labels.find((l) => l.id === label.id)!.hue, 120);
    updateLabel(d, label.id, { hue: null });
    assert.equal(readBoard(d).labels.find((l) => l.id === label.id)!.hue, null);
  });
});
