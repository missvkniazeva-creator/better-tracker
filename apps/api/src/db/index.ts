import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH = resolve(here, '../../../../data/better-tracker.db');

/**
 * Resolved on every call, never at module scope.
 *
 * Module scope would be evaluated when this file is first imported, and ESM hoists
 * imports above statements -- so a test setting `process.env.BT_DB_PATH` at the top
 * of its file would already be too late, and the test would silently run against the
 * real database. (It did, once.)
 */
export function dbPath(): string {
  return process.env.BT_DB_PATH ?? DEFAULT_DB_PATH;
}

export type DB = DatabaseSync;

let db: DB | null = null;

export function getDb(): DB {
  if (db) return db;
  const path = dbPath();
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  // WAL keeps the single writer from blocking reads; foreign keys are off by
  // default in SQLite and every cascade in the schema depends on them.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

/**
 * Migrations are numbered and applied in order, tracked by `PRAGMA user_version`.
 * Migration 1 is the whole of schema.sql; later schema changes append a new entry
 * rather than editing schema.sql, so an existing database can always catch up.
 */
const MIGRATIONS: ReadonlyArray<(d: DB) => void> = [
  // 1 — the whole of schema.sql. Once this project has databases worth preserving,
  // schema changes append a new entry here instead of editing schema.sql: an existing
  // database has already run migration 1, so an edit would reach only fresh ones.
  (d) => d.exec(readFileSync(join(here, 'schema.sql'), 'utf8')),

  // 2 — drop the explicit outcome→objective link. An outcome and an objective are
  // related when a card names both; the relation is read off the cards rather than
  // stored, so it can never contradict what the work actually says.
  (d) => d.exec('DROP TABLE IF EXISTS outcome_objectives'),
];

function migrate(d: DB): void {
  const row = d.prepare('PRAGMA user_version').get() as { user_version: number };
  let version = row.user_version;
  for (let i = version; i < MIGRATIONS.length; i++) {
    d.exec('BEGIN');
    try {
      MIGRATIONS[i]!(d);
      d.exec(`PRAGMA user_version = ${i + 1}`);
      d.exec('COMMIT');
    } catch (err) {
      d.exec('ROLLBACK');
      throw new Error(`migration ${i + 1} failed: ${(err as Error).message}`, { cause: err });
    }
    version = i + 1;
  }
}

/** Runs `fn` in a transaction, rolling back on any throw. */
export function tx<T>(d: DB, fn: () => T): T {
  d.exec('BEGIN');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

/** Short, sortable, URL-safe id. Prefixed so ids are readable in the database. */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
