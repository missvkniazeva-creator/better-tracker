import { useCallback, useEffect, useState } from 'react';
import { useBoard } from './state/store.tsx';
import { Header } from './components/Header.tsx';
import { FiltersBar } from './components/FiltersBar.tsx';
import { ActivityBar, type Tool } from './components/ActivityBar.tsx';
import { SidePanel } from './components/SidePanel.tsx';
import type { LogTool } from './components/LogPanel.tsx';
import { Board } from './components/Board.tsx';
import { CardModal } from './components/CardModal.tsx';

export function App() {
  const { loading, error, board } = useBoard();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tool, setTool] = useState<Tool>('objectives');
  const [panelOpen, setPanelOpen] = useState(false);
  const [openTask, setOpenTask] = useState<{ id: string; isNew: boolean } | null>(null);
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
  const [logTool, setLogTool] = useState<LogTool | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape order per the handoff: card modal, then the objective editor, then
      // the panel itself. The outcome editor and the Log's tool pane sit where the
      // objective editor does: a pane closes before its panel.
      if (openTask) setOpenTask(null);
      else if (editingObjectiveId) setEditingObjectiveId(null);
      else if (editingOutcomeId) setEditingOutcomeId(null);
      else if (logTool) setLogTool(null);
      else setPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTask, editingObjectiveId, editingOutcomeId, logTool]);

  const onVisibleCount = useCallback((n: number) => setVisibleCount(n), []);

  const selectTool = (next: Tool) => {
    if (panelOpen && tool === next) setPanelOpen(false);
    else {
      setTool(next);
      setPanelOpen(true);
    }
  };

  if (loading) return <p className="app-status">Loading board…</p>;
  if (error && !board) return <p className="app-status app-status--error">{error}</p>;

  return (
    <>
      {error && <p className="app-banner">{error}</p>}
      <Header
        filtersOpen={filtersOpen}
        visibleCount={visibleCount}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
      />
      {filtersOpen && <FiltersBar />}
      <div className="workspace">
        <ActivityBar tool={tool} panelOpen={panelOpen} onSelect={selectTool} />
        {panelOpen && (
          <SidePanel
            tool={tool}
            editingObjectiveId={editingObjectiveId}
            editingOutcomeId={editingOutcomeId}
            logTool={logTool}
            onEditObjective={setEditingObjectiveId}
            onEditOutcome={setEditingOutcomeId}
            onLogTool={setLogTool}
            onOpenTask={(id) => setOpenTask({ id, isNew: false })}
            onClose={() => setPanelOpen(false)}
          />
        )}
        <main className="workspace__board">
          <Board
            onOpenTask={(id, isNew = false) => setOpenTask({ id, isNew })}
            onVisibleCount={onVisibleCount}
          />
        </main>
      </div>
      {openTask && (
        <CardModal
          key={openTask.id}
          taskId={openTask.id}
          selectTitleOnOpen={openTask.isNew}
          onClose={() => setOpenTask(null)}
        />
      )}
    </>
  );
}
