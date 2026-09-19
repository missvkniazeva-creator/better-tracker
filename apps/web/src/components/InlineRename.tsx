import { useEffect, useRef } from 'react';

/**
 * Rename input per the handoff: text preselected on focus, Enter commits, Esc
 * cancels, blur commits.
 */
export function InlineRename({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="inline-rename"
      defaultValue={value}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(e.currentTarget.value.trim());
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelled.current = true;
          onCancel();
        }
      }}
      onBlur={(e) => {
        if (cancelled.current) return;
        onCommit(e.currentTarget.value.trim());
      }}
    />
  );
}
