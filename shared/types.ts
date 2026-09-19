/**
 * Wire types shared by the API and the web app.
 *
 * Types only -- everything here erases at build time, so both sides can import it
 * without a bundling step. Aliased as `@shared/*` in both tsconfigs.
 */

export type Priority = 'P1' | 'P2' | 'P3';
export type Severity = 'Low' | 'Medium' | 'High';
export type LogType = 'Focus' | 'Meeting' | 'Call' | 'Multitasking';
export type LaneColor = 'lane1' | 'lane2' | 'lane3' | 'lane4' | 'lane5' | 'lane6' | 'lane7';
export type Theme = 'light' | 'dark';
export type CardAccent = 'off' | 'lane' | 'priority';

/** Where a card sits within its own lane. Derived from column order, never names. */
export type TaskPhase = 'intake' | 'pending' | 'in-action' | 'staged';

export interface Lane {
  id: string;
  name: string;
  hint: string;
  color: LaneColor;
  position: number;
  columns: Column[];
}

export interface Column {
  id: string;
  laneId: string;
  name: string;
  position: number;
}

export interface Objective {
  id: string;
  parentId: string | null;
  name: string;
  measure: string;
  year: number;
  archived: boolean;
  position: number;
}

export interface Outcome {
  id: string;
  name: string;
  description: string;
  /** ISO yyyy-mm-dd, or '' for none. */
  date: string;
  position: number;
}

export interface Label {
  id: string;
  name: string;
  /** Chosen oklch hue, or null to derive one from the name. */
  hue: number | null;
  position: number;
}

/** The twelve hues offered in the label editor, evenly spaced around the wheel. */
export const LABEL_HUES: readonly number[] = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
];

export interface TaskImage {
  id: string;
  name: string;
  mime: string;
  /** Served by the API; never inlined as a data URL in JSON. */
  url: string;
}

export interface LogEntry {
  id: string;
  taskId: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  type: LogType;
  note: string;
  hours: number;
  artefacts: string[];
  values: string[];
  people: string[];
  outcomeIds: string[];
}

export interface Task {
  id: string;
  /** null => the card is on the Intake canvas. */
  laneId: string | null;
  /** null => Intake. */
  columnId: string | null;
  title: string;
  description: string;
  obstacles: string;
  priority: Priority;
  severity: Severity;
  /** ISO yyyy-mm-dd, or '' for none. */
  dateline: string;
  archived: boolean;
  /** Intake canvas coordinates. Meaningless once the card is in a column. */
  x: number;
  y: number;
  position: number;
  labelIds: string[];
  objectiveIds: string[];
  outcomeIds: string[];
  images: TaskImage[];
  log: LogEntry[];
}

/** One request, the whole board. The dataset is single-user and small. */
export interface BoardSnapshot {
  lanes: Lane[];
  tasks: Task[];
  objectives: Objective[];
  outcomes: Outcome[];
  labels: Label[];
  settings: Settings;
}

export interface Settings {
  theme: Theme;
  colWidth: number;
  intakeHeight: number;
  cardAccent: CardAccent;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  colWidth: 360,
  intakeHeight: 190,
  cardAccent: 'off',
};

/** Placeholder names newly created records carry until they are typed over. */
export const NEW_TASK_TITLE = 'New task';
export const NEW_OBJECTIVE_NAME = 'New objective';
export const NEW_OUTCOME_NAME = 'New outcome';

