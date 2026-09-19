import { useEffect, useMemo, useRef, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import { api } from '../lib/api.ts';
import { objectiveTree, shortDate, todayIso } from '../lib/derive.ts';
import { parseNote } from '@shared/parse.ts';
import { renderInlineMarkdown, renderMarkdown } from '../lib/markdown.tsx';
import { handleMarkdownShortcut } from '../lib/markdownKeys.ts';
import { TokenSuggestList, useTokenSuggest } from './TokenSuggest.tsx';
import { HoldActions } from './HoldActions.tsx';
import { LabelPicker } from './LabelPicker.tsx';
import {
  AlertTriangle,
  ArchiveIcon,
  ChevronsDown,
  ChevronsRight,
  ChevronsUp,
  CopyIcon,
  PencilIcon,
  FocusIcon,
  LayersIcon,
  PhoneIcon,
  TrashIcon,
  UsersIcon,
} from './icons.tsx';
import type { LogType, Priority, Severity, Task } from '@shared/types.ts';

// Low to high, so it reads the same direction as the severity control beside it.
const PRIORITIES: { id: Priority; Glyph: typeof ChevronsUp; color: string }[] = [
  { id: 'P3', Glyph: ChevronsDown, color: 'var(--ink3)' },
  { id: 'P2', Glyph: ChevronsRight, color: 'var(--warn)' },
  { id: 'P1', Glyph: ChevronsUp, color: 'var(--danger)' },
];

const SEVERITIES: { id: Severity; glyph: string }[] = [
  { id: 'Low', glyph: '▼' },
  { id: 'Medium', glyph: '—' },
  { id: 'High', glyph: '▲' },
];

const LOG_TYPES: { id: LogType; Icon: typeof FocusIcon }[] = [
  { id: 'Call', Icon: PhoneIcon },
  { id: 'Meeting', Icon: UsersIcon },
  { id: 'Focus', Icon: FocusIcon },
  { id: 'Multitasking', Icon: LayersIcon },
];

/**
 * The card editor, laid out as the handoff specifies: a 1040px dialog with the
 * writing surface on the left and priority/severity/dateline/labels in a 300px
 * rail, objectives and outcomes in two columns beneath, and the activity log last.
 *
 * Everything autosaves — selects and toggles on change, text on blur.
 */
export function CardModal({
  taskId,
  selectTitleOnOpen = false,
  onClose,
}: {
  taskId: string;
  /** Set for a card that was just created, so typing replaces the placeholder title. */
  selectTitleOnOpen?: boolean;
  onClose: () => void;
}) {
  const { board, run } = useBoard();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const task = board?.tasks.find((t) => t.id === taskId);

  const [title, setTitle] = useState(task?.title ?? '');
  useEffect(() => setTitle(task?.title ?? ''), [task?.title]);

  // Select rather than merely focus: the title is a placeholder, so the first
  // keystroke should replace it outright. Runs once — reselecting after every edit
  // would fight the user mid-sentence.
  useEffect(() => {
    if (!selectTitleOnOpen) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [selectTitleOnOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // This listener sits on the dialog element, so it runs before React's delegated
      // handlers further up — including the composer's. When the artefact/value list
      // is open, Escape belongs to it: leave the event alone and let it close.
      if (dialogRef.current?.querySelector('.suggest')) return;
      e.stopPropagation();
      onClose();
    };
    const node = dialogRef.current;
    node?.addEventListener('keydown', onKey);
    return () => node?.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!board || !task) return null;

  const lane = board.lanes.find((l) => l.id === task.laneId);
  const patch = (body: Record<string, unknown>) => run(() => api.updateTask(task.id, body));
  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const move = (laneId: string | null, columnId: string | null) =>
    void run(() => api.moveTask(task.id, { laneId, columnId, x: task.x, y: task.y }));

  return (
    <div className="scrim scrim--modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={task.title || 'Untitled card'}
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="modal__header">
          {/*
            The design shows the lane as a static crumb. It is a select here so a card
            can be filed without dragging — the handoff's accessibility notes ask for a
            keyboard equivalent to every drag interaction, and this is the only one.
          */}
          <select
            className="modal__lane"
            aria-label="Lane"
            value={task.laneId ?? ''}
            onChange={(e) => {
              const laneId = e.target.value || null;
              const target = board.lanes.find((l) => l.id === laneId);
              move(laneId, target?.columns[0]?.id ?? null);
            }}
          >
            <option value="">Intake</option>
            {board.lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <div className="state-segs" role="group" aria-label="State">
            {(lane
              ? lane.columns.map((c) => ({ id: c.id as string | null, name: c.name }))
              : [{ id: null, name: 'Intake' }]
            ).map((option) => (
              <button
                key={option.id ?? 'intake'}
                type="button"
                data-active={task.columnId === option.id || undefined}
                aria-pressed={task.columnId === option.id}
                onClick={() => move(task.laneId, option.id)}
              >
                {option.name}
              </button>
            ))}
          </div>

          <div className="modal__header-actions">
            <button
              type="button"
              className="mini-button"
              title="Duplicate this card (or Option-click it on the board)"
              onClick={() => void run(() => api.copyTask(task.id))}
            >
              <CopyIcon size={13} /> Copy
            </button>
            <HoldActions
              ariaLabel="Archive or delete this card"
              actions={[
                {
                  id: 'archive',
                  label: task.archived ? 'Unarchive' : 'Archive',
                  icon: <ArchiveIcon size={13} />,
                  onConfirm: () => {
                    void patch({ archived: !task.archived });
                    onClose();
                  },
                },
                {
                  id: 'delete',
                  label: 'Delete',
                  icon: <TrashIcon size={13} />,
                  tone: 'danger',
                  onConfirm: () => {
                    void run(() => api.deleteTask(task.id));
                    onClose();
                  },
                },
              ]}
            />
            <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="modal__main">
          <div className="modal__write">
            <input
              ref={titleRef}
              className="modal__title"
              value={title}
              placeholder="Card title"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== task.title && void patch({ title })}
              onKeyDown={(e) => {
                if (handleMarkdownShortcut(e, setTitle)) return;
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />

            <TextBlock
              label="Description"
              value={task.description}
              images={task.images}
              rows={7}
              placeholder="What this task is, in markdown. Paste an image to attach it."
              onCommit={(description) => void patch({ description })}
              onPasteImage={async (file, caret) => {
                const bytes = new Uint8Array(await file.arrayBuffer());
                let binary = '';
                for (const byte of bytes) binary += String.fromCharCode(byte);
                const name = file.name || 'pasted image';
                await run(async () => {
                  const next = await api.addImage(task.id, {
                    name,
                    mime: file.type,
                    dataBase64: btoa(binary),
                  });
                  const image = next.tasks.find((t) => t.id === task.id)?.images.at(-1);
                  if (!image) return next;
                  const text = task.description;
                  return api.updateTask(task.id, {
                    description: `${text.slice(0, caret)}![${name}](${image.id})${text.slice(caret)}`,
                  });
                });
              }}
              thumbs={task.images.map((image) => ({
                ...image,
                onRemove: () =>
                  void run(async () => {
                    await api.deleteImage(image.id);
                    return api.updateTask(task.id, {
                      description: task.description
                        .replace(new RegExp(`!\\[[^\\]]*\\]\\(${image.id}\\)\\n?`, 'g'), '')
                        .trim(),
                    });
                  }),
              }))}
            />

            <TextBlock
              label="Obstacles"
              danger
              value={task.obstacles}
              rows={4}
              placeholder="What blocks this task, in markdown."
              onCommit={(obstacles) => void patch({ obstacles })}
            />
          </div>

          <aside className="modal__rail">
            <div className="rail-group">
              <SlidingSegments
                ariaLabel="Priority"
                index={PRIORITIES.findIndex((p) => p.id === task.priority)}
                count={PRIORITIES.length}
              >
                {PRIORITIES.map(({ id, Glyph, color }) => (
                  <button
                    key={id}
                    type="button"
                    className="mono"
                    data-active={task.priority === id || undefined}
                    aria-pressed={task.priority === id}
                    style={{ color: task.priority === id ? 'var(--on-ink)' : color }}
                    onClick={() => void patch({ priority: id })}
                  >
                    <Glyph size={12} />
                    {id}
                  </button>
                ))}
              </SlidingSegments>

              <SlidingSegments
                ariaLabel="Severity"
                index={SEVERITIES.findIndex((s) => s.id === task.severity)}
                count={SEVERITIES.length}
              >
                {SEVERITIES.map(({ id, glyph }) => (
                  <button
                    key={id}
                    type="button"
                    data-active={task.severity === id || undefined}
                    aria-pressed={task.severity === id}
                    onClick={() => void patch({ severity: id })}
                  >
                    <span aria-hidden="true">{glyph}</span>
                    {id}
                  </button>
                ))}
              </SlidingSegments>
            </div>

            <div className="rail-group">
              <label className="rail-label" htmlFor="dateline">
                Dateline
              </label>
              <input
                id="dateline"
                type="date"
                className="rail-date mono"
                value={task.dateline}
                onChange={(e) => void patch({ dateline: e.target.value })}
              />
            </div>

            <div className="rail-group">
              <span className="rail-label">Labels</span>
              <LabelPicker
                selectedIds={task.labelIds}
                onChange={(labelIds) => void patch({ labelIds })}
              />
            </div>
          </aside>
        </div>

        <div className="modal__links">
          <section className="link-col">
            <div className="link-col__head">
              <span className="rail-label">Objectives</span>
              <span className="link-col__count">
                <span className="mono">{task.objectiveIds.length}</span> linked · multi-select
              </span>
            </div>
            <div className="link-list">
              {/*
                Tree order, not board order: indentation alone is ambiguous, because a
                child listed after an unrelated root reads as that root's child.
              */}
              {objectiveTree(board.objectives)
                .map(({ objective, level }) => {
                  const checked = task.objectiveIds.includes(objective.id);
                  return (
                    <button
                      key={objective.id}
                      type="button"
                      className="link-row"
                      data-checked={checked || undefined}
                      aria-pressed={checked}
                      style={{ paddingLeft: 10 + level * 16 }}
                      onClick={() =>
                        void patch({ objectiveIds: toggleIn(task.objectiveIds, objective.id) })
                      }
                    >
                      <span className="link-row__box" aria-hidden="true" />
                      <span className="link-row__name" style={{ fontWeight: level === 0 ? 600 : 400 }}>
                        {objective.name}
                      </span>
                    </button>
                  );
                })}
              {objectiveTree(board.objectives).length === 0 && (
                <p className="link-list__empty">No objectives yet.</p>
              )}
            </div>
          </section>

          <section className="link-col link-col--last">
            <div className="link-col__head">
              <span className="rail-label">Outcomes</span>
              <span className="link-col__count">
                <span className="mono">{task.outcomeIds.length}</span> linked · multi-select
              </span>
            </div>
            <div className="link-list">
              {board.outcomes.map((outcome) => {
                const checked = task.outcomeIds.includes(outcome.id);
                return (
                  <button
                    key={outcome.id}
                    type="button"
                    className="link-row"
                    data-checked={checked || undefined}
                    aria-pressed={checked}
                    onClick={() =>
                      void patch({ outcomeIds: toggleIn(task.outcomeIds, outcome.id) })
                    }
                  >
                    <span className="link-row__box" aria-hidden="true" />
                    <span className="link-row__name">{outcome.name}</span>
                  </button>
                );
              })}
              {board.outcomes.length === 0 && <p className="link-list__empty">No outcomes yet.</p>}
            </div>
          </section>
        </div>

        <ActivityLog task={task} />
      </div>
    </div>
  );
}

/** Track with a thumb that slides to the active option. */
function SlidingSegments({
  ariaLabel,
  index,
  count,
  children,
}: {
  ariaLabel: string;
  index: number;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="sliding"
      role="group"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}
    >
      <span
        className="sliding__thumb"
        aria-hidden="true"
        style={{
          width: `calc((100% - 4px) / ${count})`,
          transform: `translateX(${Math.max(0, index) * 100}%)`,
        }}
      />
      {children}
    </div>
  );
}


function TextBlock({
  label,
  value,
  rows,
  placeholder,
  danger,
  images = [],
  thumbs = [],
  onCommit,
  onPasteImage,
}: {
  label: string;
  value: string;
  rows: number;
  placeholder: string;
  danger?: boolean;
  images?: Task['images'];
  thumbs?: (Task['images'][number] & { onRemove: () => void })[];
  onCommit: (next: string) => void;
  onPasteImage?: (file: File, caret: number) => void;
}) {
  const [preview, setPreview] = useState(Boolean(value));
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [focusOnEdit, setFocusOnEdit] = useState(false);
  useEffect(() => setDraft(value), [value]);

  // Double-clicking the rendered text switches to Write and puts the caret in it,
  // so reading and correcting are one gesture apart.
  useEffect(() => {
    if (preview || !focusOnEdit) return;
    setFocusOnEdit(false);
    const node = inputRef.current;
    node?.focus();
    node?.setSelectionRange(node.value.length, node.value.length);
  }, [preview, focusOnEdit]);

  return (
    <section className="block">
      <div className="block__head">
        <span className="rail-label" data-danger={danger || undefined}>
          {danger && <AlertTriangle size={14} />}
          {label}
        </span>
        <div className="block__modes">
          <button
            type="button"
            className="mode-chip"
            data-active={!preview || undefined}
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
          >
            Write
          </button>
          <button
            type="button"
            className="mode-chip"
            data-active={preview || undefined}
            aria-pressed={preview}
            onClick={() => setPreview(true)}
          >
            Preview
          </button>
        </div>
      </div>

      {preview ? (
        <div
          className={`block__preview markdown${danger ? ' block__preview--short' : ''}`}
          title="Double-click to edit"
          onDoubleClick={() => {
            setFocusOnEdit(true);
            setPreview(false);
          }}
        >
          {value.trim() ? (
            renderMarkdown(value, images)
          ) : (
            <p className="markdown__empty">
              {danger ? 'Nothing blocking.' : 'No description.'}
            </p>
          )}
        </div>
      ) : (
        <>
          <textarea
            ref={inputRef}
            className={`block__input${danger ? ' block__input--obstacles' : ''}`}
            rows={rows}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => handleMarkdownShortcut(e, setDraft)}
            onBlur={() => draft !== value && onCommit(draft)}
            onPaste={(e) => {
              if (!onPasteImage) return;
              const file = [...e.clipboardData.items]
                .find((i) => i.kind === 'file' && i.type.startsWith('image/'))
                ?.getAsFile();
              if (!file) return;
              e.preventDefault();
              onPasteImage(file, e.currentTarget.selectionStart ?? value.length);
            }}
          />
          {thumbs.length > 0 && (
            <div className="thumbs">
              {thumbs.map((image) => (
                <div key={image.id} className="thumbs__item" title={image.name}>
                  <img src={image.url} alt={image.name} />
                  <button type="button" aria-label={`Remove ${image.name}`} onClick={image.onRemove}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ActivityLog({ task }: { task: Task }) {
  const { board, run } = useBoard();
  const [type, setType] = useState<LogType>('Focus');
  const [note, setNote] = useState('');
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(todayIso());
  // A new entry starts attributed to everything the card supports: logging work is
  // the common case, and attributing it is what makes the roll-ups mean anything.
  // Unticking is the exception, so it is the thing that costs a click.
  const [outcomeIds, setOutcomeIds] = useState<string[]>(task.outcomeIds);
  const [touchedOutcomes, setTouchedOutcomes] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Follow the card's outcomes while composing, until the user opts out of one —
  // after that the selection is theirs and is left alone.
  const taskOutcomeKey = task.outcomeIds.join(',');
  useEffect(() => {
    if (editingId || touchedOutcomes) return;
    setOutcomeIds(taskOutcomeKey ? taskOutcomeKey.split(',') : []);
  }, [taskOutcomeKey, editingId, touchedOutcomes]);

  const parsed = useMemo(() => parseNote(note), [note]);

  // Completion pool: everything this card has already produced. Built from the saved
  // entries rather than the composer, so a name only becomes suggestible once it has
  // actually been logged once.
  const history = useMemo(() => {
    const unique = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
    return {
      artefacts: unique(task.log.flatMap((e) => e.artefacts)),
      values: unique(task.log.flatMap((e) => e.values)),
    };
  }, [task.log]);

  const suggest = useTokenSuggest({
    value: note,
    onChange: setNote,
    artefacts: history.artefacts,
    values: history.values,
    fieldRef: noteRef,
  });
  const linked = board?.outcomes.filter((o) => task.outcomeIds.includes(o.id)) ?? [];
  const outcomeName = (id: string) => board?.outcomes.find((o) => o.id === id)?.name ?? id;
  const attributed = task.log.filter((e) => e.outcomeIds.length > 0).length;

  const reset = () => {
    setEditingId(null);
    setNote('');
    setHours('');
    setOutcomeIds(task.outcomeIds);
    setTouchedOutcomes(false);
    setType('Focus');
    setDate(todayIso());
  };

  const submit = () => {
    if (!note.trim()) return;
    const body = {
      date,
      type,
      note: note.trim(),
      outcomeIds,
      ...(hours.trim() ? { hours: Number(hours) } : {}),
    };
    void run(() =>
      editingId ? api.updateLogEntry(editingId, body) : api.addLogEntry(task.id, body),
    );
    reset();
  };

  /**
   * Load an entry back into the composer.
   *
   * The stored note is prose — the artefact and value lines were lifted out when it
   * was saved — so they are put back as `!`/`+` lines. Editing then round-trips
   * through the same parser that wrote them.
   */
  const edit = (entry: Task['log'][number]) => {
    setEditingId(entry.id);
    setType(entry.type);
    setDate(entry.date);
    setHours(String(entry.hours));
    setOutcomeIds(entry.outcomeIds);
    setTouchedOutcomes(true);
    setNote(
      [entry.note, ...entry.artefacts.map((a) => `!${a}`), ...entry.values.map((v) => `+${v}`)]
        .filter(Boolean)
        .join('\n'),
    );
    noteRef.current?.focus();
  };

  return (
    <section className="modal__log">
      <div className="modal__log-head">
        <span className="rail-label">Activity log</span>
        <span className="modal__log-count">
          <span className="mono">{task.log.length}</span> entries ·{' '}
          <span className="mono modal__log-attr">{attributed}</span> attributed to an outcome
        </span>
      </div>

      <div className="composer">
        <div className="composer__row">
          {LOG_TYPES.map(({ id, Icon }) => (
            <button
              key={id}
              type="button"
              className="type-chip"
              data-active={type === id || undefined}
              aria-pressed={type === id}
              onClick={() => setType(id)}
            >
              <Icon size={14} />
              {id}
            </button>
          ))}
          <div className="composer__hours">
            <input
              type="date"
              className="rail-date mono"
              value={date}
              aria-label="Entry date"
              onChange={(e) => setDate(e.target.value)}
            />
            <span className="rail-label">Hours</span>
            <input
              className="composer__hours-input mono"
              inputMode="decimal"
              aria-label="Hours"
              value={hours}
              placeholder="—"
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
        </div>

        <div className="composer__note-wrap">
          <textarea
            ref={noteRef}
            className="block__input composer__note"
            rows={4}
            value={note}
            placeholder={'What happened?\n!Artefact produced\n+Value produced\nReviewed with @person'}
            onChange={(e) => {
              setNote(e.target.value);
              suggest.refresh(e.currentTarget);
            }}
            onSelect={(e) => suggest.refresh(e.currentTarget)}
            onBlur={suggest.close}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                submit();
                return;
              }
              if (suggest.handleKeyDown(e)) return;
              handleMarkdownShortcut(e, setNote);
            }}
          />
          <TokenSuggestList suggest={suggest} />
        </div>

        <div className="composer__attrib">
          <span className="rail-label">Contributes to</span>
          {linked.length === 0 ? (
            <span className="composer__none">No outcomes linked to this task yet.</span>
          ) : (
            linked.map((outcome) => (
              <button
                key={outcome.id}
                type="button"
                className="outcome-chip"
                data-active={outcomeIds.includes(outcome.id) || undefined}
                aria-pressed={outcomeIds.includes(outcome.id)}
                onClick={() => {
                  setTouchedOutcomes(true);
                  setOutcomeIds((ids) =>
                    ids.includes(outcome.id)
                      ? ids.filter((x) => x !== outcome.id)
                      : [...ids, outcome.id],
                  );
                }}
              >
                → {outcome.name}
              </button>
            ))
          )}

          <div className="composer__actions">
            {editingId && (
              <button type="button" className="mini-button" onClick={reset}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="primary-button composer__submit"
              onClick={submit}
              disabled={!note.trim()}
            >
              {editingId ? 'Save entry' : 'Log entry'}
            </button>
          </div>
        </div>

        <div className="composer__foot">
          {parsed.artefacts.map((a) => (
            <span key={a} className="token token--artefact">
              <span className="token__kind">Artefact</span>
              {a}
            </span>
          ))}
          {parsed.values.map((v) => (
            <span key={v} className="token token--value">
              <span className="token__kind">Value</span>
              {v}
            </span>
          ))}
          {parsed.people.map((p) => (
            <span key={p} className="token token--person">
              @{p}
            </span>
          ))}
        </div>
      </div>

      <div className="entries">
        {task.log.map((entry) => (
          <div key={entry.id} className="entry" data-editing={editingId === entry.id || undefined}>
            <span className="entry__date mono">{shortDate(entry.date)}</span>
            <span className="entry__type">{entry.type}</span>
            <span className="entry__hours mono">{entry.hours}</span>
            <div className="entry__body">
              <p className="entry__note">{renderInlineMarkdown(entry.note)}</p>
              {(entry.outcomeIds.length > 0 ||
                entry.artefacts.length > 0 ||
                entry.values.length > 0 ||
                entry.people.length > 0) && (
                <div className="entry__tokens">
                  {entry.outcomeIds.map((id) => (
                    <span key={id} className="token token--outcome">
                      → {outcomeName(id)}
                    </span>
                  ))}
                  {entry.artefacts.map((a) => (
                    <span key={a} className="token token--artefact">
                      <span className="token__kind">Artefact</span>
                      {a}
                    </span>
                  ))}
                  {entry.values.map((v) => (
                    <span key={v} className="token token--value">
                      <span className="token__kind">Value</span>
                      {v}
                    </span>
                  ))}
                  {entry.people.map((p) => (
                    <span key={p} className="entry__person">
                      @{p}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="entry__actions">
              <button
                type="button"
                className="entry__action"
                aria-label="Edit entry"
                title="Edit entry"
                onClick={() => edit(entry)}
              >
                <PencilIcon size={12} />
              </button>
              <button
                type="button"
                className="entry__action entry__action--remove"
                aria-label="Delete entry"
                title="Delete entry"
                onClick={() => {
                  if (editingId === entry.id) reset();
                  void run(() => api.deleteLogEntry(entry.id));
                }}
              >
                ×
              </button>
            </span>
          </div>
        ))}
        {task.log.length === 0 && <p className="entries__empty">No activity logged yet.</p>}
      </div>
    </section>
  );
}
