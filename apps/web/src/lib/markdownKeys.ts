/**
 * ⌘B / ⌘I (Ctrl on Windows and Linux) over a text field, as a toggle.
 *
 * The card's text is markdown, so "bold" is `**…**` and "italic" is `*…*`. Pressing
 * the shortcut on an already-marked run strips the marks again rather than nesting a
 * second pair, and it strips them whether the marks sit inside the selection
 * (`**word**` selected) or just outside it (`word` selected between two `**`).
 */

type Field = HTMLInputElement | HTMLTextAreaElement;

const MARKS: Record<string, string> = { b: '**', i: '*' };

/**
 * Handle the keystroke, or report that it was not one of ours.
 *
 * `onChange` receives the rewritten text. The new value is written to the DOM node
 * first so the caret can be placed before React re-renders: React then finds the
 * node already holding the value it is about to set, leaves it alone, and the
 * selection survives.
 */
export function handleMarkdownShortcut(
  event: React.KeyboardEvent<Field>,
  onChange: (next: string) => void,
): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  const mark = MARKS[event.key.toLowerCase()];
  if (!mark) return false;

  const field = event.currentTarget;
  event.preventDefault();

  const value = field.value;
  const start = field.selectionStart ?? value.length;
  const end = field.selectionEnd ?? start;
  const selected = value.slice(start, end);

  // Marks inside the selection: unwrap them and keep the bare text selected.
  if (isWrapped(selected, mark)) {
    const bare = selected.slice(mark.length, -mark.length);
    return commit(field, onChange, value.slice(0, start) + bare + value.slice(end), [
      start,
      start + bare.length,
    ]);
  }

  // Marks immediately outside it: the same run, selected without its marks.
  const before = value.slice(Math.max(0, start - mark.length), start);
  const after = value.slice(end, end + mark.length);
  if (before === mark && after === mark && !spillsIntoBold(value, start, end, mark)) {
    const from = start - mark.length;
    return commit(field, onChange, value.slice(0, from) + selected + value.slice(end + mark.length), [
      from,
      from + selected.length,
    ]);
  }

  // Nothing selected: open an empty pair and put the caret between the marks, so the
  // shortcut can be pressed before the words are typed as well as after.
  if (start === end) {
    return commit(field, onChange, value.slice(0, start) + mark + mark + value.slice(start), [
      start + mark.length,
      start + mark.length,
    ]);
  }

  return commit(
    field,
    onChange,
    value.slice(0, start) + mark + selected + mark + value.slice(end),
    [start + mark.length, end + mark.length],
  );
}

/**
 * `**bold**` also starts and ends with `*`, so ⌘I would happily strip one layer and
 * silently demote it to italic. Bold is only ever unwrapped by ⌘B.
 */
function isWrapped(text: string, mark: string): boolean {
  if (text.length < mark.length * 2) return false;
  if (!text.startsWith(mark) || !text.endsWith(mark)) return false;
  if (mark === '*' && text.length >= 4 && text.startsWith('**') && text.endsWith('**')) return false;
  return true;
}

/** The same guard for marks sitting outside the selection. */
function spillsIntoBold(value: string, start: number, end: number, mark: string): boolean {
  return mark === '*' && value.slice(start - 2, start) === '**' && value.slice(end, end + 2) === '**';
}

function commit(
  field: Field,
  onChange: (next: string) => void,
  next: string,
  [from, to]: [number, number],
): true {
  field.value = next;
  field.setSelectionRange(from, to);
  onChange(next);
  return true;
}
