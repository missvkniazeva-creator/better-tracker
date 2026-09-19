import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import { api } from '../lib/api.ts';
import { outcomeStats, shortDate, todayIso } from '../lib/derive.ts';
import { ActivityMap } from './ActivityMap.tsx';
import { HoldActions } from './HoldActions.tsx';
import { PlusIcon, TrashIcon } from './icons.tsx';
import { NEW_OUTCOME_NAME } from '@shared/types.ts';

/**
 * Outcomes panel: named results, each under the same day-granularity activity map the
 * Objectives panel uses, so the two lists can be read against each other.
 *
 * There is no share-of-the-busiest bar and no list of the objectives an outcome
 * supports: the bar ranked outcomes against each other, which is not what the panel is
 * for, and the objective links are already stated — and editable — in the editor pane.
 */
export function OutcomesPanel({
  editingId,
  onEdit,
  onClose,
}: {
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onClose: () => void;
}) {
  const { board, run } = useBoard();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  if (!board) return null;

  const addOutcome = async () => {
    const before = new Set(board.outcomes.map((o) => o.id));
    await run(async () => {
      const next = await api.createOutcome({ name: NEW_OUTCOME_NAME });
      const created = next.outcomes.find((o) => !before.has(o.id));
      if (created) {
        setJustCreatedId(created.id);
        onEdit(created.id);
      }
      return next;
    });
  };

  return (
    <>
      <div className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__rule" aria-hidden="true" />
            <h2 className="panel__title">Outcomes</h2>
          </div>
          <div className="panel__actions">
            <button
              type="button"
              className="panel__button"
              aria-label="New outcome"
              title="New outcome"
              onClick={() => void addOutcome()}
            >
              <PlusIcon size={14} />
            </button>
            <button
              type="button"
              className="panel__button"
              aria-label="Collapse Outcomes"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="panel__body">
          {board.outcomes.length === 0 && (
            <p className="panel__empty">
              No outcomes yet. Use <strong>+</strong> to name the first result.
            </p>
          )}

          {board.outcomes.map((outcome) => {
            const stats = outcomeStats(board, outcome.id);
            return (
              <div
                key={outcome.id}
                className="out-row"
                data-selected={editingId === outcome.id || undefined}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(outcome.id)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  onEdit(outcome.id);
                }}
              >
                <div className="out-row__head">
                  <span className="out-row__name">{outcome.name}</span>
                </div>

                {outcome.description && <p className="out-row__desc">{outcome.description}</p>}

                <ActivityMap cells={stats.heat} />

                <div className="out-row__foot">
                  <span>
                    <span className="mono">{stats.contributions}</span> contributions
                  </span>
                  <span className="mono">{formatOutcomeDate(outcome.date)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingId && (
        <OutcomeEditor
          key={editingId}
          id={editingId}
          selectNameOnOpen={justCreatedId === editingId}
          onClose={() => {
            setJustCreatedId(null);
            onEdit(null);
          }}
        />
      )}
    </>
  );
}

/** "Sep 5", suffixed "(target)" while the date is still ahead. */
export function formatOutcomeDate(date: string): string {
  if (!date) return '—';
  return date > todayIso() ? `${shortDate(date)} (target)` : shortDate(date);
}

function OutcomeEditor({
  id,
  selectNameOnOpen = false,
  onClose,
}: {
  id: string;
  selectNameOnOpen?: boolean;
  onClose: () => void;
}) {
  const { board, run } = useBoard();
  const outcome = board?.outcomes.find((o) => o.id === id);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(outcome?.name ?? '');
  const [description, setDescription] = useState(outcome?.description ?? '');
  useEffect(() => setName(outcome?.name ?? ''), [outcome?.name]);
  useEffect(() => setDescription(outcome?.description ?? ''), [outcome?.description]);
  useEffect(() => {
    if (!selectNameOnOpen) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [selectNameOnOpen, id]);

  if (!board || !outcome) return null;

  const patch = (body: Record<string, unknown>) => run(() => api.updateOutcome(id, body));

  return (
    <div className="editor">
      <header className="editor__header">
        <h3 className="editor__title">Edit outcome</h3>
        <div className="panel__actions">
          <HoldActions
            ariaLabel="Delete this outcome"
            actions={[
              {
                id: 'delete',
                label: 'Delete',
                icon: <TrashIcon size={13} />,
                tone: 'danger',
                onConfirm: () => {
                  void run(() => api.deleteOutcome(id));
                  onClose();
                },
              },
            ]}
          />
          <button type="button" className="panel__button" aria-label="Close editor" onClick={onClose}>
            ×
          </button>
        </div>
      </header>

      <div className="editor__body">
        <label className="editor__field">
          <span className="rail-label">Name</span>
          <input
            ref={nameRef}
            className="editor__input editor__input--name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== outcome.name && void patch({ name: name.trim() })}
          />
        </label>

        {/*
          No objective picker. An outcome reaches an objective through the cards that
          name both — pick the objectives on the card, where the work is, and this
          outcome shows up under them. A second, editable copy of that relation could
          disagree with the cards, and did.
        */}
        <label className="editor__field">
          <span className="rail-label">Date</span>
          <input
            type="date"
            className="editor__input mono"
            value={outcome.date}
            onChange={(e) => void patch({ date: e.target.value })}
          />
        </label>

        <label className="editor__field">
          <span className="rail-label">Description</span>
          <textarea
            className="editor__input editor__measure"
            value={description}
            placeholder="What was the result?"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== outcome.description && void patch({ description })}
          />
        </label>
      </div>
    </div>
  );
}
