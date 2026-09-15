import { describe, expect, it } from 'vitest';
import { parseChangelog, tokenizeInline } from './changelog';

describe('tokenizeInline', () => {
  it('turns the issue link cliff writes into a link token inside its parentheses', () => {
    expect(
      tokenizeInline('asks four real systems ([#481](https://github.com/urbicon/ui/issues/481))')
    ).toEqual([
      { kind: 'text', text: 'asks four real systems (' },
      { kind: 'link', text: '#481', href: 'https://github.com/urbicon/ui/issues/481' },
      { kind: 'text', text: ')' }
    ]);
  });

  it('turns a code span into a code token and keeps the text around it', () => {
    expect(tokenizeInline('`customItem` draws the row, `select` is the fourth argument')).toEqual([
      { kind: 'code', text: 'customItem' },
      { kind: 'text', text: ' draws the row, ' },
      { kind: 'code', text: 'select' },
      { kind: 'text', text: ' is the fourth argument' }
    ]);
  });

  it('leaves a message without markup as one text token', () => {
    expect(tokenizeInline('Two comments stop counting the families')).toEqual([
      { kind: 'text', text: 'Two comments stop counting the families' }
    ]);
  });

  it('keeps an unbalanced backtick or bracket as text instead of dropping it', () => {
    expect(tokenizeInline('a `lone backtick and [a bracket')).toEqual([
      { kind: 'text', text: 'a `lone backtick and [a bracket' }
    ]);
  });
});

describe('parseChangelog', () => {
  const md = [
    '## [8.23.0](https://github.com/urbicon/ui/compare/v8.22.1...v8.23.0) - 2026-09-15',
    '',
    '### Breaking Changes',
    '- **blocks**: The Alert announces by intent',
    '> **BREAKING:** a consumer passes `role="alert"` explicitly.',
    '',
    '### CI/CD',
    '- Docs:refs:check asks four real systems ([#481](https://github.com/urbicon/ui/issues/481))',
    '',
    '## [8.0.0](https://github.com/urbicon/ui/releases/tag/v8.0.0) - 2026-08-01',
    '',
    '### Features',
    '- **table**: v8'
  ].join('\n');

  it('reads the version and date off a linked heading, and the tag form of the oldest release', () => {
    const entries = parseChangelog(md);
    expect(entries.map((e) => [e.version, e.date])).toEqual([
      ['8.23.0', '2026-09-15'],
      ['8.0.0', '2026-08-01']
    ]);
  });

  it('keeps the scope chip apart from the message and skips the BREAKING note', () => {
    const [latest] = parseChangelog(md);
    expect(latest.groups.map((g) => g.name)).toEqual(['Breaking Changes', 'CI/CD']);
    expect(latest.groups[0].items).toEqual([
      { scope: 'blocks', message: 'The Alert announces by intent' }
    ]);
    expect(latest.groups[1].items[0].scope).toBeUndefined();
  });
});
