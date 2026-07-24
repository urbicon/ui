// A2UI stream splitter — the piece between a model's token stream and A2UIView.
//
// Pair it with `a2uiFencedTransportSection()` (below), which tells the agent to
// emit exactly the format this parses. The two are one contract: change the
// fence tag here and the prompt changes with it, so a consumer can never end up
// with a parser and a prompt that disagree.
//
// The agent writes ordinary Markdown text and emits UI as a fenced block:
//
//     Here is your form:
//     ```a2ui
//     {"version":"v0.9.1","createSurface":{"surfaceId":"s1","catalogId":"…"}}
//     {"version":"v0.9.1","updateComponents":{"surfaceId":"s1","components":[…]}}
//     ```
//     Anything else you'd like?
//
// This module turns a *token stream* of that text into an ordered list of
// message parts — text parts and `a2ui` parts — that ChatMessage renders in
// order (the `a2ui` part flowing into A2UIView). It is a small state machine:
//
//   • text mode  → append incoming text to the current text part.
//   • a fenced line ` ```a2ui ` opens UI mode and starts a fresh a2ui part.
//   • in UI mode, a COMPLETE line that parses as JSON is appended to the a2ui
//     part's payload array (immutably: `[...prev, env]`, so A2UIView consumes
//     it incrementally and keeps prior envelope object identity).
//   • a line that does NOT parse but opens a JSON object (models like to
//     pretty-print a large updateComponents across lines) starts a multi-line
//     envelope buffer; a string-aware brace/bracket depth scanner decides when
//     the object is complete, and only then is the whole buffer parsed.
//   • a fenced line ` ``` ` closes UI mode, back to text.
//   • a line/buffer that can never become valid JSON falls the rest of the
//     fence back to text (re-emitted inside a synthetic ``` code block so the
//     fence's REAL closing ``` closes that block in the rendered Markdown
//     instead of opening a stray one) and records an issue.
//
// The splitter is CHUNK-DECOMPOSITION-INVARIANT: it buffers a partial trailing
// line and only ever acts on complete lines (plus a final flush at `end()`), so
// the committed result is identical no matter how the input was sliced into
// chunks — fence markers may straddle chunk boundaries, text may sit before /
// between / after fences, and the last line may be incomplete.

/** A streamed text segment. Structurally assignable to blocks' `ChatMessagePart` (`text`). */
export interface A2uiStreamTextPart {
  type: 'text';
  text: string;
}

/** A streamed A2UI segment. `payload` is the accumulated envelope array (assignable to `ChatMessagePart` `a2ui`). */
export interface A2uiStreamUiPart {
  type: 'a2ui';
  payload: unknown[];
}

export type A2uiStreamPart = A2uiStreamTextPart | A2uiStreamUiPart;

/** A non-fatal finding from the split (a malformed JSONL line, an unterminated fence). */
export interface A2uiStreamIssue {
  code: 'UNPARSEABLE_LINE' | 'UNTERMINATED_FENCE';
  message: string;
  /** The offending source line, when applicable. */
  line?: string;
}

interface FenceMarker {
  char: '`' | '~';
  /** Number of fence characters (≥3). */
  len: number;
  /** Info string (language), trimmed; `''` for a bare closing fence. */
  info: string;
  /** Leading-space count (0–3; ≥4 is an indented code block, not a fence). */
  indent: number;
}

/**
 * Parse a line as a CommonMark code-fence marker, or `null` if it is not one.
 * A fence is ` ``` `+ or `~~~`+ with 0–3 leading spaces (≥4 = indented code); a
 * backtick fence's info string may not contain a backtick.
 */
function parseFence(line: string): FenceMarker | null {
  const m = /^( {0,3})(`{3,}|~{3,})[ \t]*(.*?)[ \t]*$/.exec(line);
  if (!m) return null;
  const char = m[2][0] as '`' | '~';
  const info = m[3];
  if (char === '`' && info.includes('`')) return null;
  return { char, len: m[2].length, info, indent: m[1].length };
}

/**
 * The info string that marks a fence as A2UI. Shared by the parser and by
 * `a2uiFencedTransportSection()` so the prompt can never name a different tag
 * than the splitter accepts.
 */
export const A2UI_FENCE_TAG = 'a2ui';
const FENCE = '```';

/** Our special opener: a column-0 backtick fence whose info string is exactly `a2ui`. */
function isA2uiOpen(f: FenceMarker | null): boolean {
  return f !== null && f.char === '`' && f.indent === 0 && f.info === A2UI_FENCE_TAG;
}
/** A bare closing fence that terminates a fence opened with `open`. */
function isCloseOf(f: FenceMarker | null, open: { char: '`' | '~'; len: number }): boolean {
  return f !== null && f.char === open.char && f.len >= open.len && f.info === '';
}

/** Could this partial (newline-free) line still grow into our ` ```a2ui ` fence marker? */
function couldStartFence(s: string): boolean {
  const t = s.replace(/^[ \t]+/, '');
  if (t === '') return false;
  return `${FENCE}${A2UI_FENCE_TAG}`.startsWith(t) || t.startsWith(FENCE) || t.startsWith('~~~');
}

// ── Pure, immutable part-array transforms ───────────────────────────────────
// Each returns a NEW array; existing part objects (and, crucially, the parsed
// envelope objects inside a2ui payloads) are carried by reference.

function withAppendedText(parts: A2uiStreamPart[], s: string): A2uiStreamPart[] {
  if (s === '') return parts;
  const last = parts[parts.length - 1];
  if (last && last.type === 'text') {
    return [...parts.slice(0, -1), { type: 'text', text: last.text + s }];
  }
  return [...parts, { type: 'text', text: s }];
}

function withStartedA2ui(parts: A2uiStreamPart[]): A2uiStreamPart[] {
  return [...parts, { type: 'a2ui', payload: [] }];
}

function withAppendedEnvelope(parts: A2uiStreamPart[], env: unknown): A2uiStreamPart[] {
  const last = parts[parts.length - 1];
  if (last?.type !== 'a2ui') return parts;
  return [...parts.slice(0, -1), { type: 'a2ui', payload: [...last.payload, env] }];
}

/** Drop a trailing a2ui part that never received an envelope (empty fence). */
function withoutEmptyTrailingA2ui(parts: A2uiStreamPart[]): A2uiStreamPart[] {
  const last = parts[parts.length - 1];
  if (last && last.type === 'a2ui' && last.payload.length === 0) return parts.slice(0, -1);
  return parts;
}

export class A2uiStreamSplitter {
  /** Committed parts (immutable; replaced wholesale on every mutation). */
  private committed: A2uiStreamPart[] = [];
  private mode: 'text' | 'fence' = 'text';
  /**
   * When in text mode inside a *regular* (non-a2ui) markdown code fence, the
   * marker that opened it. A `` ```a2ui `` line inside such a block is literal
   * code, NOT a surface — this is what stops a quoted example from executing.
   */
  private codeFence: { char: '`' | '~'; len: number } | null = null;
  /** Buffered trailing line that has not yet seen its newline. */
  private pending = '';
  private rawText = '';
  private readonly issueList: A2uiStreamIssue[] = [];
  /**
   * Raw lines of an in-progress multi-line envelope (a pretty-printed object
   * spanning several fence lines), plus the depth-scanner state that tracks
   * whether the object has closed. Empty/zeroed while envelopes arrive as
   * proper single-line JSONL.
   */
  private objLines: string[] = [];
  private objDepth = 0;
  private objInString = false;
  private objEscape = false;

  /** Feed the next token / chunk of model output. */
  push(chunk: string): void {
    if (chunk === '') return;
    this.rawText += chunk;
    this.pending += chunk;
    for (;;) {
      const nl = this.pending.indexOf('\n');
      if (nl === -1) break;
      const line = this.pending.slice(0, nl);
      this.pending = this.pending.slice(nl + 1);
      this.processLine(line, true);
    }
  }

  /** Signal end of stream: flush the trailing partial line and settle state. */
  end(): void {
    if (this.pending !== '') {
      const line = this.pending;
      this.pending = '';
      this.processLine(line, false);
    }
    if (this.mode === 'fence') {
      // Stream ended inside a fence — settle to text and drop an empty surface.
      this.committed = withoutEmptyTrailingA2ui(this.committed);
      this.mode = 'text';
      // An envelope still buffered mid-object is re-emitted as text (inside a
      // synthetic code block) so a truncated stream never swallows it silently.
      if (this.objLines.length > 0) {
        this.asText('```', true);
        for (const buffered of this.objLines) this.asText(buffered, true);
        this.resetObjBuffer();
      }
      this.issueList.push({
        code: 'UNTERMINATED_FENCE',
        message: 'The a2ui fenced block was not closed before the stream ended.'
      });
    }
  }

  private asText(line: string, terminated: boolean): void {
    this.committed = withAppendedText(this.committed, terminated ? `${line}\n` : line);
  }

  private resetObjBuffer(): void {
    this.objLines = [];
    this.objDepth = 0;
    this.objInString = false;
    this.objEscape = false;
  }

  /**
   * Advance the depth scanner across one line: brace/bracket depth outside of
   * strings, with `\"`-escape handling inside them. Returns `false` when the
   * buffer can never become valid JSON — depth underflow, or a string left
   * open at end-of-line (raw newlines are illegal inside JSON strings).
   */
  private scanDepth(line: string): boolean {
    for (const ch of line) {
      if (this.objEscape) {
        this.objEscape = false;
        continue;
      }
      if (this.objInString) {
        if (ch === '\\') this.objEscape = true;
        else if (ch === '"') this.objInString = false;
        continue;
      }
      if (ch === '"') this.objInString = true;
      else if (ch === '{' || ch === '[') this.objDepth++;
      else if (ch === '}' || ch === ']') {
        this.objDepth--;
        if (this.objDepth < 0) return false;
      }
    }
    return !this.objInString;
  }

  /**
   * Abandon the current a2ui fence: drop an empty surface, record an issue and
   * re-emit the buffered lines (plus the offending one, if any) as text inside
   * a synthetic ``` code block. `codeFence` is armed so the fence's real
   * closing ``` closes that block instead of opening a stray one downstream.
   */
  private fenceFallback(message: string, badLine?: string, terminated = true): void {
    this.issueList.push({
      code: 'UNPARSEABLE_LINE',
      message,
      line: badLine ?? this.objLines.join('\n')
    });
    this.committed = withoutEmptyTrailingA2ui(this.committed);
    this.mode = 'text';
    this.codeFence = { char: '`', len: 3 };
    this.asText('```', true);
    const lines = badLine === undefined ? this.objLines : [...this.objLines, badLine];
    for (let i = 0; i < lines.length; i++) {
      this.asText(lines[i], i < lines.length - 1 ? true : terminated);
    }
    this.resetObjBuffer();
  }

  private processLine(rawLine: string, terminated: boolean): void {
    // Normalize CRLF: a trailing \r would otherwise defeat fence detection
    // (the marker regex ends at whitespace, not \r) and leak into JSONL lines.
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const fence = parseFence(line);

    if (this.mode === 'fence') {
      // Inside OUR a2ui block (opened by ```a2ui). Only a bare ``` closes it;
      // every other line feeds the JSONL parser (with a multi-line object
      // buffer for pretty-printed envelopes).
      if (isCloseOf(fence, { char: '`', len: 3 })) {
        if (this.objLines.length > 0) {
          // The fence closed on a still-open envelope — fall it back to text,
          // then re-process this ``` so it closes the synthetic code block.
          this.fenceFallback(
            'An a2ui envelope was still incomplete when its fence closed; falling back to text.'
          );
          this.processLine(rawLine, terminated);
          return;
        }
        this.committed = withoutEmptyTrailingA2ui(this.committed);
        this.mode = 'text';
        return;
      }

      if (this.objLines.length > 0) {
        // Continuation of a multi-line envelope.
        const viable = this.scanDepth(line);
        this.objLines.push(line);
        if (!viable) {
          this.fenceFallback(
            'An a2ui envelope was not valid JSON; falling back to text.',
            undefined,
            terminated
          );
          return;
        }
        if (this.objDepth === 0) {
          const joined = this.objLines.join('\n');
          try {
            const env = JSON.parse(joined) as unknown;
            this.committed = withAppendedEnvelope(this.committed, env);
            this.resetObjBuffer();
          } catch {
            this.fenceFallback(
              'An a2ui envelope was not valid JSON; falling back to text.',
              undefined,
              terminated
            );
          }
        }
        return;
      }

      if (line.trim() === '') return; // ignore blank lines between envelopes
      try {
        const env = JSON.parse(line) as unknown;
        this.committed = withAppendedEnvelope(this.committed, env);
      } catch {
        // Not a complete envelope. If the line opens a JSON object, buffer it
        // as the start of a multi-line envelope; anything else is garbage and
        // falls the rest of the fence back to text.
        if (line.trimStart().startsWith('{')) {
          const viable = this.scanDepth(line);
          this.objLines.push(line);
          if (!viable || this.objDepth === 0) {
            // Underflow, an unterminated string, or a braces-balanced line
            // that still failed to parse — it can never become valid JSON.
            this.fenceFallback(
              'An a2ui line was not valid JSON; falling back to text.',
              undefined,
              terminated
            );
          }
          return;
        }
        this.fenceFallback(
          'An a2ui line was not valid JSON; falling back to text.',
          line,
          terminated
        );
      }
      return;
    }

    // text mode, inside a regular (non-a2ui) code block: everything is verbatim
    // text — a ```a2ui here is quoted code, never a surface — until the matching
    // closing fence, which is itself emitted as text.
    if (this.codeFence) {
      if (isCloseOf(fence, this.codeFence)) this.codeFence = null;
      this.asText(line, terminated);
      return;
    }

    // plain text mode.
    if (isA2uiOpen(fence)) {
      this.mode = 'fence';
      this.committed = withStartedA2ui(this.committed);
      return;
    }
    if (fence) {
      // A regular code fence opens: track it so a nested ```a2ui stays literal.
      this.codeFence = { char: fence.char, len: fence.len };
    }
    this.asText(line, terminated);
  }

  /**
   * The current parts, including the buffered trailing text tail for a
   * responsive stream. A partial line that might still become a fence marker is
   * held back (never flashed). a2ui parts are carried by reference so A2UIView
   * consumes them incrementally.
   */
  snapshot(): A2uiStreamPart[] {
    if (this.mode === 'text' && this.pending !== '' && !couldStartFence(this.pending)) {
      return withAppendedText(this.committed, this.pending);
    }
    return this.committed;
  }

  /** The raw model output fed so far (fences included) — the faithful wire form. */
  get raw(): string {
    return this.rawText;
  }

  /** Accumulated non-fatal issues (malformed JSONL, unterminated fence). */
  get issues(): A2uiStreamIssue[] {
    return this.issueList;
  }
}

/** Options for {@link a2uiFencedTransportSection}. */
export interface A2uiTransportSectionOptions {
  /**
   * Prefix your client puts on a user turn that reports an action, followed by
   * the JSON `A2uiActionEvent`. Set to `false` if actions reach the agent some
   * other way (a tool result, a structured field) — the round-channel paragraph
   * is then omitted. @default '[ui-action]'
   */
  actionPrefix?: string | false;
  /**
   * Prefix for a turn that reports validation issues as JSON, so the agent can
   * repair the surface. `false` omits it. @default '[ui-error]'
   */
  errorPrefix?: string | false;
}

/**
 * The transport half of the fenced-JSONL contract: the prompt section that makes
 * an agent emit exactly what {@link A2uiStreamSplitter} parses.
 *
 * `a2uiSystemPrompt()` deliberately says nothing about transport, because how
 * envelopes travel is the app's business. This is the transport for apps that
 * take the model's ordinary text stream and let it open a ` ```a2ui ` fence —
 * the setup the splitter exists for. Append it after `a2uiSystemPrompt()` (and
 * after `a2uiDataSchemaSection()`, if you use one).
 *
 * Anything domain-specific — which tools to call, what never to invent — stays
 * yours to append; this covers only the wire format and the return path.
 *
 * @example
 * ```ts
 * const system = [
 *   a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
 *   a2uiDataSchemaSection(MY_SCHEMA),
 *   a2uiFencedTransportSection(),
 *   MY_DOMAIN_RULES
 * ].join('\n\n');
 * ```
 */
export function a2uiFencedTransportSection(options?: A2uiTransportSectionOptions): string {
  const actionPrefix = options?.actionPrefix ?? '[ui-action]';
  const errorPrefix = options?.errorPrefix ?? '[ui-error]';
  const open = `${FENCE}${A2UI_FENCE_TAG}`;

  const lines = [
    '## Transport — how your UI reaches this client',
    '',
    'Write normal Markdown prose. When (and only when) a form, a chooser, or a',
    'structured surface would genuinely help the user more than prose, emit the UI',
    `as a fenced code block tagged ${open} containing A2UI envelopes as JSONL —`,
    'one complete JSON envelope per line, no blank lines, no trailing commentary',
    'inside the fence. Example:',
    '',
    open,
    '{"version":"v0.9.1","createSurface":{"surfaceId":"form-1","catalogId":"…"}}',
    '{"version":"v0.9.1","updateComponents":{"surfaceId":"form-1","components":[ … ]}}',
    FENCE,
    '',
    'Rules for the fence:',
    `- Open the block with a line that is exactly ${open} and close it with ${FENCE}.`,
    '- Emit createSurface FIRST, then the updateComponents / updateDataModel',
    '  envelopes. Every envelope has "version":"v0.9.1".',
    '- One envelope per line, as compact single-line JSON — never pretty-print an',
    '  envelope across multiple lines (a large updateComponents stays on ONE line).',
    '- You may put prose before and/or after the fence. Do not nest fences.',
    '- Patching an EARLIER surface works the same way: open a fence and send the',
    '  updateComponents / updateDataModel envelopes for its surfaceId (no',
    '  createSurface). The client routes them to the message that shows that',
    '  surface, so it updates where it already stands — say in prose what you',
    '  changed, since it may be scrolled out of view.'
  ];

  if (actionPrefix || errorPrefix) {
    lines.push('', '## Interaction round-channel', '');
  }
  if (actionPrefix) {
    lines.push(
      'When the user interacts with a surface you sent, the client sends you a new',
      `user turn whose text begins with \`${actionPrefix} \` followed by a compact JSON`,
      'object: { name, surfaceId, sourceComponentId, timestamp, context }, plus',
      "`dataModel` (the surface's full state) when you created it with",
      '"sendDataModel": true. Treat it as the user activating a control on your',
      'surface — usually the right answer is to patch THAT surface, not to send a new',
      'one.'
    );
  }
  if (errorPrefix) {
    if (actionPrefix) lines.push('');
    lines.push(
      'If a surface you sent failed validation, the next user turn is prefixed with a',
      `\`${errorPrefix} \` line carrying the validation issues as JSON. Read it, correct`,
      'the offending envelopes, and re-emit a valid surface.'
    );
  }

  return lines.join('\n');
}
