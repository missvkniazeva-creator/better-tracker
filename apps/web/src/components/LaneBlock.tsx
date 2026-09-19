import { useEffect, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import { api } from '../lib/api.ts';
import { Card } from './Card.tsx';
import { ChevronDown, ChevronRight, GripIcon } from './icons.tsx';
import { InlineRename } from './InlineRename.tsx';
import type { Lane, LaneColor, Task } from '@shared/types.ts';

const LANE_COLORS: LaneColor[] = ['lane1', 'lane2', 'lane3', 'lane4', 'lane5', 'lane6', 'lane7'];

export function LaneBlock({
  lane,
  tasks,
  defaultRenaming = false,
  renamingColumnId = null,
  onOpen,
  onCopy,
  onCreate,
  onAddColumn,
  onRenameEnd,
  onDragStart,
  onDropCard,
  onRequestDelete,
  onReorder,
}: {
  lane: Lane;
  tasks: Task[];
  /** A lane created from "+ Lane" opens straight into rename mode. */
  defaultRenaming?: boolean;
  /** Likewise for a column created from "+ Column". */
  renamingColumnId?: string | null;
  onOpen: (taskId: string) => void;
  onCopy: (taskId: string) => void;
  onCreate: (input: Record<string, unknown>) => void;
  onAddColumn: (laneId: string) => void;
  onRenameEnd: () => void;
  onDragStart: (task: Task, e: React.DragEvent) => void;
  onDropCard: (taskId: string, laneId: string, columnId: string, index: number) => void;
  onRequestDelete: (lane: Lane) => void;
  onReorder: (draggedId: string, targetId: string, after: boolean) => void;
}) {
  const { board, run } = useBoard();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState(defaultRenaming);
  const [renamingCol, setRenamingCol] = useState<string | null>(renamingColumnId);
  // A new column appears in a lane that is already mounted, so unlike defaultRenaming
  // this cannot be initial state — it has to follow the prop.
  useEffect(() => {
    if (renamingColumnId) setRenamingCol(renamingColumnId);
  }, [renamingColumnId]);
  const [dropEdge, setDropEdge] = useState<'top' | 'bottom' | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const colWidth = board?.settings.colWidth ?? 360;
  const laneVar = `var(--${lane.color})`;
  const tint = `color-mix(in srgb, ${laneVar} var(--tint-a), var(--surf))`;

  const contributions = tasks.reduce((n, t) => n + t.log.length, 0);
  const obstacles = tasks.filter((t) => t.obstacles.trim()).length;

  const endRename = () => {
    setRenaming(false);
    onRenameEnd();
  };
  const endColRename = () => {
    setRenamingCol(null);
    onRenameEnd();
  };

  return (
    <section
      className="lane"
      aria-label={lane.name}
      style={{ borderTopColor: laneVar }}
      data-drop-edge={dropEdge ?? undefined}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/lane-id')) {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          setDropEdge(e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom');
        }
      }}
      onDragLeave={() => setDropEdge(null)}
      onDrop={(e) => {
        const draggedId = e.dataTransfer.getData('text/lane-id');
        if (!draggedId || draggedId === lane.id) return setDropEdge(null);
        e.preventDefault();
        onReorder(draggedId, lane.id, dropEdge === 'bottom');
        setDropEdge(null);
      }}
    >
      <div
        className="lane__header"
        style={{ background: tint }}
        draggable={!renaming}
        title={renaming ? undefined : 'Drag to reorder lanes'}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/lane-id', lane.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <span className="lane__grip" aria-hidden="true">
          <GripIcon />
        </span>

        {!renaming && (
          <button
            type="button"
            className="icon-button icon-button--sm"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${lane.name}` : `Collapse ${lane.name}`}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {renaming ? (
          <div className="lane__rename">
            <InlineRename
              value={lane.name}
              onCommit={(name) => {
                endRename();
                if (name && name !== lane.name) void run(() => api.updateLane(lane.id, { name }));
              }}
              onCancel={endRename}
            />
            <div className="lane__swatches" role="group" aria-label="Lane colour">
              {LANE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="lane__swatch"
                  data-current={c === lane.color || undefined}
                  aria-label={`Colour ${c}`}
                  aria-pressed={c === lane.color}
                  style={{ background: `var(--${c})` }}
                  // mousedown, not click: a click would blur the rename input first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void run(() => api.updateLane(lane.id, { color: c }));
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <button type="button" className="lane__title" onClick={() => setRenaming(true)}>
            {lane.name}
            <span className="lane__count mono">{tasks.length}</span>
          </button>
        )}

        {!renaming && <span className="lane__hint">{lane.hint}</span>}

        <div className="lane__stats">
          <span className="lane__stat">
            <span className="mono">{contributions}</span> contributions
          </span>
          {obstacles > 0 && (
            <span className="lane__stat lane__stat--warn">
              <span className="mono">{obstacles}</span> blocked
            </span>
          )}
        </div>

        <button
          type="button"
          className="tile-button"
          aria-label={`Delete lane ${lane.name}`}
          title="Delete lane"
          onClick={() => onRequestDelete(lane)}
        >
          ×
        </button>
      </div>

      {!collapsed && (
        <div className="lane__columns">
          {lane.columns.map((column) => {
            const cards = tasks
              .filter((t) => t.columnId === column.id)
              .sort((a, b) => a.position - b.position);
            const isCollapsed = collapsedCols[column.id];

            if (isCollapsed) {
              return (
                <button
                  key={column.id}
                  type="button"
                  className="column-strip"
                  aria-label={`Expand ${column.name}`}
                  onClick={() => setCollapsedCols((c) => ({ ...c, [column.id]: false }))}
                  onDragOver={(e) => e.dataTransfer.types.includes('text/task-id') && e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData('text/task-id');
                    if (!id) return;
                    e.preventDefault();
                    onDropCard(id, lane.id, column.id, cards.length);
                  }}
                >
                  <span className="column-strip__count mono">{cards.length}</span>
                  <span className="column-strip__name">{column.name}</span>
                </button>
              );
            }

            return (
              <div
                key={column.id}
                className="column"
                data-over={overColumn === column.id || undefined}
                style={{ flex: `0 0 ${colWidth}px` }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes('text/task-id')) return;
                  e.preventDefault();
                  setOverColumn(column.id);
                }}
                onDragLeave={() => setOverColumn((c) => (c === column.id ? null : c))}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('text/task-id');
                  setOverColumn(null);
                  if (!id) return;
                  e.preventDefault();
                  onDropCard(id, lane.id, column.id, cards.length);
                }}
              >
                <div className="column__header">
                  <button
                    type="button"
                    className="icon-button icon-button--xs"
                    aria-label={`Collapse ${column.name}`}
                    onClick={() => setCollapsedCols((c) => ({ ...c, [column.id]: true }))}
                  >
                    <ChevronDown size={12} />
                  </button>

                  {renamingCol === column.id ? (
                    <InlineRename
                      value={column.name}
                      onCommit={(name) => {
                        endColRename();
                        if (name && name !== column.name) {
                          void run(() => api.renameColumn(column.id, name));
                        }
                      }}
                      onCancel={endColRename}
                    />
                  ) : (
                    <button
                      type="button"
                      className="column__title"
                      onClick={() => setRenamingCol(column.id)}
                    >
                      {column.name}
                      <span className="column__count mono">{cards.length}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="tile-button column__delete"
                    aria-label={`Delete column ${column.name}`}
                    title="Delete column"
                    onClick={() => void run(() => api.deleteColumn(column.id))}
                  >
                    ×
                  </button>
                </div>

                {/*
                  No add button: double-clicking the empty space below the cards
                  creates one, the same gesture the Intake canvas uses.
                */}
                <div
                  className="column__cards"
                  onDoubleClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    onCreate({ laneId: lane.id, columnId: column.id });
                  }}
                >
                  {cards.map((task) => (
                    <Card
                      key={task.id}
                      task={task}
                      lane={lane}
                      onOpen={onOpen}
                      onCopy={onCopy}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="add-column"
            aria-label={`Add a column to ${lane.name}`}
            onClick={() => onAddColumn(lane.id)}
          >
            <span aria-hidden="true">+</span>
            <span className="add-column__label">Column</span>
          </button>
        </div>
      )}
    </section>
  );
}
