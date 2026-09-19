import { useState } from 'react';
import { useBoard } from '../state/store.tsx';
import { api } from '../lib/api.ts';
import { labelColor, objectiveTree } from '../lib/derive.ts';
import {
  AlertTriangle,
  CheckIcon,
  ChevronsDown,
  ChevronsRight,
  ChevronsUp,
  PencilIcon,
} from './icons.tsx';
import { LABEL_HUES, type Priority } from '@shared/types.ts';

// Low to high, matching the card modal's control.
// Low to high, matching the card modal's control. The glyph colours match the marks
// on the cards, so the filter and the thing it filters read the same.
const PRIORITIES: { id: Priority; Glyph: typeof ChevronsUp }[] = [
  { id: 'P3', Glyph: ChevronsDown },
  { id: 'P2', Glyph: ChevronsRight },
  { id: 'P1', Glyph: ChevronsUp },
];

/**
 * Every group is multiselect, and groups combine with AND. The result count is
 * announced with aria-live, which the handoff lists as an outstanding item.
 *
 * Labels have an edit mode here because this is the only place the whole set is
 * visible — renaming and deleting belong where you can see them all at once.
 */
export function FiltersBar() {
  const { board, run, filters, setFilters } = useBoard();
  const [editingLabels, setEditingLabels] = useState(false);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  if (!board) return null;

  const toggle = (key: 'labelIds' | 'priorities' | 'objectiveIds', id: string) =>
    setFilters((f) => {
      const next = new Set(f[key]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...f, [key]: next };
    });

  const addLabel = () => {
    const name = draft.trim();
    if (!name) return;
    setDraft('');
    void run(() => api.createLabel(name));
  };

  return (
    <div className="filters-bar">
      <div className="filters-group">
        <span className="filters-group__title">Labels</span>
        {board.labels.map((label) => {
          const hue = { '--chip-h': labelColor(label) } as React.CSSProperties;
          if (editingLabels) {
            return (
              <span key={label.id} className="label-edit" style={hue}>
                <button
                  type="button"
                  className="label-edit__swatch"
                  aria-label={`Colour for ${label.name}`}
                  aria-expanded={paletteFor === label.id}
                  title="Choose a colour"
                  onClick={() => setPaletteFor((id) => (id === label.id ? null : label.id))}
                />
                {paletteFor === label.id && (
                  <div className="palette" role="group" aria-label={`Colour for ${label.name}`}>
                    {LABEL_HUES.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className="palette__swatch"
                        style={{ '--chip-h': h } as React.CSSProperties}
                        data-current={label.hue === h || undefined}
                        aria-label={`Hue ${h}`}
                        onClick={() => {
                          setPaletteFor(null);
                          void run(() => api.updateLabel(label.id, { hue: h }));
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      className="palette__auto"
                      data-current={label.hue === null || undefined}
                      onClick={() => {
                        setPaletteFor(null);
                        void run(() => api.updateLabel(label.id, { hue: null }));
                      }}
                    >
                      Auto
                    </button>
                  </div>
                )}
                <input
                  className="label-edit__input"
                  defaultValue={label.name}
                  aria-label={`Rename ${label.name}`}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== label.name)
                      void run(() => api.updateLabel(label.id, { name }));
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <button
                  type="button"
                  className="label-edit__remove"
                  aria-label={`Delete label ${label.name}`}
                  title="Delete label"
                  onClick={() => void run(() => api.deleteLabel(label.id))}
                >
                  ×
                </button>
              </span>
            );
          }
          return (
            <button
              key={label.id}
              type="button"
              className="label-chip"
              data-active={filters.labelIds.has(label.id) || undefined}
              style={hue}
              aria-pressed={filters.labelIds.has(label.id)}
              onClick={() => toggle('labelIds', label.id)}
            >
              {label.name}
            </button>
          );
        })}

        {editingLabels && (
          <input
            className="label-new"
            value={draft}
            placeholder="New label ↵"
            aria-label="New label"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              addLabel();
            }}
            onBlur={addLabel}
          />
        )}

        <button
          type="button"
          className="filters-edit"
          aria-pressed={editingLabels}
          aria-label={editingLabels ? 'Finish editing labels' : 'Edit labels'}
          title={editingLabels ? 'Finish editing labels' : 'Edit labels'}
          onClick={() => {
            setPaletteFor(null);
            setEditingLabels((e) => !e);
          }}
        >
          {editingLabels ? <CheckIcon size={13} /> : <PencilIcon size={13} />}
        </button>
      </div>

      <div className="filters-group">
        <span className="filters-group__title">Priority</span>
        {PRIORITIES.map(({ id, Glyph }) => (
          <button
            key={id}
            type="button"
            className="prio-chip mono"
            data-prio={id}
            data-active={filters.priorities.has(id) || undefined}
            aria-pressed={filters.priorities.has(id)}
            onClick={() => toggle('priorities', id)}
          >
            <span className="chip-glyph">
              <Glyph size={12} />
            </span>
            {id}
          </button>
        ))}
      </div>

      <div className="filters-group">
        <span className="filters-group__title">Flags</span>
        <button
          type="button"
          className="flag-chip flag-chip--icon"
          data-active={filters.obstaclesOnly || undefined}
          aria-pressed={filters.obstaclesOnly}
          aria-label="Only cards with obstacles"
          title="Only cards with obstacles"
          onClick={() => setFilters((f) => ({ ...f, obstaclesOnly: !f.obstaclesOnly }))}
        >
          <span className="chip-glyph" data-tone="danger">
            <AlertTriangle size={14} />
          </span>
        </button>
        <button
          type="button"
          className="flag-chip"
          data-active={filters.highSeverityOnly || undefined}
          aria-pressed={filters.highSeverityOnly}
          onClick={() => setFilters((f) => ({ ...f, highSeverityOnly: !f.highSeverityOnly }))}
        >
          <span className="chip-glyph" data-tone="danger" aria-hidden="true">
            ▲
          </span>{' '}
          Severity high
        </button>
      </div>

      {objectiveTree(board.objectives).length > 0 && (
        <div className="filters-group filters-group--row">
          <span className="filters-group__title">Objectives</span>
          {objectiveTree(board.objectives).map(({ objective: o }) => (
            <button
              key={o.id}
              type="button"
              className="filter-chip"
              data-active={filters.objectiveIds.has(o.id) || undefined}
              aria-pressed={filters.objectiveIds.has(o.id)}
              onClick={() => toggle('objectiveIds', o.id)}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
