import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inlineRuns, parseJourney } from './journeyMarkdown.js';
import { LANDING_PIECES } from '../data/landingQueue.js';

describe('journey markdown', () => {
  it('reads headings, wrapped paragraphs, continued list items and tables', () => {
    const blocks = parseJourney([
      '# A piece: the journey',
      '',
      'A paragraph wrapped',
      'over two lines.',
      '',
      '- one item',
      '  that goes on',
      '- two',
      '',
      '| | against |',
      '|---|---|',
      '| level | -30.1 dBFS |'
    ].join('\n'));
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'A piece: the journey' },
      { type: 'paragraph', text: 'A paragraph wrapped over two lines.' },
      { type: 'list', items: ['one item that goes on', 'two'] },
      { type: 'table', header: ['', 'against'], rows: [['level', '-30.1 dBFS']] }
    ]);
  });

  it('splits a line into plain, bold, italic and code runs', () => {
    expect(inlineRuns('**Source.** *Solo in Rio* via `yt-dlp`, 5-95%')).toEqual([
      { type: 'strong', text: 'Source.' },
      { type: 'text', text: ' ' },
      { type: 'em', text: 'Solo in Rio' },
      { type: 'text', text: ' via ' },
      { type: 'code', text: 'yt-dlp' },
      { type: 'text', text: ', 5-95%' }
    ]);
  });

  it('reads every journey the landing queue names, titled, credited and with no markup left over', () => {
    const journeys = LANDING_PIECES.filter((piece) => piece.journey);
    expect(journeys.map((piece) => piece.journey).sort())
      .toEqual(['blade-runner-blues', 'pernambuco', 'shade-of-the-mango-tree']);
    for (const { journey } of journeys) {
      const blocks = parseJourney(readFileSync(`docs/replicas/${journey}/JOURNEY.md`, 'utf8'));
      expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
      expect(inlineRuns(blocks[1].text)).toEqual([{ type: 'em', text: expect.stringMatching(/^Rebuilt by Claude .+ with Luke, .+\.$/) }]);
      const texts = blocks.flatMap((block) => (
        block.type === 'list' ? block.items : block.type === 'table' ? [...block.header, ...block.rows.flat()] : [block.text]
      ));
      const leftover = texts.flatMap(inlineRuns).filter((run) => run.type === 'text' && /[*`]/.test(run.text));
      expect(leftover, journey).toEqual([]);
      for (const table of blocks.filter((block) => block.type === 'table')) {
        for (const row of table.rows) expect(row, journey).toHaveLength(table.header.length);
      }
    }
  });
});
