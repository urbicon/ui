import { describe, expect, it } from 'vitest';
import { type A2uiStreamPart, A2uiStreamSplitter } from './a2ui-stream';

/** Run a full string through the splitter, sliced into fixed-size chunks. */
function runChunked(source: string, chunkSize: number): A2uiStreamSplitter {
  const s = new A2uiStreamSplitter();
  for (let i = 0; i < source.length; i += chunkSize) {
    s.push(source.slice(i, i + chunkSize));
  }
  s.end();
  return s;
}

/** Run a full string through the splitter one explicit chunk list at a time. */
function runChunks(chunks: string[]): A2uiStreamSplitter {
  const s = new A2uiStreamSplitter();
  for (const c of chunks) s.push(c);
  s.end();
  return s;
}

const ENV_SURFACE = '{"version":"v0.9.1","createSurface":{"surfaceId":"s1","catalogId":"c"}}';
const ENV_ROOT =
  '{"version":"v0.9.1","updateComponents":{"surfaceId":"s1","components":[{"id":"root","component":"Text","text":"Hi"}]}}';
// The same updateComponents envelope pretty-printed across lines — the shape
// models actually emit for large component lists (one component per line).
const ENV_ROOT_MULTILINE = [
  '{"version":"v0.9.1","updateComponents":{"surfaceId":"s1","components":[',
  '{"id":"root","component":"Text","text":"Hi"}',
  ']}}'
].join('\n');

describe('A2uiStreamSplitter — basic shaping', () => {
  it('plain text with no fence becomes a single text part', () => {
    const s = runChunks(['Hello ', 'world.\n', 'Second line.']);
    expect(s.snapshot()).toEqual([{ type: 'text', text: 'Hello world.\nSecond line.' }]);
    expect(s.issues).toHaveLength(0);
  });

  it('text, then a fenced block, then text yields three ordered parts', () => {
    const source = `Here is a form:\n\`\`\`a2ui\n${ENV_SURFACE}\n${ENV_ROOT}\n\`\`\`\nAnything else?`;
    const s = runChunked(source, 7);
    const parts = s.snapshot();
    expect(parts.map((p) => p.type)).toEqual(['text', 'a2ui', 'text']);
    expect((parts[0] as { text: string }).text).toBe('Here is a form:\n');
    expect((parts[1] as { payload: unknown[] }).payload).toEqual([
      JSON.parse(ENV_SURFACE),
      JSON.parse(ENV_ROOT)
    ]);
    expect((parts[2] as { text: string }).text).toBe('Anything else?');
    expect(s.issues).toHaveLength(0);
  });

  it('appends envelopes to the payload array in stream order', () => {
    const source = `\`\`\`a2ui\n${ENV_SURFACE}\n${ENV_ROOT}\n\`\`\`\n`;
    const s = runChunked(source, 3);
    const ui = s.snapshot()[0] as { type: 'a2ui'; payload: unknown[] };
    expect(ui.type).toBe('a2ui');
    expect(ui.payload).toHaveLength(2);
    expect((ui.payload[0] as { createSurface: unknown }).createSurface).toBeDefined();
    expect((ui.payload[1] as { updateComponents: unknown }).updateComponents).toBeDefined();
  });
});

describe('A2uiStreamSplitter — chunk-decomposition invariance', () => {
  const sources = [
    'just text, no fence at all',
    `pre\n\`\`\`a2ui\n${ENV_SURFACE}\n\`\`\`\npost`,
    `\`\`\`a2ui\n${ENV_SURFACE}\n${ENV_ROOT}\n\`\`\``, // no trailing newline
    `a\n\`\`\`a2ui\n${ENV_SURFACE}\n\`\`\`\nb\n\`\`\`a2ui\n${ENV_ROOT}\n\`\`\`\nc`, // two fences
    `trailing incomplete line with no newline`,
    `text before\n\`\`\`a2ui\n${ENV_SURFACE}`, // unterminated fence, no close
    `pre\n\`\`\`a2ui\n${ENV_SURFACE}\n${ENV_ROOT_MULTILINE}\n\`\`\`\npost` // pretty-printed envelope
  ];

  for (const source of sources) {
    it(`is invariant across chunk sizes for: ${JSON.stringify(source.slice(0, 24))}…`, () => {
      const reference = runChunked(source, source.length || 1).snapshot();
      for (const size of [1, 2, 3, 5, 8, 13, 50]) {
        const got = runChunked(source, size).snapshot();
        expect(got).toEqual(reference);
      }
      // Also compare against a whole-string single push.
      const whole = runChunks([source]).snapshot();
      expect(whole).toEqual(reference);
    });
  }

  it('recognises a fence marker split across chunk boundaries', () => {
    // "```a2ui\n" delivered one/two characters at a time.
    const s = runChunks(['ok\n', '``', '`a2', 'ui', '\n', `${ENV_SURFACE}\n`, '``', '`\n', 'done']);
    const parts = s.snapshot();
    expect(parts.map((p) => p.type)).toEqual(['text', 'a2ui', 'text']);
    expect((parts[1] as { payload: unknown[] }).payload).toEqual([JSON.parse(ENV_SURFACE)]);
    expect((parts[2] as { text: string }).text).toBe('done');
  });
});

describe('A2uiStreamSplitter — multi-line (pretty-printed) envelopes', () => {
  it('parses an updateComponents envelope spread across several lines', () => {
    const source = `Here:\n\`\`\`a2ui\n${ENV_SURFACE}\n${ENV_ROOT_MULTILINE}\n\`\`\`\ndone`;
    const s = runChunked(source, 7);
    const parts = s.snapshot();
    expect(parts.map((p) => p.type)).toEqual(['text', 'a2ui', 'text']);
    expect((parts[1] as { payload: unknown[] }).payload).toEqual([
      JSON.parse(ENV_SURFACE),
      JSON.parse(ENV_ROOT)
    ]);
    expect(s.issues).toHaveLength(0);
  });

  it('keeps earlier envelopes referentially stable while a multi-line one buffers', () => {
    const s = new A2uiStreamSplitter();
    s.push(`\`\`\`a2ui\n${ENV_SURFACE}\n`);
    const first = (s.snapshot()[0] as { payload: unknown[] }).payload[0];
    s.push('{"version":"v0.9.1","updateComponents":{"surfaceId":"s1","components":[\n');
    // Mid-object: the buffered lines are not visible anywhere yet.
    expect((s.snapshot()[0] as { payload: unknown[] }).payload).toHaveLength(1);
    s.push('{"id":"root","component":"Text","text":"Hi"}\n]}}\n```\n');
    const payload = (s.snapshot()[0] as { payload: unknown[] }).payload;
    expect(payload).toHaveLength(2);
    expect(payload[0]).toBe(first);
    expect(s.issues).toHaveLength(0);
  });

  it('tolerates blank lines inside a multi-line envelope', () => {
    const source = `\`\`\`a2ui\n{"version":"v0.9.1","createSurface":\n\n{"surfaceId":"s1","catalogId":"c"}}\n\`\`\`\n`;
    const s = runChunked(source, 5);
    expect((s.snapshot()[0] as { payload: unknown[] }).payload).toEqual([JSON.parse(ENV_SURFACE)]);
    expect(s.issues).toHaveLength(0);
  });

  it('falls back to text when the fence closes on a still-open envelope', () => {
    const source = `\`\`\`a2ui\n${ENV_SURFACE}\n{"version":"v0.9.1","updateComponents":{\n\`\`\`\nafter`;
    const s = runChunked(source, 6);
    const parts = s.snapshot();
    expect((parts[0] as { payload: unknown[] }).payload).toEqual([JSON.parse(ENV_SURFACE)]);
    expect(s.issues.some((i) => i.code === 'UNPARSEABLE_LINE')).toBe(true);
    // The buffered line is re-emitted as text and the trailing prose stays prose.
    const text = parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('');
    expect(text).toContain('"updateComponents"');
    expect(text.endsWith('after')).toBe(true);
  });

  it('falls back when a braces-balanced buffer still fails to parse', () => {
    const source = `\`\`\`a2ui\n{"a":[\n1,\n2\n] oops}\n\`\`\`\ntail`;
    const s = runChunked(source, 4);
    const parts = s.snapshot();
    expect(parts.some((p) => p.type === 'a2ui')).toBe(false);
    expect(s.issues.some((i) => i.code === 'UNPARSEABLE_LINE')).toBe(true);
    const text = parts.map((p) => (p as { text: string }).text).join('');
    expect(text).toContain('] oops}');
    expect(text.endsWith('tail')).toBe(true);
  });

  it('re-emits a buffered partial envelope when the stream ends mid-object', () => {
    const source = `\`\`\`a2ui\n${ENV_SURFACE}\n{"version":"v0.9.1","updateComponents":{"surfaceId":"s1",`;
    const s = runChunked(source, 9);
    expect(s.issues.some((i) => i.code === 'UNTERMINATED_FENCE')).toBe(true);
    const parts = s.snapshot();
    expect((parts[0] as { payload: unknown[] }).payload).toEqual([JSON.parse(ENV_SURFACE)]);
    expect(parts.some((p) => p.type === 'text' && p.text.includes('"updateComponents"'))).toBe(
      true
    );
  });

  it('renders the real closing fence as the close of the synthetic code block', () => {
    // After a fallback, the emitted text must read as one balanced ``` block:
    // synthetic open + bad lines + the fence's own ``` as the close.
    const s = runChunks(['```a2ui\n', 'garbage\n', '```\n', 'after\n']);
    const text = s
      .snapshot()
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('');
    expect(text).toBe('```\ngarbage\n```\nafter\n');
  });
});

describe('A2uiStreamSplitter — fallbacks and edge cases', () => {
  it('falls an unparseable line back to text and records an issue', () => {
    const source = `\`\`\`a2ui\n${ENV_SURFACE}\nnot json here\n\`\`\`\ntail`;
    const s = runChunked(source, 5);
    const parts = s.snapshot();
    // First a2ui part keeps the valid envelope; the bad line + rest becomes text.
    expect(parts[0]).toMatchObject({ type: 'a2ui' });
    expect((parts[0] as { payload: unknown[] }).payload).toEqual([JSON.parse(ENV_SURFACE)]);
    expect(parts.some((p) => p.type === 'text' && p.text.includes('not json here'))).toBe(true);
    expect(s.issues.some((i) => i.code === 'UNPARSEABLE_LINE')).toBe(true);
    // The closing ``` after fallback is plain text, not a fence marker.
    expect(parts.some((p) => p.type === 'text' && p.text.includes('```'))).toBe(true);
  });

  it('drops the a2ui part when the first fenced line is unparseable', () => {
    const source = 'lead\n```a2ui\ngarbage\n```\nrest';
    const s = runChunked(source, 4);
    const parts = s.snapshot();
    expect(parts.some((p) => p.type === 'a2ui')).toBe(false);
    expect(s.issues.some((i) => i.code === 'UNPARSEABLE_LINE')).toBe(true);
  });

  it('drops an empty fenced block (open immediately followed by close)', () => {
    const s = runChunks(['```a2ui\n', '```\n', 'after']);
    const parts = s.snapshot();
    expect(parts.some((p) => p.type === 'a2ui')).toBe(false);
    expect(parts).toEqual([{ type: 'text', text: 'after' }]);
  });

  it('flushes an incomplete last line at end()', () => {
    const s = new A2uiStreamSplitter();
    s.push('partial line without newline');
    // Before end(), the tail is shown via the live snapshot.
    expect(s.snapshot()).toEqual([{ type: 'text', text: 'partial line without newline' }]);
    s.end();
    expect(s.snapshot()).toEqual([{ type: 'text', text: 'partial line without newline' }]);
  });

  it('records an unterminated-fence issue when the stream ends inside a fence', () => {
    const source = `text\n\`\`\`a2ui\n${ENV_SURFACE}`;
    const s = runChunked(source, 6);
    expect(s.issues.some((i) => i.code === 'UNTERMINATED_FENCE')).toBe(true);
    // The envelope parsed before the stream ended is still available.
    const ui = s.snapshot().find((p) => p.type === 'a2ui') as { payload: unknown[] } | undefined;
    expect(ui?.payload).toEqual([JSON.parse(ENV_SURFACE)]);
  });
});

describe('A2uiStreamSplitter — streaming behaviour', () => {
  it('holds back a partial fence marker from the live snapshot (no flash)', () => {
    const s = new A2uiStreamSplitter();
    s.push('done\n');
    s.push('``'); // could still become ```a2ui — must not appear as text
    expect(s.snapshot()).toEqual([{ type: 'text', text: 'done\n' }]);
    s.push('`a2ui\n'); // completes the fence marker
    expect(s.snapshot().map((p) => p.type)).toEqual(['text', 'a2ui']);
  });

  it('keeps parsed envelope objects referentially stable as more arrive', () => {
    const s = new A2uiStreamSplitter();
    s.push('```a2ui\n');
    s.push(`${ENV_SURFACE}\n`);
    const first = (s.snapshot()[0] as { payload: unknown[] }).payload[0];
    s.push(`${ENV_ROOT}\n`);
    const afterMore = (s.snapshot()[0] as { payload: unknown[] }).payload[0];
    // The first envelope object is the SAME reference — A2UIView can trust its
    // incremental "first N are identical" fast path.
    expect(afterMore).toBe(first);
  });

  it('exposes the raw model output verbatim (fences included)', () => {
    const source = `hi\n\`\`\`a2ui\n${ENV_SURFACE}\n\`\`\`\nbye`;
    const s = runChunked(source, 9);
    expect(s.raw).toBe(source);
  });
});

describe('A2uiStreamSplitter — markdown-fence awareness (quoted / indented fences)', () => {
  it('does NOT execute a 4-space-indented ```a2ui block (it is indented code)', () => {
    const source = `Example:\n    \`\`\`a2ui\n    ${ENV_SURFACE}\n    \`\`\`\ndone`;
    const s = runChunked(source, 5);
    const parts = s.snapshot();
    // No a2ui part — the whole indented block is literal text.
    expect(parts.every((p) => p.type === 'text')).toBe(true);
    expect(s.issues).toHaveLength(0);
  });

  it('does NOT execute a ```a2ui quoted inside an outer ````markdown block', () => {
    const source = [
      'How does it look?',
      '',
      '````markdown',
      '```a2ui',
      ENV_SURFACE,
      '```',
      '````',
      '',
      'Cheers.'
    ].join('\n');
    const s = runChunked(source, 6);
    const parts = s.snapshot();
    expect(parts.every((p) => p.type === 'text')).toBe(true);
    // The outer fence markers do not leak as a live surface, and the whole block
    // renders as one continuous text region (with the trailing prose).
    const textJoined = parts.map((p) => (p as { text: string }).text).join('');
    expect(textJoined).toContain('````markdown');
    expect(textJoined).toContain('```a2ui');
    expect(textJoined).toContain('Cheers.');
  });

  it('handles two real a2ui blocks in one reply', () => {
    const source = `First:\n\`\`\`a2ui\n${ENV_SURFACE}\n\`\`\`\nSecond:\n\`\`\`a2ui\n${ENV_ROOT}\n\`\`\`\nfin`;
    const s = runChunked(source, 8);
    const parts = s.snapshot();
    expect(parts.map((p) => p.type)).toEqual(['text', 'a2ui', 'text', 'a2ui', 'text']);
    expect((parts[1] as { payload: unknown[] }).payload).toEqual([JSON.parse(ENV_SURFACE)]);
    expect((parts[3] as { payload: unknown[] }).payload).toEqual([JSON.parse(ENV_ROOT)]);
  });

  it('tolerates CRLF line endings around the fence', () => {
    const source = `intro\r\n\`\`\`a2ui\r\n${ENV_SURFACE}\r\n\`\`\`\r\ndone`;
    const s = runChunked(source, 7);
    const parts = s.snapshot();
    expect(parts.map((p) => p.type)).toEqual(['text', 'a2ui', 'text']);
    expect((parts[1] as { payload: unknown[] }).payload).toEqual([JSON.parse(ENV_SURFACE)]);
  });
});

// Type-level: a splitter part is assignable to the shape ChatMessage expects.
it('produces parts structurally compatible with ChatMessage', () => {
  const parts: A2uiStreamPart[] = new A2uiStreamSplitter().snapshot();
  const asChatParts: Array<{ type: 'text'; text: string } | { type: 'a2ui'; payload: unknown }> =
    parts;
  expect(asChatParts).toEqual([]);
});
