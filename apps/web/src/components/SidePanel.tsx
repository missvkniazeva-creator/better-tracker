import { LogPanel, type LogTool } from './LogPanel.tsx';
import { ObjectivesPanel } from './ObjectivesPanel.tsx';
import { OutcomesPanel } from './OutcomesPanel.tsx';
import type { Tool } from './ActivityBar.tsx';

const TITLES: Record<Tool, string> = {
  objectives: 'Objectives',
  outcomes: 'Outcomes',
  log: 'Log',
};

// Per tool, widened while a pane is open beside the list.
const WIDTHS: Record<Tool, number> = {
  objectives: 520,
  outcomes: 460,
  log: 560,
};

/**
 * Docked panel — the board reflows beside it rather than being covered. Width is
 * per tool, and grows when a pane is open beside the list: an editor, or a Log tool.
 */
export function SidePanel({
  tool,
  editingObjectiveId,
  editingOutcomeId,
  logTool,
  onEditObjective,
  onEditOutcome,
  onLogTool,
  onOpenTask,
  onClose,
}: {
  tool: Tool;
  editingObjectiveId: string | null;
  editingOutcomeId: string | null;
  logTool: LogTool | null;
  onEditObjective: (id: string | null) => void;
  onEditOutcome: (id: string | null) => void;
  onLogTool: (tool: LogTool | null) => void;
  /** Clicking a log entry opens the card it was logged against. */
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}) {
  const width =
    tool === 'objectives' && editingObjectiveId
      ? 900
      : tool === 'outcomes' && editingOutcomeId
        ? 860
        : tool === 'log' && logTool
          ? 960
          : WIDTHS[tool];

  return (
    <aside
      className="side-panel"
      style={{ width: `min(${width}px, calc(100vw - 48px))` }}
      aria-label={TITLES[tool]}
    >
      {tool === 'objectives' ? (
        <ObjectivesPanel
          editingId={editingObjectiveId}
          onEdit={onEditObjective}
          onClose={onClose}
        />
      ) : tool === 'outcomes' ? (
        <OutcomesPanel editingId={editingOutcomeId} onEdit={onEditOutcome} onClose={onClose} />
      ) : (
        <LogPanel tool={logTool} onTool={onLogTool} onOpenTask={onOpenTask} onClose={onClose} />
      )}
    </aside>
  );
}
