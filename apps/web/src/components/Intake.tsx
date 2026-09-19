import { useRef, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import { Card } from './Card.tsx';
import { ChevronDown, ChevronRight } from './icons.tsx';
import type { Task } from '@shared/types.ts';

const MIN_HEIGHT = 96;
const MAX_HEIGHT = 2400;

/**
 * Free-placement canvas for unsorted cards. Cards are absolutely positioned at
 * their stored x/y; double-clicking empty canvas creates one where you clicked.
 */
export function Intake({
  tasks,
  onOpen,
  onCopy,
  onCreate,
  onDragStart,
  onDropCard,
}: {
  tasks: Task[];
  onOpen: (taskId: string) => void;
  onCopy: (taskId: string) => void;
  onCreate: (input: Record<string, unknown>) => void;
  onDragStart: (task: Task, e: React.DragEvent) => void;
  onDropCard: (taskId: string, x: number, y: number) => void;
}) {
  const { board, patchSettings } = useBoard();
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null);

  const colWidth = board?.settings.colWidth ?? 360;
  const height = board?.settings.intakeHeight ?? 190;

  const pointFromEvent = (e: React.MouseEvent | React.DragEvent) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    // Scroll offset matters: the canvas scrolls independently of the page.
    return {
      x: Math.max(0, e.clientX - rect.left + el.scrollLeft),
      y: Math.max(0, e.clientY - rect.top + el.scrollTop),
    };
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startH: height };
    const move = (ev: PointerEvent) => {
      const next = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, resizeRef.current!.startH + ev.clientY - resizeRef.current!.startY),
      );
      void patchSettings({ intakeHeight: next });
    };
    const up = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <section className="intake" aria-label="Intake">
      <div className="intake__header">
        <button
          type="button"
          className="icon-button icon-button--sm"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand Intake' : 'Collapse Intake'}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="intake__title">Intake</span>
        <span className="intake__count mono">{tasks.length}</span>
      </div>

      {!collapsed && (
        <>
          <div
            ref={canvasRef}
            className="intake__canvas"
            data-over={dragOver || undefined}
            style={{ height }}
            onDoubleClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const { x, y } = pointFromEvent(e);
              onCreate({ laneId: null, columnId: null, x: Math.round(x), y: Math.round(y) });
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const id = e.dataTransfer.getData('text/task-id');
              if (!id) return;
              const { x, y } = pointFromEvent(e);
              const [dx = 0, dy = 0] = (e.dataTransfer.getData('text/grab-offset') || '0,0')
                .split(',')
                .map(Number);
              onDropCard(id, Math.round(Math.max(0, x - dx)), Math.round(Math.max(0, y - dy)));
            }}
          >
            {tasks.map((task) => (
              <Card
                key={task.id}
                task={task}
                lane={undefined}
                onOpen={onOpen}
                onCopy={onCopy}
                onDragStart={onDragStart}
                style={{
                  position: 'absolute',
                  left: task.x,
                  top: task.y,
                  width: colWidth - 20,
                  maxWidth: 'calc(100% - 32px)',
                }}
              />
            ))}
          </div>
          <div
            className="intake__resize"
            role="separator"
            aria-label="Resize intake"
            aria-orientation="horizontal"
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
              e.preventDefault();
              const delta = e.key === 'ArrowDown' ? 20 : -20;
              void patchSettings({
                intakeHeight: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height + delta)),
              });
            }}
          />
        </>
      )}
    </section>
  );
}
