/**
 * The little Markdown the replica journeys (docs/replicas/<piece>/JOURNEY.md) are written in,
 * as blocks the journey pop-up renders: headings, paragraphs, lists (a continued item is
 * indented) and tables; inside them **bold**, *italic* and `code`.
 */

const HEADING = /^(#{1,3})\s+(.*)$/;
const LIST_ITEM = /^(?:[-*]|\d+\.)\s+(.*)$/;
const TABLE_RULE = /^\|?\s*:?-{3,}/;

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

/** [{ type: 'heading', level, text } | { type: 'paragraph', text } | { type: 'list', items } | { type: 'table', header, rows }] */
export function parseJourney(markdown) {
  const blocks = [];
  let block = null;
  const close = () => {
    if (block) blocks.push(block);
    block = null;
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      close();
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      close();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      continue;
    }
    if (line.trimStart().startsWith('|')) {
      if (block?.type !== 'table') {
        close();
        block = { type: 'table', header: cells(line), rows: [] };
      } else if (!TABLE_RULE.test(line.trim())) {
        block.rows.push(cells(line));
      }
      continue;
    }
    const item = line.match(LIST_ITEM);
    if (item && !/^\s/.test(line)) {
      if (block?.type !== 'list') {
        close();
        block = { type: 'list', items: [] };
      }
      block.items.push(item[1].trim());
      continue;
    }
    if (block?.type === 'list' && /^\s/.test(line)) {
      block.items[block.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (block?.type !== 'paragraph') {
      close();
      block = { type: 'paragraph', text: line.trim() };
    } else {
      block.text += ` ${line.trim()}`;
    }
  }
  close();
  return blocks;
}

/** A line's runs: [{ type: 'text' | 'strong' | 'em' | 'code', text }]. */
export function inlineRuns(text) {
  const runs = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) runs.push({ type: 'text', text: text.slice(at, match.index) });
    const token = match[0];
    if (token.startsWith('**')) runs.push({ type: 'strong', text: token.slice(2, -2) });
    else if (token.startsWith('`')) runs.push({ type: 'code', text: token.slice(1, -1) });
    else runs.push({ type: 'em', text: token.slice(1, -1) });
    at = match.index + token.length;
  }
  if (at < text.length) runs.push({ type: 'text', text: text.slice(at) });
  return runs;
}
