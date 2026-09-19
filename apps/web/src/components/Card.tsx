import { useBoard } from '../state/store.tsx';
import { isOverdue, labelColor, todayIso } from '../lib/derive.ts';
import { AlertTriangle, ChevronsDown, ChevronsUp, TargetIcon } from './icons.tsx';
import type { Lane, Task } from '@shared/types.ts';

/**
 * Board card.
 *
 * The left edge stroke encodes dateline state: danger when overdue, ink3 when a
 * dateline is set and still ahead, line2 when there is none — so the date needs no
 * text of its own.
 *
 * The marks sit top-right beside the title: severity, obstacle, priority, in that
 * order. **P2 shows no priority glyph** — it is the default, and marking every card
 * would leave nothing standing out.
 */
export function Card({
  task,
  lane,
  onOpen,
  onCopy,
  onDragStart,
  style,
}: {
  task: Task;
  lane: Lane | undefined;
  onOpen: (taskId: string) => void;
  onCopy: (taskId: string) => void;
  onDragStart: (task: Task, event: React.DragEvent) => void;
  style?: React.CSSProperties;
}) {
  const { board } = useBoard();
  const overdue = isOverdue(task, lane, todayIso());
  const hasObstacle = task.obstacles.trim().length > 0;
  const edge = overdue ? 'var(--danger)' : task.dateline ? 'var(--ink3)' : 'var(--line2)';

  const labels = task.labelIds
    .map((id) => board?.labels.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  const objectives = task.objectiveIds
    .map((id) => board?.objectives.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));
  const outcomes = task.outcomeIds
    .map((id) => board?.outcomes.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  return (
    <article
      className="card"
      data-obstacle={hasObstacle || undefined}
      style={{ ...style, boxShadow: `inset 3px 0 0 ${edge}` }}
      draggable
      role="button"
      tabIndex={0}
      aria-label={task.title || 'Untitled card'}
      title="Option-click to copy"
      onDragStart={(e) => onDragStart(task, e)}
      // Option/Alt duplicates rather than opens — the same modifier macOS uses for
      // drag-to-copy, so it should not need explaining.
      onClick={(e) => (e.altKey ? onCopy(task.id) : onOpen(task.id))}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (e.altKey) onCopy(task.id);
        else onOpen(task.id);
      }}
    >
      <div className="card__body">
        <div className="card__head">
          <span className="card__title">{task.title || 'Untitled'}</span>

          <span className="card__marks">
            {task.severity === 'High' && (
              <span className="card__sev" title="Severity high" aria-label="Severity high">
                ▲
              </span>
            )}
            {hasObstacle && (
              <span className="card__obstacle" title="Has an obstacle" aria-label="Has an obstacle">
                <AlertTriangle size={13} />
              </span>
            )}
            {task.priority === 'P1' && (
              <span className="card__prio" data-prio="P1" title="Priority 1" aria-label="Priority 1">
                <ChevronsUp size={13} />
              </span>
            )}
            {task.priority === 'P3' && (
              <span className="card__prio" data-prio="P3" title="Priority 3" aria-label="Priority 3">
                <ChevronsDown size={13} />
              </span>
            )}
          </span>
        </div>

        {labels.length > 0 && (
          <div className="card__labels">
            {labels.map((l) => (
              <span
                key={l.id}
                className="card__label"
                style={{ '--chip-h': labelColor(l) } as React.CSSProperties}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}

        {(objectives.length > 0 || outcomes.length > 0) && (
          <div className="card__links">
            {objectives.map((o) => (
              <span key={o.id} className="card__objective">
                <TargetIcon size={11} />
                {o.name}
              </span>
            ))}
            {outcomes.map((o) => (
              <span key={o.id} className="card__outcome">
                → {o.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
