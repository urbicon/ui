import { describe, expect, it } from 'vitest';
import { blocksSourceCount, countUses } from './blocks-utility-uses.js';

describe('blocks utility uses', () => {
  it('globs the blocks source, so a 0 means "nothing uses this" and not "nothing was read"', () => {
    expect(blocksSourceCount).toBeGreaterThan(100);
  });

  it('counts word-bounded occurrences, across files', () => {
    const corpus = ['class="text-xs text-xs/5"', 'text-xsl ptext-xs', "'text-xs'"];
    expect(countUses('text-xs', corpus)).toBe(3);
  });

  it('escapes the utility rather than reading it as a pattern', () => {
    expect(countUses('a.b', ['axb a.b'])).toBe(1);
  });
});
