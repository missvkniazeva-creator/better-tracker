import { useRef, useState, type ReactNode } from 'react';

const HOLD_MS = 2000;

export interface HoldAction {
  id: string;
  label: string;
  icon?: ReactNode;
  /** 'danger' is for irreversible actions; it fills solid rather than tinting. */
  tone?: 'neutral' | 'danger';
  onConfirm: () => void;
}

/**
 * A grouped selector where each option must be **held** for two seconds to fire —
 * a fill sweeps the button over 2000ms and snaps back over 140ms if released early.
 *
 * Both destructive paths live here side by side rather than one being hidden behind
 * a dialog: archiving and deleting differ enough that the choice should be visible,
 * and neither should be a single click.
 *
 * The handoff's accessibility notes call for a keyboard path, since a pointer hold
 * has no keyboard equivalent — Enter or Space arms a two-step confirm instead.
 */
export function HoldActions({
  actions,
  ariaLabel,
}: {
  actions: HoldAction[];
  ariaLabel: string;
}) {
  const [holding, setHolding] = useState<string | null>(null);
  const [arming, setArming] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(null);
  };

  const start = (action: HoldAction) => {
    setArming(null);
    setHolding(action.id);
    timer.current = setTimeout(() => {
      cancel();
      action.onConfirm();
    }, HOLD_MS);
  };

  return (
    <div className="hold-actions" role="group" aria-label={ariaLabel}>
      {actions.map((action) => {
        const tone = action.tone ?? 'neutral';
        const isArming = arming === action.id;
        return (
          <button
            key={action.id}
            type="button"
            className="hold-actions__button"
            data-tone={tone}
            data-holding={holding === action.id || undefined}
            data-arming={isArming || undefined}
            title={`Hold 2s to ${action.label.toLowerCase()}`}
            onPointerDown={() => start(action)}
            onPointerUp={cancel}
            onPointerLeave={cancel}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (isArming) {
                setArming(null);
                action.onConfirm();
              } else {
                setArming(action.id);
              }
            }}
            onBlur={() => setArming((id) => (id === action.id ? null : id))}
          >
            <span className="hold-actions__fill" aria-hidden="true" />
            {action.icon && <span className="hold-actions__icon">{action.icon}</span>}
            <span className="hold-actions__label">
              {isArming ? 'Press again' : holding === action.id ? 'Hold…' : action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
