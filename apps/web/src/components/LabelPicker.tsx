import { useMemo, useRef, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import { api } from '../lib/api.ts';
import { labelColor } from '../lib/derive.ts';
import type { Label } from '@shared/types.ts';

/**
 * Tag-style label entry: the card's labels are chips you can remove, and one input
 * both searches the existing set and creates new ones.
 *
 * Typing filters to matching labels; Enter takes the highlighted suggestion, or
 * creates the typed name when nothing matches. That way the common case (reusing a
 * label) needs no decision about whether it exists yet.
 */
export function LabelPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { board, run } = useBoard();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = board?.labels ?? [];
  const selected = selectedIds
    .map((id) => all.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l));

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((l) => !selectedIds.includes(l.id))
      .filter((l) => !q || l.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [all, selectedIds, query]);

  const exact = all.find((l) => l.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim().length > 0 && !exact;
  // Suggestions appear only once something is typed: an idle field listing every
  // label would push the rail around and say nothing useful.
  const showMenu = query.trim().length > 0 && (suggestions.length > 0 || canCreate);

  const add = (label: Label) => {
    setQuery('');
    setActive(0);
    onChange([...selectedIds, label.id]);
  };


  /** Creates the typed label, then selects it through onChange. */
  const createThenSelect = async () => {
    const name = query.trim();
    if (!name) return;
    setQuery('');
    setActive(0);
    const before = new Set(all.map((l) => l.id));
    await run(async () => {
      const next = await api.createLabel(name);
      const created = next.labels.find((l) => !before.has(l.id) || l.name === name);
      if (created) onChange([...selectedIds, created.id]);
      return next;
    });
  };

  return (
    <div className="labels">
      <div className="labels__chips">
        {selected.map((label) => (
          <span
            key={label.id}
            className="labels__chip"
            style={{ '--chip-h': labelColor(label) } as React.CSSProperties}
          >
            {label.name}
            <button
              type="button"
              aria-label={`Remove ${label.name}`}
              onClick={() => onChange(selectedIds.filter((id) => id !== label.id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="labels__field">
        <input
          ref={inputRef}
          className="labels__input"
          value={query}
          placeholder={selected.length ? 'Add another…' : 'Add a label…'}
          aria-label="Add a label"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const highlighted = suggestions[active];
              if (highlighted) add(highlighted);
              else void createThenSelect();
            } else if (e.key === 'Escape' && query) {
              e.stopPropagation();
              setQuery('');
            }
          }}
        />

        {showMenu && (
          <ul className="labels__menu" role="listbox">
            {suggestions.map((label, i) => (
              <li key={label.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active || undefined}
                  onMouseEnter={() => setActive(i)}
                  // mousedown, not click: click would blur the input first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(label);
                  }}
                >
                  <span
                    className="labels__swatch"
                    style={{ '--chip-h': labelColor(label) } as React.CSSProperties}
                  />
                  {label.name}
                </button>
              </li>
            ))}
            {canCreate && (
              <li>
                <button
                  type="button"
                  className="labels__create"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void createThenSelect();
                  }}
                >
                  Create “{query.trim()}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

