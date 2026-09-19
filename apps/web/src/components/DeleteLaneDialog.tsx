import { useEffect, useRef, useState } from 'react';
import type { Lane } from '@shared/types.ts';

/**
 * Deleting a non-empty lane asks where its cards should go. Cards merge by column
 * name in the target lane, and any column the target lacks is recreated there, so
 * the structure survives the move.
 */
export function DeleteLaneDialog({
  lane,
  cardCount,
  lanes,
  onClose,
  onConfirm,
}: {
  lane: Lane;
  cardCount: number;
  lanes: Lane[];
  onClose: () => void;
  onConfirm: (target: string) => void;
}) {
  const [target, setTarget] = useState<string>(lanes[0]?.id ?? 'intake');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  if (cardCount === 0) {
    return (
      <Scrim onClose={onClose}>
        <div className="dialog" role="dialog" aria-modal="true" aria-label="Delete lane" ref={ref} tabIndex={-1}>
          <h2 className="dialog__title">Delete “{lane.name}”?</h2>
          <p className="dialog__body">The lane is empty. This cannot be undone.</p>
          <div className="dialog__actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="danger-button" onClick={() => onConfirm('intake')}>
              Delete lane
            </button>
          </div>
        </div>
      </Scrim>
    );
  }

  return (
    <Scrim onClose={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Delete lane" ref={ref} tabIndex={-1}>
        <h2 className="dialog__title">Delete “{lane.name}”?</h2>
        <p className="dialog__body">
          {cardCount} {cardCount === 1 ? 'card' : 'cards'} need somewhere to go. Cards merge by
          column name; a column the target lacks is recreated there.
        </p>

        <fieldset className="dialog__choices">
          <legend className="sr-only">Move cards to</legend>
          {lanes.map((l) => (
            <label key={l.id} className="dialog__choice">
              <input
                type="radio"
                name="target"
                value={l.id}
                checked={target === l.id}
                onChange={() => setTarget(l.id)}
              />
              <span>{l.name}</span>
            </label>
          ))}
          <label className="dialog__choice">
            <input
              type="radio"
              name="target"
              value="intake"
              checked={target === 'intake'}
              onChange={() => setTarget('intake')}
            />
            <span>Intake</span>
          </label>
        </fieldset>

        <div className="dialog__actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="danger-button" onClick={() => onConfirm(target)}>
            Move cards and delete
          </button>
        </div>
      </div>
    </Scrim>
  );
}

function Scrim({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {children}
    </div>
  );
}
