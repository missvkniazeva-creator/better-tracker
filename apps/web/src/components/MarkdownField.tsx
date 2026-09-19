import { useEffect, useState } from 'react';
import { renderMarkdown } from '../lib/markdown.tsx';
import type { TaskImage } from '@shared/types.ts';

/**
 * Write / Preview pair. Text commits on blur, per the handoff's autosave rule.
 * `onPaste` is optional so only the description field accepts pasted screenshots.
 */
export function MarkdownField({
  label,
  value,
  images = [],
  placeholder,
  emptyPreview,
  rows = 6,
  onCommit,
  onPaste,
}: {
  label: string;
  value: string;
  images?: TaskImage[];
  placeholder?: string;
  emptyPreview?: string;
  rows?: number;
  onCommit: (next: string) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState(value);

  // Pasting an image rewrites the text server-side, so a new snapshot has to win over
  // the local draft. Snapshots only arrive in response to our own writes, so this
  // cannot interrupt typing.
  useEffect(() => setDraft(value), [value]);

  return (
    <section className="field">
      <div className="field__head">
        <h3 className="field__label">{label}</h3>
        <div className="segmented segmented--sm" role="group" aria-label={`${label} mode`}>
          <button
            type="button"
            data-active={!preview || undefined}
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
          >
            Write
          </button>
          <button
            type="button"
            data-active={preview || undefined}
            aria-pressed={preview}
            onClick={() => setPreview(true)}
          >
            Preview
          </button>
        </div>
      </div>

      {preview ? (
        <div className="markdown">
          {value.trim() ? (
            renderMarkdown(value, images)
          ) : (
            <p className="markdown__empty">{emptyPreview ?? 'Nothing yet.'}</p>
          )}
        </div>
      ) : (
        <textarea
          className="field__input"
          rows={rows}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== value && onCommit(draft)}
          onPaste={onPaste}
        />
      )}
    </section>
  );
}
