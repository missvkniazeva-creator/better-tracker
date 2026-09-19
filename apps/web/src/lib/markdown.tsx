import type { ReactNode } from 'react';
import type { TaskImage } from '@shared/types.ts';

/**
 * The small markdown subset the handoff's description and obstacle fields need:
 * bold, italic, inline code, links, images, bullet and numbered lists, and paragraphs.
 *
 * It renders to React nodes rather than an HTML string, so there is no
 * `dangerouslySetInnerHTML` and no way for note text to inject markup. That rules
 * out a general markdown dependency, but the subset is small enough not to need one.
 */
export function renderMarkdown(source: string, images: TaskImage[] = []): ReactNode {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p${blocks.length}`}>{renderInline(paragraph.join(' '), images)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const { ordered, start, items } = list;
    const children = items.map((item, i) => <li key={i}>{renderInline(item, images)}</li>);
    blocks.push(
      ordered ? (
        // start is preserved, so a list written as "3." renders as 3.
        <ol key={`o${blocks.length}`} start={start}>
          {children}
        </ol>
      ) : (
        <ul key={`u${blocks.length}`}>{children}</ul>
      ),
    );
    list = null;
  };
  const pushItem = (ordered: boolean, text: string, start: number) => {
    flushParagraph();
    // A change of list type ends the previous list rather than mixing markers.
    if (list && list.ordered !== ordered) flushList();
    if (!list) list = { ordered, start, items: [] };
    list.items.push(text);
  };

  for (const line of lines) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*(\d{1,9})[.)]\s+(.*)$/.exec(line);
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);

    if (bullet) {
      pushItem(false, bullet[1]!, 1);
    } else if (numbered) {
      pushItem(true, numbered[2]!, Number(numbered[1]));
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]!.length;
      const Tag = (['h3', 'h4', 'h5'] as const)[level - 1]!;
      blocks.push(<Tag key={`h${blocks.length}`}>{renderInline(heading[2]!, images)}</Tag>);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

// Ordered so an image (`![alt](src)`) is matched before a link (`[text](href)`), and
// the longer emphasis runs before the shorter ones they contain.
const INLINE =
  /(!\[[^\]]*\]\([^)]*\))|(\[[^\]]*\]\([^)]*\))|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)/g;

/**
 * One line's worth of markdown, without the surrounding block element. Log entry
 * notes use this: they are single-paragraph prose, and ⌘B in the composer would
 * otherwise leave literal asterisks on the saved entry.
 */
export function renderInlineMarkdown(text: string, images: TaskImage[] = []): ReactNode[] {
  return renderInline(text, images);
}

function renderInline(text: string, images: TaskImage[]): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const at = match.index!;
    if (at > last) out.push(text.slice(last, at));
    last = at + token.length;

    if (token.startsWith('![')) {
      const [, alt = '', ref = ''] = /^!\[([^\]]*)\]\(([^)]*)\)$/.exec(token) ?? [];
      // An image reference is an image id, not a URL: the editor inserts `![name](id)`
      // when a screenshot is pasted, and the API serves the bytes.
      const image = images.find((i) => i.id === ref);
      out.push(
        <img key={key++} src={image ? image.url : ref} alt={image?.name ?? alt} loading="lazy" />,
      );
    } else if (token.startsWith('[')) {
      const [, label = '', href = ''] = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(token) ?? [];
      out.push(
        safeHref(href) ? (
          <a key={key++} href={href} target="_blank" rel="noreferrer noopener">
            {label}
          </a>
        ) : (
          label
        ),
      );
    } else if (token.startsWith('***')) {
      out.push(
        <strong key={key++}>
          <em>{token.slice(3, -3)}</em>
        </strong>,
      );
    } else if (token.startsWith('**')) {
      out.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      out.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      out.push(<code key={key++}>{token.slice(1, -1)}</code>);
    }
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Only http(s) and mailto survive; `javascript:` and friends render as plain text. */
function safeHref(href: string): boolean {
  return /^(https?:|mailto:|\/)/i.test(href.trim());
}
