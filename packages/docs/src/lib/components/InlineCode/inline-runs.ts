/** A stretch of text with one combination of inline marks. */
export interface InlineRun {
  text: string;
  code: boolean;
  strong: boolean;
  em: boolean;
}

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | {
      kind: 'delim';
      text: string;
      canOpen: boolean;
      canClose: boolean;
      role?: 'open' | 'close';
    };

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);

/**
 * Splits a JSDoc-style string into runs of code (`` `x` ``), strong
 * (`**x**`) and emphasis (`*x*`) — the inline subset prop descriptions are
 * written in. Everything else, links and underscores included, stays text.
 *
 * Returns plain data, never markup: the caller renders each run through
 * text interpolation, so nothing in the input is ever parsed as HTML.
 *
 * Inside a code span asterisks are literal. An odd number of backticks
 * leaves all of them as characters (one is a stray, not a marker), and a
 * `*` / `**` without a partner — or with whitespace on its inner side, as
 * in `a * b` — stays a character too.
 */
export function parseInlineRuns(input: string): InlineRun[] {
  const text = input ?? '';
  const codeEnabled = (text.match(/`/g)?.length ?? 0) % 2 === 0;
  const tokens: Token[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) tokens.push({ kind: 'text', text: buffer });
    buffer = '';
  };

  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === '`' && codeEnabled) {
      const end = text.indexOf('`', i + 1);
      flush();
      tokens.push({ kind: 'code', text: text.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (ch === '*') {
      let end = i;
      while (text[end] === '*') end++;
      const run = text.slice(i, end);
      if (run.length <= 2) {
        flush();
        tokens.push({
          kind: 'delim',
          text: run,
          canOpen: !isSpace(text[end]),
          canClose: !isSpace(text[i - 1])
        });
      } else {
        buffer += run;
      }
      i = end;
      continue;
    }
    buffer += ch;
    i++;
  }
  flush();

  // Pair delimiters: a closer takes the nearest open delimiter of its own
  // length; openers it skips over can no longer pair and stay literal.
  const open: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token?.kind !== 'delim') continue;
    if (token.canClose) {
      let match = -1;
      for (let s = open.length - 1; s >= 0; s--) {
        const candidate = tokens[open[s] as number];
        if (candidate?.kind === 'delim' && candidate.text === token.text) {
          match = s;
          break;
        }
      }
      if (match >= 0) {
        const opener = tokens[open[match] as number];
        if (opener?.kind === 'delim') opener.role = 'open';
        token.role = 'close';
        open.length = match;
        continue;
      }
    }
    if (token.canOpen) open.push(i);
  }

  const runs: InlineRun[] = [];
  let strong = 0;
  let em = 0;
  const push = (value: string, code: boolean) => {
    const marks = { code, strong: strong > 0, em: em > 0 };
    const last = runs.at(-1);
    if (last && !code && !last.code && last.strong === marks.strong && last.em === marks.em) {
      last.text += value;
    } else {
      runs.push({ text: value, ...marks });
    }
  };

  for (const token of tokens) {
    if (token.kind === 'delim' && token.role) {
      const delta = token.role === 'open' ? 1 : -1;
      if (token.text === '**') strong += delta;
      else em += delta;
      continue;
    }
    push(token.text, token.kind === 'code');
  }
  return runs;
}
