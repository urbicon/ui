import { type InlineContext, parseInlines } from './inline';
import { repairMarkdownTail } from './repair';
import type {
  BlockNode,
  IncrementalMarkdownParser,
  ListItem,
  MarkdownBlock,
  MarkdownDocument,
  MarkdownParseOptions
} from './types';

/**
 * Block-level engine: a line-based scanner (phase A) producing raw block
 * spans + link-reference definitions, an inline materializer (phase B), the
 * one-shot `parseMarkdown`, and the incremental parser with a settled-block
 * cache.
 *
 * Streaming correctness model (the P0 invariant):
 * - Only the region up to the start of the second-to-last raw block is ever
 *   settled. A block can only be extended by lines immediately following it,
 *   so once a *complete* further block plus the start of another exists, it
 *   can no longer change — the two-block buffer covers loose lists, lazy
 *   continuation and table assembly.
 * - `repairMarkdownTail` runs on the *last block only*. Repairing earlier
 *   text could close markers that the one-shot parse would render literally,
 *   which would break `stream(chunks) === parse(fullText)`.
 * - Late link-reference definitions (`[ref]: url` streaming in after use —
 *   the Astryx lesson): settled blocks record the labels they failed to
 *   resolve; when a matching definition arrives, the parser re-parses from
 *   scratch, reconciling block keys by position so keyed `{#each}` patches
 *   instead of remounting.
 */

// ── Line splitting ───────────────────────────────────────────────────────────

interface Line {
  text: string;
  /** Offset of the line start in the scanned text. */
  start: number;
}

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i += 1) {
    if (i === text.length || text[i] === '\n') {
      lines.push({ text: text.slice(start, i), start });
      start = i + 1;
    }
  }
  return lines;
}

// ── Phase A: raw block scan ──────────────────────────────────────────────────

type RawBlock =
  | { type: 'paragraph'; start: number; lines: string[] }
  | { type: 'heading'; start: number; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'fence'; start: number; lang?: string; code: string[]; open: boolean }
  | { type: 'list'; start: number; ordered: boolean; startNumber?: number; lines: string[] }
  | { type: 'quote'; start: number; lines: string[] }
  | { type: 'table'; start: number; header: string; delimiter: string; rows: string[] }
  | { type: 'hr'; start: number };

interface ScanResult {
  blocks: RawBlock[];
  refs: Map<string, { href: string; title?: string }>;
  /**
   * Label of a reference definition sitting on the final, not-yet-terminated
   * line — its URL may still be streaming in. Such a definition is used for
   * display (one-shot parity if the stream really ends here) but never for
   * settling, and it does not count as "arrived" for invalidation purposes.
   */
  unstableRefLabel?: string;
}

const FENCE_OPEN = /^ {0,3}(```+)\s*([^\s`]*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+\s*)?$/;
const HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}>\s?/;
const LIST_MARKER = /^(\s*)([-*+]|\d{1,9}[.)])(\s+|$)/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const REF_DEF = /^ {0,3}\[([^\]]+)\]:\s*(\S+)(?:\s+["'(](.*)["')])?\s*$/;

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

export function scanBlocks(text: string): ScanResult {
  const lines = splitLines(text);
  const blocks: RawBlock[] = [];
  const refs = new Map<string, { href: string; title?: string }>();
  let unstableRefLabel: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line.text)) {
      i += 1;
      continue;
    }

    const fence = FENCE_OPEN.exec(line.text);
    if (fence) {
      const marker = fence[1];
      const code: string[] = [];
      let open = true;
      let j = i + 1;
      for (; j < lines.length; j += 1) {
        const closing = /^ {0,3}(```+)\s*$/.exec(lines[j].text);
        if (closing && closing[1].length >= marker.length) {
          open = false;
          j += 1;
          break;
        }
        code.push(lines[j].text);
      }
      blocks.push({ type: 'fence', start: line.start, lang: fence[2] || undefined, code, open });
      i = j;
      continue;
    }

    const heading = HEADING.exec(line.text);
    if (heading) {
      blocks.push({
        type: 'heading',
        start: line.start,
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: heading[2]
      });
      i += 1;
      continue;
    }

    if (HR.test(line.text) && !LIST_MARKER.test(line.text)) {
      blocks.push({ type: 'hr', start: line.start });
      i += 1;
      continue;
    }

    if (QUOTE.test(line.text)) {
      const quoteLines: string[] = [];
      let j = i;
      while (j < lines.length && QUOTE.test(lines[j].text)) {
        quoteLines.push(lines[j].text.replace(QUOTE, ''));
        j += 1;
      }
      blocks.push({ type: 'quote', start: line.start, lines: quoteLines });
      i = j;
      continue;
    }

    const listMatch = LIST_MARKER.exec(line.text);
    if (listMatch && !HR.test(line.text)) {
      const baseIndent = listMatch[1].length;
      const ordered = /\d/.test(listMatch[2]);
      const startNumber = ordered ? Number.parseInt(listMatch[2], 10) : undefined;
      const listLines: string[] = [];
      let j = i;
      let pendingBlanks = 0;
      while (j < lines.length) {
        const current = lines[j].text;
        if (isBlank(current)) {
          pendingBlanks += 1;
          j += 1;
          continue;
        }
        const marker = LIST_MARKER.exec(current);
        const indent = /^\s*/.exec(current)?.[0].length ?? 0;
        const isSameKindMarker =
          marker && marker[1].length <= baseIndent + 1 && /\d/.test(marker[2]) === ordered;
        const isContinuation = indent >= baseIndent + 2;
        const isLazy = pendingBlanks === 0 && listLines.length > 0 && !marker;
        if (isSameKindMarker || isContinuation || (isLazy && indent > 0) || (isLazy && !marker)) {
          for (; pendingBlanks > 0; pendingBlanks -= 1) listLines.push('');
          listLines.push(current);
          j += 1;
          continue;
        }
        break;
      }
      blocks.push({ type: 'list', start: line.start, ordered, startNumber, lines: listLines });
      i = j;
      continue;
    }

    const refDef = REF_DEF.exec(line.text);
    if (refDef) {
      const label = refDef[1].trim().toLowerCase();
      // First definition wins (CommonMark) — critical for stream/one-shot parity.
      if (!refs.has(label)) {
        refs.set(label, { href: refDef[2], title: refDef[3] });
        // `splitLines` emits a trailing empty line when the text ends in \n,
        // so index === length-1 means this line is still unterminated.
        if (i === lines.length - 1) unstableRefLabel = label;
      }
      i += 1;
      continue;
    }

    if (
      line.text.includes('|') &&
      i + 1 < lines.length &&
      TABLE_DELIMITER.test(lines[i + 1].text)
    ) {
      const rows: string[] = [];
      let j = i + 2;
      while (j < lines.length && !isBlank(lines[j].text) && lines[j].text.includes('|')) {
        rows.push(lines[j].text);
        j += 1;
      }
      blocks.push({
        type: 'table',
        start: line.start,
        header: line.text,
        delimiter: lines[i + 1].text,
        rows
      });
      i = j;
      continue;
    }

    // Paragraph: consecutive non-blank lines that start no other block type.
    const paragraphLines: string[] = [line.text];
    let j = i + 1;
    while (j < lines.length) {
      const current = lines[j].text;
      if (
        isBlank(current) ||
        FENCE_OPEN.test(current) ||
        HEADING.test(current) ||
        HR.test(current) ||
        QUOTE.test(current) ||
        LIST_MARKER.exec(current) ||
        (current.includes('|') && j + 1 < lines.length && TABLE_DELIMITER.test(lines[j + 1].text))
      ) {
        break;
      }
      paragraphLines.push(current);
      j += 1;
    }
    blocks.push({ type: 'paragraph', start: line.start, lines: paragraphLines });
    i = j;
  }

  return { blocks, refs, unstableRefLabel };
}

// ── Phase B: materialization ─────────────────────────────────────────────────

interface MaterializeContext extends InlineContext {
  onUnresolvedRef?: (label: string) => void;
}

function materialize(raw: RawBlock, ctx: MaterializeContext): BlockNode {
  switch (raw.type) {
    case 'paragraph':
      return { kind: 'paragraph', children: parseInlines(raw.lines.join('\n'), ctx) };
    case 'heading':
      return { kind: 'heading', level: raw.level, children: parseInlines(raw.text, ctx) };
    case 'fence':
      return {
        kind: 'code-block',
        lang: raw.lang,
        code: raw.code.join('\n'),
        ...(raw.open ? { open: true } : {})
      };
    case 'hr':
      return { kind: 'hr' };
    case 'quote': {
      const inner = scanBlocks(raw.lines.join('\n'));
      return { kind: 'blockquote', children: inner.blocks.map((b) => materialize(b, ctx)) };
    }
    case 'table':
      return materializeTable(raw, ctx);
    case 'list':
      return materializeList(raw, ctx);
  }
}

const TASK_MARKER = /^\[([ xX])\]\s+/;

function materializeList(
  raw: Extract<RawBlock, { type: 'list' }>,
  ctx: MaterializeContext
): BlockNode {
  const items: ListItem[] = [];
  let currentContent: string[] | null = null;
  let currentChecked: boolean | undefined;
  let contentIndent = 2;

  const flush = () => {
    if (currentContent === null) return;
    const inner = scanBlocks(currentContent.join('\n'));
    items.push({
      children: inner.blocks.map((b) => materialize(b, ctx)),
      ...(currentChecked !== undefined ? { checked: currentChecked } : {})
    });
  };

  for (const line of raw.lines) {
    const marker = LIST_MARKER.exec(line);
    const indent = /^\s*/.exec(line)?.[0].length ?? 0;
    if (
      marker &&
      indent <= (items.length === 0 && currentContent === null ? indent : contentIndent - 1)
    ) {
      flush();
      contentIndent = marker[1].length + marker[2].length + (marker[3]?.length || 1);
      let rest = line.slice(marker[0].length);
      const task = TASK_MARKER.exec(rest);
      currentChecked = undefined;
      if (task) {
        currentChecked = task[1] !== ' ';
        rest = rest.slice(task[0].length);
      }
      currentContent = [rest];
    } else if (currentContent) {
      currentContent.push(line.slice(Math.min(indent, contentIndent)));
    }
  }
  flush();

  return {
    kind: 'list',
    ordered: raw.ordered,
    ...(raw.ordered && raw.startNumber !== undefined && raw.startNumber !== 1
      ? { start: raw.startNumber }
      : {}),
    items
  };
}

function splitTableRow(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (ch === '\\' && row[i + 1] === '|') {
      current += '|';
      i += 1;
    } else if (ch === '|') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  // Leading/trailing pipes produce empty edge cells — drop them.
  if (cells.length > 0 && cells[0].trim() === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map((c) => c.trim());
}

function materializeTable(
  raw: Extract<RawBlock, { type: 'table' }>,
  ctx: MaterializeContext
): BlockNode {
  const align = splitTableRow(raw.delimiter).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center' as const;
    if (right) return 'right' as const;
    if (left) return 'left' as const;
    return null;
  });
  const header = splitTableRow(raw.header).map((cell) => parseInlines(cell, ctx));
  const rows = raw.rows.map((row) => splitTableRow(row).map((cell) => parseInlines(cell, ctx)));
  return { kind: 'table', align, header, rows };
}

// ── Normalization (streaming-safe CRLF handling) ─────────────────────────────

function normalizeChunk(
  chunk: string,
  prevEndedWithCR: boolean
): { text: string; endsWithCR: boolean } {
  let text = chunk;
  if (prevEndedWithCR && text.startsWith('\n')) text = text.slice(1);
  const endsWithCR = text.endsWith('\r');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return { text, endsWithCR };
}

// ── One-shot parse ───────────────────────────────────────────────────────────

export function parseMarkdown(text: string, options: MarkdownParseOptions = {}): MarkdownDocument {
  const normalized = normalizeChunk(text, false).text;
  const { blocks: rawBlocks, refs } = scanBlocks(normalized);
  const ctx: MaterializeContext = { linkRefs: refs, options };
  const blocks: MarkdownBlock[] = rawBlocks.map(
    (raw, index) => Object.assign(materialize(raw, ctx), { key: index }) as MarkdownBlock
  );
  return { blocks, linkRefs: refs };
}

// ── Incremental parser ───────────────────────────────────────────────────────

/** Blocks kept unsettled at the end of the stream (see module docstring). */
const TAIL_BUFFER = 2;

export function createIncrementalParser(
  options: MarkdownParseOptions = {}
): IncrementalMarkdownParser {
  let raw = '';
  let norm = '';
  let endsWithCR = false;
  let settledUpTo = 0;
  let settled: MarkdownBlock[] = [];
  let settledRefs = new Map<string, { href: string; title?: string }>();
  let unresolvedLabels = new Set<string>();
  let nextKey = 0;
  let doc: MarkdownDocument = { blocks: [], linkRefs: settledRefs };

  function mergeRefs(
    tailRefs: Map<string, { href: string; title?: string }>
  ): Map<string, { href: string; title?: string }> {
    const merged = new Map(settledRefs);
    for (const [label, def] of tailRefs) {
      if (!merged.has(label)) merged.set(label, def);
    }
    return merged;
  }

  function compute(): void {
    const tail = norm.slice(settledUpTo);
    const scan = scanBlocks(tail);
    const merged = mergeRefs(scan.refs);

    // Late reference definition that a settled block failed to resolve →
    // re-parse everything, reconciling keys so the UI patches in place. An
    // unstable definition (final unterminated line) does not count as
    // arrived yet — invalidating on it would freeze a half-streamed URL.
    let invalidated = false;
    for (const label of unresolvedLabels) {
      if (scan.refs.has(label) && label !== scan.unstableRefLabel && !settledRefs.has(label)) {
        invalidated = true;
        break;
      }
    }
    if (invalidated) {
      const previous = doc.blocks;
      settledUpTo = 0;
      settled = [];
      settledRefs = new Map();
      unresolvedLabels = new Set();
      nextKey = 0;
      computeFresh(previous);
      return;
    }

    computeTail(tail, scan, merged);
  }

  function computeFresh(previousBlocks: MarkdownBlock[]): void {
    const tail = norm;
    const scan = scanBlocks(tail);
    computeTail(tail, scan, mergeRefs(scan.refs));
    // Key reconciliation by position: same-kind blocks keep their old key.
    let maxKey = -1;
    doc.blocks.forEach((block, index) => {
      const old = previousBlocks[index];
      if (old && old.kind === block.kind) block.key = old.key;
      maxKey = Math.max(maxKey, block.key);
    });
    nextKey = Math.max(nextKey, maxKey + 1);
  }

  function computeTail(
    tail: string,
    scan: ScanResult,
    merged: Map<string, { href: string; title?: string }>
  ): void {
    const rawBlocks = scan.blocks;

    // Settle everything before the second-to-last block. Never settle while
    // the raw text ends in a bare CR (its normalization could still change).
    if (rawBlocks.length > TAIL_BUFFER && !endsWithCR) {
      const settleCount = rawBlocks.length - TAIL_BUFFER;
      const boundary = rawBlocks[settleCount].start;
      // Settling must never bake in a half-streamed definition — resolve
      // against stable refs only; the unresolved hook plus the invalidation
      // path above pick the block up once the definition completes.
      const stableRefs = scan.unstableRefLabel === undefined ? merged : new Map(merged);
      if (scan.unstableRefLabel !== undefined && !settledRefs.has(scan.unstableRefLabel)) {
        stableRefs.delete(scan.unstableRefLabel);
      }
      const settleCtx: MaterializeContext = {
        linkRefs: stableRefs,
        options,
        onUnresolvedRef: (label) => unresolvedLabels.add(label)
      };
      for (let k = 0; k < settleCount; k += 1) {
        // A settling block must keep the key it was *displayed* under, or the
        // keyed {#each} remounts it. In the steady state nextKey coincides
        // with the shown key by construction, but after a computeFresh
        // reconciliation the shown keys lag behind nextKey — so always prefer
        // the previous document's key at this position (same kind).
        const prevShown = doc.blocks[settled.length + k];
        const block = materialize(rawBlocks[k], settleCtx) as MarkdownBlock;
        block.key = prevShown && prevShown.kind === block.kind ? prevShown.key : nextKey;
        nextKey = Math.max(nextKey, block.key + 1);
        settled.push(block);
      }
      // Reference definitions inside the settled region become permanent.
      const settledRegion = scanBlocks(tail.slice(0, boundary));
      for (const [label, def] of settledRegion.refs) {
        if (!settledRefs.has(label)) settledRefs.set(label, def);
      }
      settledUpTo += boundary;
      computeTail(norm.slice(settledUpTo), scanBlocks(norm.slice(settledUpTo)), merged);
      return;
    }

    // Display path: repair only the last block's slice, then parse the buffer.
    let displayText = tail;
    if (rawBlocks.length > 0) {
      const lastStart = rawBlocks[rawBlocks.length - 1].start;
      displayText = tail.slice(0, lastStart) + repairMarkdownTail(tail.slice(lastStart));
    }
    const displayScan = scanBlocks(displayText);
    const displayRefs = mergeRefs(displayScan.refs);
    const ctx: MaterializeContext = { linkRefs: displayRefs, options };
    // Tail keys mirror the settle path: reuse the key each position was last
    // displayed under (kept stable across computeFresh reconciliation); fresh
    // positions draw collision-free keys above nextKey without persisting the
    // counter — the same position deterministically redraws the same key.
    const usedKeys = new Set(settled.map((block) => block.key));
    let alloc = nextKey;
    const takeFresh = (): number => {
      while (usedKeys.has(alloc)) alloc += 1;
      const key = alloc;
      alloc += 1;
      return key;
    };
    const tailBlocks = displayScan.blocks.map((rawBlock, index) => {
      const block = materialize(rawBlock, ctx) as MarkdownBlock;
      const prevShown = doc.blocks[settled.length + index];
      block.key =
        prevShown && prevShown.kind === block.kind && !usedKeys.has(prevShown.key)
          ? prevShown.key
          : takeFresh();
      usedKeys.add(block.key);
      return block;
    });
    doc = { blocks: [...settled, ...tailBlocks], linkRefs: displayRefs };
  }

  return {
    append(chunk: string): MarkdownDocument {
      raw += chunk;
      const normalized = normalizeChunk(chunk, endsWithCR);
      norm += normalized.text;
      endsWithCR = normalized.endsWithCR;
      compute();
      return doc;
    },
    get document(): MarkdownDocument {
      return doc;
    },
    get source(): string {
      return raw;
    },
    reset(): void {
      raw = '';
      norm = '';
      endsWithCR = false;
      settledUpTo = 0;
      settled = [];
      settledRefs = new Map();
      unresolvedLabels = new Set();
      nextKey = 0;
      doc = { blocks: [], linkRefs: settledRefs };
    }
  };
}
