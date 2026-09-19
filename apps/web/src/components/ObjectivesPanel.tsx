import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import { api } from '../lib/api.ts';
import { objectiveStats, objectiveTree } from '../lib/derive.ts';
import { ActivityMap } from './ActivityMap.tsx';
import { HoldActions } from './HoldActions.tsx';
import { ArchiveIcon, PlusIcon, TrashIcon } from './icons.tsx';
import { NEW_OBJECTIVE_NAME, type Objective } from '@shared/types.ts';

/**
 * Objectives panel: a nested goal tree grouped under collapsible year roots, with
 * an editor pane that opens beside it.
 *
 * Roll-ups do **not** propagate up the tree: each row counts the cards that name that
 * objective and nothing else. Nesting ranks objectives; it does not pool their work.
 */
export function ObjectivesPanel({
  editingId,
  onEdit,
  onClose,
}: {
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onClose: () => void;
}) {
  const { board, run } = useBoard();
  const [collapsedYears, setCollapsedYears] = useState<Record<number, boolean>>({});
  // Which objective was just created, so its editor opens with the placeholder name
  // selected rather than merely focused.
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  if (!board) return null;

  const rows = objectiveTree(board.objectives);
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);

  const addObjective = async () => {
    const before = new Set(board.objectives.map((o) => o.id));
    await run(async () => {
      const next = await api.createObjective({
        name: NEW_OBJECTIVE_NAME,
        year: new Date().getFullYear(),
      });
      const created = next.objectives.find((o) => !before.has(o.id));
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
            <h2 className="panel__title">Objectives</h2>
          </div>
          <div className="panel__actions">
            <button
              type="button"
              className="panel__button"
              aria-label="New objective"
              title="New objective"
              onClick={() => void addObjective()}
            >
              <PlusIcon size={14} />
            </button>
            <button
              type="button"
              className="panel__button"
              aria-label="Collapse Objectives"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="panel__body">
          {rows.length === 0 && (
            <p className="panel__empty">
              No objectives yet. Use <strong>+</strong> to add the first one.
            </p>
          )}

          {years.map((year) => {
            const yearRows = rows.filter((r) => r.year === year);
            const open = !collapsedYears[year];
            return (
              <section key={year}>
                <button
                  type="button"
                  className="year-row"
                  aria-expanded={open}
                  onClick={() => setCollapsedYears((c) => ({ ...c, [year]: !c[year] }))}
                >
                  <span className="year-row__chevron mono" aria-hidden="true">
                    {open ? '▼' : '▶'}
                  </span>
                  <span className="year-row__year mono">{year}</span>
                  <span className="year-row__summary">
                    {yearRows.length} {yearRows.length === 1 ? 'objective' : 'objectives'}
                  </span>
                </button>

                {open &&
                  yearRows.map(({ objective, level }) => {
                    const stats = objectiveStats(board, objective.id);
                    const selected = editingId === objective.id;
                    return (
                      <div
                        key={objective.id}
                        className="obj-row"
                        data-selected={selected || undefined}
                        style={{ paddingLeft: 24 + level * 18 }}
                        role="button"
                        tabIndex={0}
                        onClick={() => onEdit(objective.id)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          e.preventDefault();
                          onEdit(objective.id);
                        }}
                      >
                        <div className="obj-row__head">
                          <span
                            className="obj-row__name"
                            style={{
                              fontSize: level === 0 ? 14 : 13,
                              fontWeight: level === 0 ? 700 : level === 1 ? 600 : 400,
                            }}
                          >
                            {objective.name}
                          </span>
                        </div>

                        {objective.measure && (
                          <p className="obj-row__measure">{objective.measure}</p>
                        )}

                        <ActivityMap cells={stats.heat} />

                        <div className="obj-row__counts">
                          <span>
                            <span className="mono">{stats.contributions}</span> contributions
                          </span>
                        </div>

                        {stats.outcomes.length > 0 && (
                          <div className="obj-row__outcomes">
                            {stats.outcomes.map((o) => (
                              <span key={o.id}>→ {o.name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </section>
            );
          })}
        </div>
      </div>

      {editingId && (
        <ObjectiveEditor
          /*
           * Keyed so switching objectives remounts the editor. Without it the name
           * state lags one render behind `id`, and the select-on-open effect selects
           * the *previous* objective's name — which the controlled value change then
           * wipes, leaving the field focused but unselected.
           */
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

/** Autosaves: selects commit on change, text fields on blur. No Save, no Cancel. */
function ObjectiveEditor({
  id,
  selectNameOnOpen = false,
  onClose,
}: {
  id: string;
  /** Set for an objective just created, so the first keystroke replaces the name. */
  selectNameOnOpen?: boolean;
  onClose: () => void;
}) {
  const { board, run } = useBoard();
  const objective = board?.objectives.find((o) => o.id === id);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(objective?.name ?? '');
  const [measure, setMeasure] = useState(objective?.measure ?? '');
  useEffect(() => setName(objective?.name ?? ''), [objective?.name]);
  useEffect(() => setMeasure(objective?.measure ?? ''), [objective?.measure]);

  // Select rather than focus: the name is a placeholder. Keyed on the objective so
  // opening a different new one reselects, but editing this one does not.
  useEffect(() => {
    if (!selectNameOnOpen) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [selectNameOnOpen, id]);

  if (!board || !objective) return null;

  const rows = objectiveTree(board.objectives);
  // An objective cannot be parented to itself or to one of its own descendants.
  const descendants = new Set(collectDescendants(board.objectives, id));
  const patch = (body: Record<string, unknown>) => run(() => api.updateObjective(id, body));

  // Direct only, like every other roll-up: a child's cards belong to the child.
  const cards = board.tasks.filter((t) => t.objectiveIds.includes(id));
  const reached = objectiveStats(board, id).outcomes;

  return (
    <div className="editor">
      <header className="editor__header">
        <h3 className="editor__title">Edit objective</h3>
        <div className="panel__actions">
          <HoldActions
            ariaLabel="Archive or delete this objective"
            actions={[
              {
                id: 'archive',
                label: 'Archive',
                icon: <ArchiveIcon size={13} />,
                onConfirm: () => {
                  void run(() => api.archiveObjective(id));
                  onClose();
                },
              },
              {
                id: 'delete',
                label: 'Delete',
                icon: <TrashIcon size={13} />,
                tone: 'danger',
                onConfirm: () => {
                  void run(() => api.deleteObjective(id));
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
            onBlur={() => name.trim() && name !== objective.name && void patch({ name: name.trim() })}
          />
        </label>

        <label className="editor__field">
          <span className="rail-label">Parent objective</span>
          <select
            className="editor__input"
            value={objective.parentId ?? ''}
            onChange={(e) => void patch({ parentId: e.target.value || null })}
          >
            <option value="">— top level —</option>
            {rows
              .filter((r) => r.objective.id !== id && !descendants.has(r.objective.id))
              .map((r) => (
                <option key={r.objective.id} value={r.objective.id}>
                  {'— '.repeat(r.level)}
                  {r.objective.name}
                </option>
              ))}
          </select>
        </label>

        <label className="editor__field">
          <span className="rail-label">Measure</span>
          <textarea
            className="editor__input editor__measure"
            value={measure}
            placeholder="How will you know this is met?"
            onChange={(e) => setMeasure(e.target.value)}
            onBlur={() => measure !== objective.measure && void patch({ measure })}
          />
        </label>

        <div className="editor__field">
          <div className="editor__field-head">
            <span className="rail-label">Working toward</span>
            <span className="link-col__count">
              <span className="mono">{reached.length}</span> · via cards
            </span>
          </div>
          {/*
            "Working toward", not "reached": this is a board of in-flight work, and a
            card naming both an objective and an outcome is a commitment, not a result.
            Read-only and derived — the link is made on the card, which is where the
            work that justifies it lives.
          */}
          <div className="link-list">
            {reached.map((outcome) => (
              <div key={outcome.id} className="link-row" data-checked>
                <span className="link-row__box" aria-hidden="true" />
                <span className="link-row__name">{outcome.name}</span>
              </div>
            ))}
            {reached.length === 0 && (
              <p className="link-list__empty">
                None yet. Link a card to this objective and to an outcome.
              </p>
            )}
          </div>
          <p className="editor__note">
            <span className="mono">{cards.length}</span>{' '}
            {cards.length === 1 ? 'card names' : 'cards name'} this objective.
          </p>
        </div>
      </div>
    </div>
  );
}

function collectDescendants(objectives: Objective[], id: string): string[] {
  const out: string[] = [];
  const queue = [id];
  while (queue.length) {
    const current = queue.pop()!;
    for (const child of objectives.filter((o) => o.parentId === current)) {
      out.push(child.id);
      queue.push(child.id);
    }
  }
  return out;
}
