/**
 * The pattern corpus of `examples-lint`, split out so its two silent halves can
 * be tested without paying for a svelte-check pass: which fences a document
 * yields, and which document line a diagnostic maps back to. Both fail by
 * reporting nothing rather than by throwing — a fence the extractor stops
 * recognising leaves the gate green, and a mapping that slips points a reader
 * at prose.
 *
 * Fence grammar comes from `guide-injection` (CommonMark: indentation, run
 * length, info string, `~~~` vs ```` ``` ````), so every reader of these
 * documents agrees on where a fence starts and ends.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  closesFence,
  dedentFenceLine,
  type FenceDelimiter,
  parseFenceDelimiter
} from '../src/generators/llm/guide-injection';

export interface PatternFence {
  /** Absolute path of the document the fence came from. */
  source: string;
  /** 1-based position among the ```svelte fences of that document. */
  index: number;
  /** 1-based document line of the opening ``` — code starts on the next line. */
  openLine: number;
  code: string;
}

/** A fence that opens and never closes: the rest of the document is swallowed. */
export interface UnclosedFence {
  source: string;
  line: number;
}

/**
 * Every ```svelte fence of every `*.md` directly in `dir`, in file-name order.
 * Only the info string's first word is read, so ```` ```svelte title=… ```` is
 * still a svelte fence.
 */
export function collectPatternFences(dir: string): {
  fences: PatternFence[];
  unclosed: UnclosedFence[];
} {
  const fences: PatternFence[] = [];
  const unclosed: UnclosedFence[] = [];

  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.md')) continue;
    const source = join(dir, name);
    // CRLF → LF keeps the line count, so document lines stay what the editor shows
    const lines = readFileSync(source, 'utf8').replaceAll('\r\n', '\n').split('\n');

    let open: { delim: FenceDelimiter; line: number } | null = null;
    let index = 0;
    const body: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (open) {
        if (closesFence(line, open.delim)) {
          if (open.delim.info.split(/\s+/)[0] === 'svelte')
            fences.push({ source, index: ++index, openLine: open.line, code: body.join('\n') });
          open = null;
          body.length = 0;
        } else body.push(dedentFenceLine(line, open.delim.indent));
        continue;
      }
      const delim = parseFenceDelimiter(line);
      if (delim) open = { delim, line: i + 1 };
    }

    if (open) unclosed.push({ source, line: open.line });
  }

  return { fences, unclosed };
}

/**
 * Where a diagnostic sits in the document. svelte-check counts lines from 0
 * inside the written-out `.svelte` file, whose first line is the fence's first
 * code line — one below the opening delimiter at `openLine`.
 */
export function documentLine(openLine: number, diagnosticLine: number): number {
  return openLine + diagnosticLine + 1;
}

/** The inclusive document-line span of a fence's code, for the run's report. */
export function fenceSpan(fence: PatternFence): { from: number; to: number } {
  return { from: fence.openLine + 1, to: fence.openLine + fence.code.split('\n').length };
}
