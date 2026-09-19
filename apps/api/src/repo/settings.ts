import type { DB } from '../db/index.ts';
import { DEFAULT_SETTINGS, type Settings } from '../../../../shared/types.ts';

export function readSettings(d: DB): Settings {
  const rows = d.prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return {
    theme: (stored.get('theme') as Settings['theme']) ?? DEFAULT_SETTINGS.theme,
    colWidth: num(stored.get('colWidth'), DEFAULT_SETTINGS.colWidth),
    intakeHeight: num(stored.get('intakeHeight'), DEFAULT_SETTINGS.intakeHeight),
    cardAccent:
      (stored.get('cardAccent') as Settings['cardAccent']) ?? DEFAULT_SETTINGS.cardAccent,
  };
}

export function writeSettings(d: DB, patch: Partial<Settings>): Settings {
  const stmt = d.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) stmt.run(key, String(value));
  }
  return readSettings(d);
}

function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
