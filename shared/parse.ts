/**
 * Log-note parsing, shared so the composer's live preview and the stored entry can
 * never disagree about what a note contains.
 *
 * Line-based, following the prototype exactly:
 *
 *   !Artefact produced      a whole line beginning with ! is an artefact
 *   +Value produced         a whole line beginning with + is a value
 *   Reviewed with @person   @mentions are picked up anywhere and stay in the note
 *
 * `note` is what remains — the artefact and value lines are removed from it, so the
 * stored note reads as prose and the chips carry the structure rather than repeating
 * it. @mentions are deliberately left in place: "Reviewed with" alone says nothing.
 */
export interface ParsedNote {
  note: string;
  artefacts: string[];
  values: string[];
  people: string[];
}

const PERSON = /@[A-Za-z][A-Za-z0-9._-]*/g;

export function parseNote(text: string): ParsedNote {
  const artefacts: string[] = [];
  const values: string[] = [];
  const noteLines: string[] = [];

  for (const line of (text || '').replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('!')) {
      if (trimmed.length > 1) artefacts.push(trimmed.slice(1).trim());
    } else if (trimmed.startsWith('+')) {
      if (trimmed.length > 1) values.push(trimmed.slice(1).trim());
    } else if (trimmed) {
      noteLines.push(trimmed);
    }
  }

  const people = (String(text || '').match(PERSON) ?? []).map((m) => m.slice(1));

  return {
    note: noteLines.join('\n'),
    artefacts: dedupe(artefacts),
    values: dedupe(values),
    people: dedupe(people),
  };
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}
