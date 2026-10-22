import { describe, expect, it } from 'vitest';
import { eachKeys } from './each-keys';

const byText = (texts: string[]) => eachKeys(texts, (text) => text);

describe('eachKeys', () => {
  it('gives every item its own key, whatever the identities spell', () => {
    // Identities that hold the separator and the digits a count is written in,
    // one of them repeated past ten so its count grows a second digit.
    const identities = [...Array(11).fill('a'), 'a1', '0a', '0a', ':', ':', '0:', '1:a', '', ''];
    const keys = byText(identities);
    expect(new Set(keys).size).toBe(identities.length);
  });

  it('keeps the key of an item with a unique identity when the list reorders', () => {
    const before = byText(['gas', 'power', 'heat']);
    const after = byText(['heat', 'gas', 'power']);
    expect(after).toEqual([before[2], before[0], before[1]]);
  });

  it('hands the identity function the position', () => {
    expect(eachKeys(['x', 'x'], (_, index) => `index:${index}`)).toEqual([
      '0:index:0',
      '0:index:1'
    ]);
  });
});
