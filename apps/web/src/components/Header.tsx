import { useBoard } from '../state/store.tsx';
import { filterCount, weekStamp } from '../lib/derive.ts';
import { FilterIcon, MoonIcon, SearchIcon, SunIcon } from './icons.tsx';

export function Header({
  filtersOpen,
  visibleCount,
  onToggleFilters,
}: {
  filtersOpen: boolean;
  visibleCount: number;
  onToggleFilters: () => void;
}) {
  const { board, filters, setFilters, setTheme } = useBoard();
  const theme = board?.settings.theme ?? 'light';
  const active = filterCount(filters);

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__wordmark">Better Tracker</span>
        <span className="app-header__week mono">{weekStamp(new Date())}</span>
        <span className="app-header__count mono" aria-live="polite">
          {visibleCount} {visibleCount === 1 ? 'card' : 'cards'}
        </span>
      </div>

      <div className="app-header__search">
        <label className="search-field">
          <SearchIcon size={16} />
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search tasks, obstacles, activity…"
          />
        </label>
      </div>

      <div className="app-header__actions">
        <button
          type="button"
          className="chip-button"
          aria-expanded={filtersOpen}
          onClick={onToggleFilters}
        >
          <FilterIcon size={14} />
          Filters
          {active > 0 && <span className="chip-button__count mono">{active}</span>}
        </button>

        <button
          type="button"
          className="icon-button"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
        </button>
      </div>
    </header>
  );
}
