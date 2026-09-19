import { useEffect, useMemo, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import { api } from '../lib/api.ts';
import { matchesFilters } from '../lib/derive.ts';
import { Intake } from './Intake.tsx';
import { LaneBlock } from './LaneBlock.tsx';
import { DeleteLaneDialog } from './DeleteLaneDialog.tsx';
import { NEW_TASK_TITLE } from '@shared/types.ts';
import type { Lane, Task } from '@shared/types.ts';

export function Board({
  onOpenTask,
  onVisibleCount,
}: {
  onOpenTask: (taskId: string, isNew?: boolean) => void;
  onVisibleCount: (n: number) => void;
}) {
  const { board, run, filters } = useBoard();
  const [laneToDelete, setLaneToDelete] = useState<Lane | null>(null);
  // Which lane or column was just created, so its header opens in rename mode.
  const [renamingLaneId, setRenamingLaneId] = useState<string | null>(null);
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!board) return [];
    return board.tasks.filter((t) => matchesFilters(t, filters, board));
  }, [board, filters]);

  useEffect(() => onVisibleCount(visible.length), [visible.length, onVisibleCount]);

  if (!board) return null;

  const intakeTasks = visible.filter((t) => t.laneId === null);

  const onDragStart = (task: Task, e: React.DragEvent) => {
    // Where inside the card the pointer grabbed it. Without this the card's top-left
    // snaps to the cursor on drop, so it visibly jumps by however far in you grabbed.
    const rect = e.currentTarget.getBoundingClientRect();
    e.dataTransfer.setData('text/task-id', task.id);
    e.dataTransfer.setData('text/grab-offset', `${e.clientX - rect.left},${e.clientY - rect.top}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  /**
   * A new card is created empty and its modal opens immediately, so the card is
   * named where it is edited rather than by an inline field that then has to be
   * reconciled with the modal.
   */
  /**
   * "+ Lane" creates the lane and opens its header in rename mode — the name and
   * colour are chosen in place, where they are shown, rather than through a browser
   * prompt that cannot offer a colour at all.
   */
  const addLane = async () => {
    const used = new Set(board.lanes.map((l) => l.color));
    const palette = ['lane1', 'lane2', 'lane3', 'lane4', 'lane5', 'lane6'] as const;
    const color = palette.find((c) => !used.has(c)) ?? palette[board.lanes.length % palette.length]!;
    const before = new Set(board.lanes.map((l) => l.id));

    await run(async () => {
      const next = await api.createLane({ name: 'New lane', color });
      const created = next.lanes.find((l) => !before.has(l.id));
      if (created) setRenamingLaneId(created.id);
      return next;
    });
  };

  const addColumn = async (laneId: string) => {
    const lane = board.lanes.find((l) => l.id === laneId);
    const taken = new Set(lane?.columns.map((c) => c.name) ?? []);
    let name = 'New column';
    for (let n = 2; taken.has(name); n++) name = `New column ${n}`;
    const before = new Set(lane?.columns.map((c) => c.id) ?? []);

    await run(async () => {
      const next = await api.createColumn(laneId, name);
      const created = next.lanes
        .find((l) => l.id === laneId)
        ?.columns.find((c) => !before.has(c.id));
      if (created) setRenamingColumnId(created.id);
      return next;
    });
  };

  /**
   * A new card is created with a placeholder title and its modal opens with that
   * title selected, so the first keystroke replaces it. A card abandoned without a
   * name then reads as "New task" rather than "Untitled".
   */
  const copyAndOpen = async (taskId: string) => {
    const before = new Set(board.tasks.map((t) => t.id));
    await run(async () => {
      const next = await api.copyTask(taskId);
      const created = next.tasks.find((t) => !before.has(t.id));
      // Opened without selecting the title: a copy is usually tweaked, not renamed.
      if (created) onOpenTask(created.id);
      return next;
    });
  };

  const createAndOpen = async (input: Record<string, unknown>) => {
    const before = new Set(board.tasks.map((t) => t.id));
    await run(async () => {
      const next = await api.createTask({ title: NEW_TASK_TITLE, ...input });
      const created = next.tasks.find((t) => !before.has(t.id));
      if (created) onOpenTask(created.id, true);
      return next;
    });
  };

  return (
    <div className="board">
      <Intake
        tasks={intakeTasks}
        onOpen={onOpenTask}
        onCopy={copyAndOpen}
        onCreate={createAndOpen}
        onDragStart={onDragStart}
        onDropCard={(taskId, x, y) =>
          void run(() => api.moveTask(taskId, { laneId: null, columnId: null, x, y }))
        }
      />

      {board.lanes.map((lane) => (
        <LaneBlock
          key={lane.id}
          lane={lane}
          tasks={visible.filter((t) => t.laneId === lane.id)}
          onOpen={onOpenTask}
          onCopy={copyAndOpen}
          onDragStart={onDragStart}
          onDropCard={(taskId, laneId, columnId, index) =>
            void run(() => api.moveTask(taskId, { laneId, columnId, index }))
          }
          defaultRenaming={lane.id === renamingLaneId}
          renamingColumnId={
            lane.columns.some((c) => c.id === renamingColumnId) ? renamingColumnId : null
          }
          onCreate={createAndOpen}
          onAddColumn={addColumn}
          onRenameEnd={() => {
            setRenamingLaneId(null);
            setRenamingColumnId(null);
          }}
          onRequestDelete={setLaneToDelete}
          onReorder={(draggedId, targetId, after) => {
            const ids = board.lanes.map((l) => l.id).filter((id) => id !== draggedId);
            const at = ids.indexOf(targetId) + (after ? 1 : 0);
            ids.splice(at, 0, draggedId);
            void run(() => api.reorderLanes(ids));
          }}
        />
      ))}

      {board.tasks.length > 0 && visible.length === 0 && (
        <div className="empty empty--board">
          <p className="empty__line">No cards match these filters.</p>
          <p className="empty__hint">
            {board.tasks.length} {board.tasks.length === 1 ? 'card is' : 'cards are'} hidden.
            Clear a filter or widen the search to see them.
          </p>
        </div>
      )}

      <button type="button" className="add-lane" onClick={() => void addLane()}>
        + Lane
      </button>

      {laneToDelete && (
        <DeleteLaneDialog
          lane={laneToDelete}
          cardCount={board.tasks.filter((t) => t.laneId === laneToDelete.id).length}
          lanes={board.lanes.filter((l) => l.id !== laneToDelete.id)}
          onClose={() => setLaneToDelete(null)}
          onConfirm={(target) => {
            const id = laneToDelete.id;
            setLaneToDelete(null);
            void run(() => api.deleteLane(id, target));
          }}
        />
      )}
    </div>
  );
}
