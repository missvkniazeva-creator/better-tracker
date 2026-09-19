import { ClockIcon, FlagIcon, TargetIcon } from './icons.tsx';

export type Tool = 'objectives' | 'outcomes' | 'log';

// Goal, result, then the Log: what happened. What came out of it — artefacts and
// values — is a tool inside the Log, read over the same period.
const TOOLS: { id: Tool; label: string; Icon: typeof TargetIcon }[] = [
  { id: 'objectives', label: 'Objectives', Icon: TargetIcon },
  { id: 'outcomes', label: 'Outcomes', Icon: FlagIcon },
  { id: 'log', label: 'Log', Icon: ClockIcon },
];

/** Clicking the active tool collapses the panel, as in the prototype. */
export function ActivityBar({
  tool,
  panelOpen,
  onSelect,
}: {
  tool: Tool;
  panelOpen: boolean;
  onSelect: (tool: Tool) => void;
}) {
  return (
    <nav className="activity-bar" aria-label="Panels">
      {TOOLS.map(({ id, label, Icon }) => {
        const active = panelOpen && tool === id;
        return (
          <button
            key={id}
            type="button"
            className="activity-bar__button"
            data-active={active || undefined}
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onSelect(id)}
          >
            <Icon size={19} />
          </button>
        );
      })}
    </nav>
  );
}
