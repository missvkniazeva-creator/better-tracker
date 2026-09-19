import type { DB } from '../db/index.ts';
import { newId, tx } from '../db/index.ts';
import { parseNote, type ParsedNote } from '../../../../shared/parse.ts';
import type { LogEntry, LogType } from '../../../../shared/types.ts';

export interface LogInput {
  date?: string;
  type?: LogType;
  note?: string;
  hours?: number;
  outcomeIds?: string[];
}

export function createLogEntry(d: DB, taskId: string, input: LogInput): string {
  return tx(d, () => {
    const id = newId('log');
    // The artefact and value lines are lifted out; what is stored is the prose that
    // remains, so the entry does not show the same text twice.
    const parsed = parseNote(input.note ?? '');
    d.prepare(
      'INSERT INTO log_entries (id, task_id, date, type, note, hours) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      taskId,
      input.date ?? today(),
      input.type ?? 'Focus',
      parsed.note,
      input.hours ?? defaultHours(input.type ?? 'Focus'),
    );
    writeTokens(d, id, parsed);
    writeOutcomes(d, id, input.outcomeIds ?? []);
    return id;
  });
}

export function updateLogEntry(d: DB, id: string, input: LogInput): void {
  tx(d, () => {
    const sets: string[] = [];
    const args: (string | number)[] = [];
    if (input.date !== undefined) (sets.push('date = ?'), args.push(input.date));
    if (input.type !== undefined) (sets.push('type = ?'), args.push(input.type));
    const parsed = input.note === undefined ? null : parseNote(input.note);
    if (parsed) (sets.push('note = ?'), args.push(parsed.note));
    if (input.hours !== undefined) (sets.push('hours = ?'), args.push(input.hours));
    if (sets.length) {
      args.push(id);
      d.prepare(`UPDATE log_entries SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    }
    if (parsed) writeTokens(d, id, parsed);
    if (input.outcomeIds !== undefined) writeOutcomes(d, id, input.outcomeIds);
  });
}

export function deleteLogEntry(d: DB, id: string): void {
  d.prepare('DELETE FROM log_entries WHERE id = ?').run(id);
}

/** Hours the prototype defaults to per entry type. */
export function defaultHours(type: LogType): number {
  return type === 'Meeting' ? 1 : type === 'Call' ? 0.5 : type === 'Multitasking' ? 1.5 : 2;
}

function writeTokens(d: DB, entryId: string, parsed: ParsedNote): void {
  d.prepare('DELETE FROM log_entry_tokens WHERE entry_id = ?').run(entryId);
  const stmt = d.prepare(
    'INSERT OR IGNORE INTO log_entry_tokens (entry_id, kind, value, position) VALUES (?, ?, ?, ?)',
  );
  parsed.artefacts.forEach((v, i) => stmt.run(entryId, 'artefact', v, i));
  parsed.values.forEach((v, i) => stmt.run(entryId, 'value', v, i));
  parsed.people.forEach((v, i) => stmt.run(entryId, 'person', v, i));
}

function writeOutcomes(d: DB, entryId: string, outcomeIds: string[]): void {
  d.prepare('DELETE FROM log_entry_outcomes WHERE entry_id = ?').run(entryId);
  const stmt = d.prepare(
    'INSERT OR IGNORE INTO log_entry_outcomes (entry_id, outcome_id) VALUES (?, ?)',
  );
  for (const id of new Set(outcomeIds)) stmt.run(entryId, id);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type { LogEntry };
