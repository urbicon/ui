/**
 * Chunking strategies for the streaming-parser invariant suite.
 *
 * Each strategy slices the *same* source text into an append-only chunk
 * sequence. The union of all strategies is designed to stress the parser's
 * boundary handling: `per-code-unit` deliberately splits UTF-16 surrogate pairs
 * (the hardest case — a chunk boundary can land inside a single emoji), while
 * the seeded strategies exercise arbitrary mid-token cuts reproducibly.
 *
 * Determinism is a hard requirement: no `Math.random`, no `Date.now`. The
 * seeded strategies use a tiny inline LCG so every run produces byte-identical
 * chunk boundaries.
 */

export interface Chunking {
  name: string;
  chunks: string[];
}

/**
 * Numerical-Recipes LCG. Returns a float in [0, 1). Pure and seedable, so the
 * "random" chunk sizes are fixed across runs and machines.
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Split into fixed-size code-unit windows sized by `rng` within [min, max]. */
function seededChunks(text: string, min: number, max: number, seed: number): string[] {
  const rng = makeRng(seed);
  const chunks: string[] = [];
  let i = 0;
  const span = max - min + 1;
  while (i < text.length) {
    const size = min + Math.floor(rng() * span);
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

/** Split at `\n` boundaries, keeping each newline attached to its line. */
function perLine(text: string): string[] {
  const parts = text.split('\n');
  return parts.map((part, idx) => (idx < parts.length - 1 ? `${part}\n` : part));
}

/**
 * Produce every chunking of `text`. Each strategy self-checks the fundamental
 * invariant `chunks.join('') === text` before it is returned, so a bug in the
 * harness surfaces here rather than as a confusing parser mismatch downstream.
 */
export function chunkings(text: string): Chunking[] {
  const strategies: Chunking[] = [
    { name: 'per-code-unit', chunks: text.split('') },
    { name: 'tiny-seeded', chunks: seededChunks(text, 2, 8, 0x9e3779b9) },
    { name: 'medium-seeded', chunks: seededChunks(text, 16, 64, 0x85ebca6b) },
    { name: 'per-line', chunks: perLine(text) },
    { name: 'single', chunks: [text] }
  ];

  for (const strategy of strategies) {
    if (strategy.chunks.join('') !== text) {
      throw new Error(`chunking "${strategy.name}" is not lossless — join !== source`);
    }
  }
  return strategies;
}
