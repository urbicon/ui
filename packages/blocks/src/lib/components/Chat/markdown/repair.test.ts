import { describe, expect, it } from 'vitest';
import { repairMarkdownTail } from './repair';

/** Every input/expected pair fed to the transformation tables — reused by the idempotency sweep. */
interface Case {
  name: string;
  input: string;
  expected: string;
}

// ── 1. Core no-op invariant ──────────────────────────────────────────────────
// Text that already ends in complete syntax must come back byte-for-byte.

const NOOP: { name: string; text: string }[] = [
  { name: 'plain prose', text: 'just some plain text with no markers at all' },
  {
    name: 'every inline marker, paired',
    text: '**bold** and *italic* and __under__ and _u_ and ~~strike~~ and `code`'
  },
  { name: 'nested emphasis', text: 'nested **bold with *italic* inside** done' },
  { name: 'snake_case identifiers', text: 'call foo_bar_baz and read snake_case_value' },
  { name: 'single tilde range', text: 'a range of 20~25 units, roughly' },
  { name: 'spaced asterisks (not emphasis)', text: 'x = a * b + c * d and a ** b' },
  { name: 'escaped markers', text: 'escaped \\* star \\_ under \\~ tilde stay literal' },
  { name: 'inline code guards its stars', text: 'the token `a * b` is literal here' },
  { name: 'closed fenced block', text: '```js\nconst x = 1;\nreturn x * 2;\n```' },
  {
    name: 'tilde fenced block',
    text: '~~~\nplain ~ tilde and ** stars inside a fence\n~~~'
  },
  { name: 'heading + paragraph', text: '# Heading\n\nParagraph with `inline code`.' },
  {
    name: 'complete link and image',
    text: '[link](https://example.com) and ![img](https://example.com/a.png)'
  },
  {
    name: 'reference link + definition',
    text: 'Ref [text][id] here\n\n[id]: https://example.com "title"'
  },
  {
    name: 'link url with balanced parens and underscore',
    text: 'see [wiki](https://en.wikipedia.org/wiki/Foo_(bar)) now'
  },
  { name: 'literal index brackets', text: 'array[0] and map[key] are literal' },
  { name: 'table', text: '| Col A | Col B |\n| --- | --- |\n| 1 | 2 |' },
  { name: 'dash bullet list', text: '- item one\n- item two\n  - nested item' },
  { name: 'asterisk bullet list', text: '* bullet one\n* bullet two\n* bullet three' },
  { name: 'thematic breaks', text: 'before\n\n***\n\n___\n\n---\n\nafter' },
  { name: 'blockquote with emphasis', text: 'intro\n\n> quoted **bold** and _em_ text' },
  { name: 'CJK and emoji', text: 'CJK 你好世界 and emoji 😀🎉 render fine' },
  { name: 'raw html is plain text', text: 'a <div>raw</div> and <b>tag</b> stay as text' },
  { name: 'double-dollar math is plain text', text: 'inline $$x^2 + y^2$$ is just text' },
  { name: 'exclamation without bracket', text: 'Hello! This costs $5! Really!' },
  { name: 'ordinary bracket citation prose', text: 'as noted in [1] and [2] of the paper' }
];

describe('repairMarkdownTail — core no-op invariant', () => {
  for (const { name, text } of NOOP) {
    it(`is identity for ${name}`, () => {
      expect(repairMarkdownTail(text)).toBe(text);
    });
  }

  it('is identity for the empty string', () => {
    expect(repairMarkdownTail('')).toBe('');
  });
});

// ── 2. Close unpaired inline markers (rule 3) ────────────────────────────────

const MARKER_CLOSING: Case[] = [
  { name: 'strong', input: '**bold', expected: '**bold**' },
  { name: 'strong mid-sentence', input: 'text **bold', expected: 'text **bold**' },
  { name: 'em star', input: '*italic', expected: '*italic*' },
  { name: 'em star mid-sentence', input: 'an *italic', expected: 'an *italic*' },
  { name: 'strong underscore', input: '__strong', expected: '__strong__' },
  { name: 'em underscore', input: '_em', expected: '_em_' },
  { name: 'strike', input: '~~strike', expected: '~~strike~~' },
  { name: 'inline code', input: '`code', expected: '`code`' },
  {
    name: 'nested strong then em',
    input: 'start **bold and *nested',
    expected: 'start **bold and *nested***'
  },
  {
    name: 'triple marker',
    input: '***bold and italic',
    expected: '***bold and italic***'
  },
  {
    name: 'does not touch already-closed pair before an open one',
    input: 'done *first* then **second',
    expected: 'done *first* then **second**'
  }
];

describe('repairMarkdownTail — closes unpaired inline markers', () => {
  for (const { name, input, expected } of MARKER_CLOSING) {
    it(name, () => {
      expect(repairMarkdownTail(input)).toBe(expected);
    });
  }
});

// ── 3. Marker-counting exceptions (rule 4) ───────────────────────────────────

const MARKER_EXCEPTIONS: Case[] = [
  { name: 'word-internal single underscore', input: 'snake_case', expected: 'snake_case' },
  { name: 'word-internal multiple underscores', input: 'foo_bar_baz', expected: 'foo_bar_baz' },
  { name: 'single tilde is not a marker', input: 'range 20~25', expected: 'range 20~25' },
  { name: 'escaped star', input: 'an escaped \\* star', expected: 'an escaped \\* star' },
  { name: 'escaped underscore', input: 'an escaped \\_ under', expected: 'an escaped \\_ under' },
  { name: 'escaped tilde', input: 'an escaped \\~ tilde', expected: 'an escaped \\~ tilde' },
  {
    name: 'escaped opener leaves later pair untouched',
    input: '\\*not\\* but **real',
    expected: '\\*not\\* but **real**'
  },
  { name: 'spaced asterisk is inert', input: '2 * 3 = 6', expected: '2 * 3 = 6' }
];

describe('repairMarkdownTail — marker-counting exceptions', () => {
  for (const { name, input, expected } of MARKER_EXCEPTIONS) {
    it(name, () => {
      expect(repairMarkdownTail(input)).toBe(expected);
    });
  }
});

// ── 4. Open code fences are left untouched (rule 5) ──────────────────────────

const OPEN_FENCE: Case[] = [
  {
    name: 'no marker repair inside an open fence',
    input: '```\nconst x = *value and __y',
    expected: '```\nconst x = *value and __y'
  },
  {
    name: 'open fence with language and stars',
    input: '```js\nfunction f() {\n  return **not bold',
    expected: '```js\nfunction f() {\n  return **not bold'
  },
  { name: 'bare opening fence', input: '```', expected: '```' },
  {
    name: 'open fence after a paragraph keeps brackets',
    input: 'intro paragraph\n\n```python\nrows = [1, 2',
    expected: 'intro paragraph\n\n```python\nrows = [1, 2'
  },
  {
    name: 'open fence is not closed',
    input: '```ts\nlet a: number',
    expected: '```ts\nlet a: number'
  }
];

describe('repairMarkdownTail — open code fences', () => {
  for (const { name, input, expected } of OPEN_FENCE) {
    it(name, () => {
      expect(repairMarkdownTail(input)).toBe(expected);
    });
  }
});

// ── 5. Inline code spans (rule 3 backtick + rule 5) ──────────────────────────

const INLINE_CODE: Case[] = [
  { name: 'closes a trailing open backtick', input: '`code', expected: '`code`' },
  {
    name: 'closes only the last open backtick',
    input: 'use `inline` then `open',
    expected: 'use `inline` then `open`'
  },
  {
    name: 'stars inside an open backtick are not repaired',
    input: '`code with ** stars',
    expected: '`code with ** stars`'
  },
  {
    name: 'double backtick span containing a single backtick',
    input: '``a`b',
    expected: '``a`b``'
  },
  {
    name: 'closed span protects its content',
    input: 'literal `a_b_c* here` and done',
    expected: 'literal `a_b_c* here` and done'
  },
  {
    name: 'literal unclosed backtick before a prose line is left alone',
    input: 'Inline text such as `a ` b` is\njust a code span followed by more text.',
    expected: 'Inline text such as `a ` b` is\njust a code span followed by more text.'
  },
  {
    name: 'lone trailing backtick is not closed (would only make an empty span)',
    input: 'the prompt is `',
    expected: 'the prompt is `'
  }
];

describe('repairMarkdownTail — inline code', () => {
  for (const { name, input, expected } of INLINE_CODE) {
    it(name, () => {
      expect(repairMarkdownTail(input)).toBe(expected);
    });
  }
});

// ── 6. Incomplete links → strip to label text (rule 6) ───────────────────────

const INCOMPLETE_LINKS: Case[] = [
  { name: 'partial url', input: '[text](http://part', expected: 'text' },
  { name: 'open paren only', input: '[text](', expected: 'text' },
  { name: 'open bracket only', input: '[text', expected: 'text' },
  { name: 'two chars into label', input: '[te', expected: 'te' },
  { name: 'reference candidate', input: '[text][re', expected: 'text' },
  { name: 'empty reference bracket', input: '[text][', expected: 'text' },
  { name: 'prefix preserved', input: 'see [more](https://exa', expected: 'see more' },
  {
    name: 'label markers get repaired after stripping',
    input: '[**bold text](http',
    expected: '**bold text**'
  },
  { name: 'complete link untouched', input: '[text](url)', expected: '[text](url)' },
  {
    name: 'earlier complete link kept, trailing one stripped',
    input: '[a](b) and [c](',
    expected: '[a](b) and c'
  },
  {
    name: 'complete link with title untouched',
    input: '[t](https://u "title")',
    expected: '[t](https://u "title")'
  }
];

describe('repairMarkdownTail — incomplete links', () => {
  for (const { name, input, expected } of INCOMPLETE_LINKS) {
    it(name, () => {
      expect(repairMarkdownTail(input)).toBe(expected);
    });
  }
});

// ── 7. Incomplete images → remove entirely (rule 7) ──────────────────────────

const INCOMPLETE_IMAGES: Case[] = [
  { name: 'partial url', input: '![alt](http://part', expected: '' },
  { name: 'two chars into alt', input: '![al', expected: '' },
  { name: 'open paren only', input: '![alt](', expected: '' },
  { name: 'prefix preserved, image removed', input: 'text ![img](htt', expected: 'text ' },
  {
    name: 'complete image untouched',
    input: '![alt](https://ex.com/a.png)',
    expected: '![alt](https://ex.com/a.png)'
  },
  {
    name: 'open bracket alt only',
    input: 'caption: ![diagram of the',
    expected: 'caption: '
  }
];

describe('repairMarkdownTail — incomplete images', () => {
  for (const { name, input, expected } of INCOMPLETE_IMAGES) {
    it(name, () => {
      expect(repairMarkdownTail(input)).toBe(expected);
    });
  }
});

// ── 8. Lone `!` is left alone (rule 8) ───────────────────────────────────────

const BANG: Case[] = [
  { name: 'single bang', input: '!', expected: '!' },
  { name: 'bang mid-sentence', input: 'wow! that is neat', expected: 'wow! that is neat' },
  { name: 'trailing bang', input: 'done!', expected: 'done!' },
  {
    name: 'bang then space then complete link is not an image',
    input: 'note! [text](url)',
    expected: 'note! [text](url)'
  }
];

describe('repairMarkdownTail — lone bang', () => {
  for (const { name, input, expected } of BANG) {
    it(name, () => {
      expect(repairMarkdownTail(input)).toBe(expected);
    });
  }
});

// ── 9. Lone surrogates at the tail do not crash (rule 10) ────────────────────

const SURROGATES: Case[] = [
  { name: 'lone high surrogate', input: 'emoji cut \uD83D', expected: 'emoji cut \uD83D' },
  { name: 'lone low surrogate', input: 'text \uDE00 tail', expected: 'text \uDE00 tail' },
  {
    name: 'lone high surrogate after an open marker still closes the marker',
    input: '**bold \uD83D',
    expected: '**bold \uD83D**'
  }
];

describe('repairMarkdownTail — lone surrogates', () => {
  for (const { name, input, expected } of SURROGATES) {
    it(name, () => {
      expect(() => repairMarkdownTail(input)).not.toThrow();
      expect(repairMarkdownTail(input)).toBe(expected);
    });
  }
});

// ── 10. Idempotency (rule 2) — over every fixture in this file ────────────────

const ALL_INPUTS: string[] = [
  ...NOOP.map((c) => c.text),
  '',
  ...MARKER_CLOSING.flatMap((c) => [c.input, c.expected]),
  ...MARKER_EXCEPTIONS.flatMap((c) => [c.input, c.expected]),
  ...OPEN_FENCE.flatMap((c) => [c.input, c.expected]),
  ...INLINE_CODE.flatMap((c) => [c.input, c.expected]),
  ...INCOMPLETE_LINKS.flatMap((c) => [c.input, c.expected]),
  ...INCOMPLETE_IMAGES.flatMap((c) => [c.input, c.expected]),
  ...BANG.flatMap((c) => [c.input, c.expected]),
  ...SURROGATES.flatMap((c) => [c.input, c.expected])
];

describe('repairMarkdownTail — idempotency', () => {
  for (const input of ALL_INPUTS) {
    it(`repair(repair(x)) === repair(x) for ${JSON.stringify(input).slice(0, 48)}`, () => {
      const once = repairMarkdownTail(input);
      expect(repairMarkdownTail(once)).toBe(once);
    });
  }

  it('expected outputs of every transformation case are themselves settled (no-op)', () => {
    const settled = [
      ...MARKER_CLOSING,
      ...MARKER_EXCEPTIONS,
      ...INLINE_CODE,
      ...INCOMPLETE_LINKS,
      ...INCOMPLETE_IMAGES,
      ...BANG,
      ...SURROGATES
    ];
    for (const { expected } of settled) {
      expect(repairMarkdownTail(expected)).toBe(expected);
    }
  });
});
