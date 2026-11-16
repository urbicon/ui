/**
 * One fence grammar for every reader of these documents (the heading demotion,
 * the marker strip, `docs:fences:lint`, the docs site's guide demos): a
 * CommonMark fence delimiter is optional indentation, three or more backticks
 * or tildes, and an info string (which cannot contain a backtick on a
 * backtick fence). A fence closes only on the same character, at least as
 * many of them, with no info string — a ``` line inside a ~~~ fence is
 * content.
 */
export interface FenceDelimiter {
  indent: number;
  char: '`' | '~';
  length: number;
  info: string;
}

export function parseFenceDelimiter(line: string): FenceDelimiter | null {
  const m = /^([ \t]*)(`{3,}|~{3,})(.*)$/.exec(line);
  if (!m) return null;
  const run = m[2] ?? '';
  const info = (m[3] ?? '').trim();
  const char = run[0] === '~' ? '~' : '`';
  if (char === '`' && info.includes('`')) return null;
  return { indent: (m[1] ?? '').length, char, length: run.length, info };
}

export function closesFence(line: string, open: FenceDelimiter): boolean {
  const d = parseFenceDelimiter(line);
  return d !== null && d.char === open.char && d.length >= open.length && d.info === '';
}

/** CommonMark: a fence's content is de-indented by up to the opener's indentation. */
export function dedentFenceLine(line: string, indent: number): string {
  let n = 0;
  while (n < indent && (line[n] === ' ' || line[n] === '\t')) n++;
  return line.slice(n);
}
