import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api.ts';
import { EMPTY_FILTERS, type Filters } from '../lib/derive.ts';
import type { BoardSnapshot, Settings, Theme } from '@shared/types.ts';

interface BoardState {
  board: BoardSnapshot | null;
  error: string | null;
  loading: boolean;
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  /** Runs an API call and installs the snapshot it returns. */
  run: (call: () => Promise<BoardSnapshot>) => Promise<void>;
  reload: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
}

const Ctx = createContext<BoardState | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);

  const reload = useCallback(async () => {
    try {
      const next = await api.getBoard();
      setBoard(next);
      applyTheme(next.settings.theme);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(async (call: () => Promise<BoardSnapshot>) => {
    try {
      setBoard(await call());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      // The failed call may have half-applied; re-read rather than guess.
      try {
        setBoard(await api.getBoard());
      } catch {
        /* the error above is the one worth showing */
      }
    }
  }, []);

  const patchSettings = useCallback(async (patch: Partial<Settings>) => {
    // Settings are applied locally first: the theme toggle must not wait on a
    // round trip to repaint.
    setBoard((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev));
    if (patch.theme) applyTheme(patch.theme);
    try {
      await api.updateSettings(patch);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const setTheme = useCallback(
    (theme: Theme) => {
      void patchSettings({ theme });
    },
    [patchSettings],
  );

  const setFilters = useCallback((update: (f: Filters) => Filters) => {
    setFiltersState(update);
  }, []);

  const value = useMemo<BoardState>(
    () => ({ board, error, loading, filters, setFilters, run, reload, setTheme, patchSettings }),
    [board, error, loading, filters, setFilters, run, reload, setTheme, patchSettings],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoard(): BoardState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBoard must be used inside <BoardProvider>');
  return ctx;
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}
