/**
 * Empties the database and reinstates first-run content.
 *
 * The tables are dropped rather than the file deleted: a running API process
 * holds an open handle, and unlinking the file leaves that process writing to an
 * unlinked inode -- it would keep serving the old rows until restarted.
 */
import { getDb, closeDb, dbPath } from '../db/index.ts';
import { bootstrap } from '../db/bootstrap.ts';

const d = getDb();
const tables = d
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all() as { name: string }[];

d.exec('PRAGMA foreign_keys = OFF');
for (const { name } of tables) d.exec(`DROP TABLE IF EXISTS "${name}"`);
d.exec('PRAGMA user_version = 0');
d.exec('PRAGMA foreign_keys = ON');
closeDb();

// Reopening runs the migrations from scratch against the same file.
bootstrap(getDb());
closeDb();
console.log(`reset: ${dbPath()}`);
