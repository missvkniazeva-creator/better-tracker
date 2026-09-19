-- Better Tracker schema, v1.
--
-- Departure from the design handoff's data model: the prototype relates objectives
-- and outcomes to tasks *by name*, which forces a rename cascade across five tables.
-- The handoff itself says a real backend should "prefer stable ids with a display
-- name, and drop the cascade" -- so every relation here is by id, and renaming is a
-- single-row UPDATE.

-- ---------------------------------------------------------------- board structure

CREATE TABLE IF NOT EXISTS lanes (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  hint        TEXT    NOT NULL DEFAULT '',
  color       TEXT    NOT NULL DEFAULT 'lane1',  -- token name: lane1..lane7
  position    REAL    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS columns (
  id          TEXT    PRIMARY KEY,
  lane_id     TEXT    NOT NULL REFERENCES lanes(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  position    REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_columns_lane ON columns(lane_id, position);

-- ------------------------------------------------------------ goals and results

CREATE TABLE IF NOT EXISTS objectives (
  id          TEXT    PRIMARY KEY,
  parent_id   TEXT             REFERENCES objectives(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  measure     TEXT    NOT NULL DEFAULT '',
  year        INTEGER NOT NULL,
  archived    INTEGER NOT NULL DEFAULT 0,
  position    REAL    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives(parent_id);

CREATE TABLE IF NOT EXISTS outcomes (
  id           TEXT   PRIMARY KEY,
  name         TEXT   NOT NULL,
  description  TEXT   NOT NULL DEFAULT '',
  date         TEXT   NOT NULL DEFAULT '',   -- ISO yyyy-mm-dd
  position     REAL   NOT NULL,
  created_at   TEXT   NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT   NOT NULL DEFAULT (datetime('now'))
);

-- There is deliberately no outcome_objectives table. Objectives and outcomes meet on
-- a *card*: a card names the objectives it serves and the outcomes it feeds, and the
-- objective→outcome relation is read back off those two links. A stored second copy
-- of that relation could disagree with the cards, and did.

-- ------------------------------------------------------------------------ cards

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT    PRIMARY KEY,
  lane_id     TEXT             REFERENCES lanes(id)   ON DELETE CASCADE,
  column_id   TEXT             REFERENCES columns(id) ON DELETE SET NULL,
  title       TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  obstacles   TEXT    NOT NULL DEFAULT '',
  priority    TEXT    NOT NULL DEFAULT 'P2' CHECK (priority IN ('P1','P2','P3')),
  severity    TEXT    NOT NULL DEFAULT 'Low' CHECK (severity IN ('Low','Medium','High')),
  dateline    TEXT    NOT NULL DEFAULT '',   -- ISO yyyy-mm-dd, '' = none
  archived    INTEGER NOT NULL DEFAULT 0,
  x           REAL    NOT NULL DEFAULT 0,    -- Intake canvas only
  y           REAL    NOT NULL DEFAULT 0,    -- Intake canvas only
  position    REAL    NOT NULL DEFAULT 0,    -- order within a column
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
-- lane_id NULL => card sits on the Intake canvas (x/y meaningful).
-- Intake is the only column-less place, so column_id is NULL exactly there.
CREATE INDEX IF NOT EXISTS idx_tasks_column   ON tasks(column_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_lane     ON tasks(lane_id);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);

CREATE TABLE IF NOT EXISTS labels (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,
  -- oklch hue, 0-359. NULL means "derive from the name", which is what every label
  -- did before colours could be chosen, so old and unset labels look unchanged.
  hue      INTEGER,
  position REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS task_labels (
  task_id  TEXT NOT NULL REFERENCES tasks(id)  ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS task_objectives (
  task_id      TEXT NOT NULL REFERENCES tasks(id)      ON DELETE CASCADE,
  objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, objective_id)
);

CREATE TABLE IF NOT EXISTS task_outcomes (
  task_id    TEXT NOT NULL REFERENCES tasks(id)    ON DELETE CASCADE,
  outcome_id TEXT NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, outcome_id)
);

-- Pasted images. Stored as bytes, not data URLs: a data URL in JSON inflates by 33%
-- and would be re-sent on every board load. The API serves them at /api/images/:id.
CREATE TABLE IF NOT EXISTS task_images (
  id         TEXT    PRIMARY KEY,
  task_id    TEXT    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  mime       TEXT    NOT NULL,
  bytes      BLOB    NOT NULL,
  position   REAL    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_images_task ON task_images(task_id, position);

-- ------------------------------------------------------------------ activity log

CREATE TABLE IF NOT EXISTS log_entries (
  id         TEXT    PRIMARY KEY,
  task_id    TEXT    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,              -- ISO yyyy-mm-dd, the sortable truth
  type       TEXT    NOT NULL CHECK (type IN ('Focus','Meeting','Call','Multitasking')),
  note       TEXT    NOT NULL DEFAULT '',
  hours      REAL    NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_log_entries_date ON log_entries(date);
CREATE INDEX IF NOT EXISTS idx_log_entries_task ON log_entries(task_id);

CREATE TABLE IF NOT EXISTS log_entry_outcomes (
  entry_id   TEXT NOT NULL REFERENCES log_entries(id) ON DELETE CASCADE,
  outcome_id TEXT NOT NULL REFERENCES outcomes(id)    ON DELETE CASCADE,
  PRIMARY KEY (entry_id, outcome_id)
);

-- !Artefact / +Value / @person, parsed out of the note by the composer.
CREATE TABLE IF NOT EXISTS log_entry_tokens (
  entry_id TEXT NOT NULL REFERENCES log_entries(id) ON DELETE CASCADE,
  kind     TEXT NOT NULL CHECK (kind IN ('artefact','value','person')),
  value    TEXT NOT NULL,
  position REAL NOT NULL,
  PRIMARY KEY (entry_id, kind, value)
);

-- --------------------------------------------------------------------- settings

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
