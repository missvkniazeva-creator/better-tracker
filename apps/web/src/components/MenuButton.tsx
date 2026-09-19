import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CheckIcon } from './icons.tsx';

export interface MenuItem {
  id: string;
  label: string;
  /** Marked with a check — for a tool, that its view is the one open. */
  checked?: boolean;
  onSelect: () => void;
}

/**
 * A panel-header icon button that drops a small menu, right-aligned beneath it.
 *
 * The menu-button pattern: opening moves focus to the first item, arrow keys move
 * between items, Tab leaves, and Escape closes and hands focus back to the button. Escape
 * is stopped at the menu, or it would carry on into the app's own Escape order and
 * close whatever pane or panel is underneath. A press anywhere outside also closes it.
 */
export function MenuButton({
  label,
  icon,
  items,
}: {
  label: string;
  icon: ReactNode;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuItems(menuRef.current)[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    const all = menuItems(menuRef.current);
    const at = all.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      Home: 0,
      End: all.length - 1,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    // Wraps at both ends.
    all[(next + all.length) % all.length]?.focus();
  };

  return (
    <div className="menu-button" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="panel__button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
      </button>

      {open && (
        <div ref={menuRef} className="menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.checked ?? false}
              tabIndex={-1}
              className="menu__item"
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              {item.label}
              {item.checked && <CheckIcon size={12} className="menu__check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return [...(menu?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
}
