import { describe, expect, it } from 'vitest';
import { corpus } from './__fixtures__/corpus';
// The parser is implemented in parallel; these imports resolve once blocks.ts
// lands. Until then the suite fails to resolve `./blocks`, which is expected.
import { createIncrementalParser, parseMarkdown } from './blocks';
import { chunkings } from './streaming-harness';
import type { InlineNode, MarkdownBlock, MarkdownDocument } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deep-clone a document with every `key` property removed, so the streaming
 * result and the one-shot parse can be compared purely on structure. The clone
 * protects the live parser objects from mutation (the referential-stability
 * suite depends on them). `linkRefs` survives as a `Map`, which vitest's
 * `toEqual` compares by contents.
 */
function stripKeys(doc: MarkdownDocument): { blocks: unknown; linkRefs: unknown } {
  const clone = structuredClone({ blocks: doc.blocks, linkRefs: doc.linkRefs });
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node && typeof node === 'object') {
      delete (node as { key?: number }).key;
      for (const value of Object.values(node)) walk(value);
    }
  };
  walk(clone.blocks);
  return { blocks: clone.blocks, linkRefs: clone.linkRefs };
}

/** Feed a chunk sequence through a fresh incremental parser. */
function streamParse(chunks: string[]): MarkdownDocument {
  const parser = createIncrementalParser();
  for (const chunk of chunks) parser.append(chunk);
  return parser.document;
}

/** Collect every node of a given `kind` anywhere in the document tree. */
function collectByKind<K extends InlineNode['kind']>(
  doc: MarkdownDocument,
  kind: K
): Extract<InlineNode, { kind: K }>[] {
  const out: Extract<InlineNode, { kind: K }>[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (value && typeof value === 'object') {
      if ((value as { kind?: string }).kind === kind) {
        out.push(value as Extract<InlineNode, { kind: K }>);
      }
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(doc.blocks);
  return out;
}

// ── Suite 1: streaming equals one-shot, for every chunking ───────────────────

describe('streaming invariant: incremental parse === one-shot parse', () => {
  for (const fixture of corpus) {
    const expected = () => stripKeys(parseMarkdown(fixture.text));
    for (const strategy of chunkings(fixture.text)) {
      it(`${fixture.name} · ${strategy.name}`, () => {
        const streamed = stripKeys(streamParse(strategy.chunks));
        expect(streamed).toEqual(expected());
      });
    }
  }
});

// ── Suite 2: settled blocks keep referential identity ────────────────────────

/**
 * A reference definition appearing *after* its first use legitimately
 * invalidates settled blocks once it streams in (full re-parse with key
 * reconciliation — the Astryx lesson). For such fixtures object identity is
 * expected to break exactly there; keys must still survive, so the keyed
 * `{#each}` patches instead of remounting.
 */
function hasLateRefDefinition(text: string): boolean {
  const defPattern = /^ {0,3}\[([^\]]+)\]:/gm;
  for (const match of text.matchAll(defPattern)) {
    const label = `[${match[1]}]`;
    const firstUse = text.indexOf(label);
    if (firstUse !== -1 && firstUse < (match.index ?? 0)) return true;
  }
  return false;
}

describe('referential stability across appends (per-line)', () => {
  for (const fixture of corpus) {
    it(fixture.name, () => {
      const keysOnly = hasLateRefDefinition(fixture.text);
      const perLine = chunkings(fixture.text).find((c) => c.name === 'per-line');
      if (!perLine) throw new Error('per-line strategy missing');

      const parser = createIncrementalParser();
      const snapshots: MarkdownBlock[][] = [];
      for (const chunk of perLine.chunks) {
        parser.append(chunk);
        // Snapshot the array contents; the parser may hand back a new array
        // each append, but settled block *objects* must be reused.
        snapshots.push([...parser.document.blocks]);
      }

      for (let s = 1; s < snapshots.length; s++) {
        const prev = snapshots[s - 1];
        const curr = snapshots[s];
        const currByKey = new Map(curr.map((b) => [b.key, b]));
        prev.forEach((prevBlock, index) => {
          // Exempt the tail: the last two blocks of the older snapshot are
          // still unsettled and may be re-created on the next append.
          if (index >= prev.length - 2) return;
          if (keysOnly) {
            // Late-ref fixture: after the one legitimate invalidation the
            // settled block's key must survive reconciliation.
            expect(currByKey.has(prevBlock.key)).toBe(true);
            return;
          }
          const currBlock = currByKey.get(prevBlock.key);
          if (currBlock) expect(currBlock).toBe(prevBlock);
        });
      }
    });
  }
});

// ── Suite 2b: key continuity through a late-ref invalidation ─────────────────

describe('key continuity across computeFresh reconciliation', () => {
  it('keeps every block key stable from first display to the end', () => {
    // A reference used before its definition forces the one legitimate
    // invalidation (computeFresh). Keys must survive it for settled AND tail
    // blocks — and must not jump when tail blocks settle afterwards
    // (regression: the settle path used to mint fresh nextKey values above
    // the keys the blocks were displayed under, remounting their DOM).
    const chunks = [
      'Use [x][r].\n\n',
      'B1\n\n',
      'B2\n\n',
      'B3\n\n',
      '[r]: https://example.com/\n\n',
      'B5\n\n',
      'B6\n\n',
      'B7\n\n'
    ];
    const parser = createIncrementalParser();
    const keyByText = new Map<string, number>();
    for (const chunk of chunks) {
      parser.append(chunk);
      const seen = new Set<number>();
      for (const block of parser.document.blocks) {
        expect(seen.has(block.key)).toBe(false);
        seen.add(block.key);
        if (block.kind !== 'paragraph') continue;
        const first = block.children[0];
        const text = first?.kind === 'text' ? first.text : JSON.stringify(block.children);
        const previous = keyByText.get(text);
        if (previous !== undefined) {
          expect(block.key).toBe(previous);
        } else {
          keyByText.set(text, block.key);
        }
      }
    }
  });
});

// ── Suite 3: URL policy holds on the parsed tree ─────────────────────────────

describe('URL policy on the hostile fixture', () => {
  const evil = corpus.find((f) => f.name === '12-evil-policy');
  if (!evil) throw new Error('12-evil-policy fixture missing');

  it('emits no javascript: href anywhere in the tree', () => {
    const doc = parseMarkdown(evil.text);
    for (const link of collectByKind(doc, 'link')) {
      expect(link.href.toLowerCase()).not.toContain('javascript:');
    }
  });

  it('blocks every image under the default (empty) allowlist', () => {
    const doc = parseMarkdown(evil.text);
    const images = collectByKind(doc, 'image');
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.blocked).toBe(true);
      expect(image.src).toBe('');
    }
  });

  it('keeps the relative link allowed', () => {
    const doc = parseMarkdown(evil.text);
    const relative = collectByKind(doc, 'link').find((l) => l.href.includes('guide.md'));
    expect(relative).toBeDefined();
    expect(relative?.blocked).toBeFalsy();
  });
});
