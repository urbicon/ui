import Anthropic from '@anthropic-ai/sdk';
import { a2uiSystemPrompt } from '@urbicon-ui/blocks';
// $env/dynamic/private reads the API key at RUNTIME. `$env/static/private`
// would inline it at build time and fail the build when no .env is present —
// so the root build (`bun --filter='./apps/*' run build`) stays key-free.
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/** The flat wire history the client posts: text-only per turn. */
interface WireMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Transport section: how UI reaches THIS client. a2uiSystemPrompt() deliberately
// omits transport (it is app-specific); we append the fenced-JSONL protocol plus
// the interaction / error round-channel this demo uses.
const FENCE = '```';
const TRANSPORT_SECTION = [
  '## Transport — how your UI reaches this client',
  '',
  'Write normal Markdown prose. When (and only when) a form, a chooser, or a',
  'structured surface would genuinely help the user more than prose, emit the UI',
  `as a fenced code block tagged ${FENCE}a2ui containing A2UI envelopes as JSONL —`,
  'one complete JSON envelope per line, no blank lines, no trailing commentary',
  'inside the fence. Example:',
  '',
  `${FENCE}a2ui`,
  '{"version":"v0.9.1","createSurface":{"surfaceId":"form-1","catalogId":"…"}}',
  '{"version":"v0.9.1","updateComponents":{"surfaceId":"form-1","components":[ … ]}}',
  FENCE,
  '',
  'Rules for the fence:',
  `- Open the block with a line that is exactly ${FENCE}a2ui and close it with ${FENCE}.`,
  '- Emit createSurface FIRST, then the updateComponents / updateDataModel',
  '  envelopes. Every envelope has "version":"v0.9.1".',
  '- Give each response a fresh, unique surfaceId (e.g. include a short suffix).',
  '- One envelope per line, as compact single-line JSON — never pretty-print an',
  '  envelope across multiple lines (a large updateComponents stays on ONE line).',
  '- You may put prose before and/or after the fence. Do not nest fences.',
  '',
  '## Interaction round-channel',
  '',
  'When the user interacts with a surface you sent, the client sends you a new',
  'user turn whose text begins with `[ui-action] ` followed by a compact JSON',
  'object: { name, surfaceId, sourceComponentId, timestamp, context }. Treat it as',
  'the user activating a control on your surface — respond with prose and/or a new',
  'surface as appropriate.',
  '',
  'If a surface you sent failed validation, the next user turn is prefixed with a',
  '`[ui-error] ` line carrying the validation issues as JSON. Read it, correct the',
  'offending envelopes, and re-emit a valid surface.'
].join('\n');

function buildSystemPrompt(): string {
  return `${a2uiSystemPrompt()}\n\n${TRANSPORT_SECTION}`;
}

const sseHeaders = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  connection: 'keep-alive'
} as const;

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fail loud at runtime with a clear message — never at build time.
    return new Response(
      JSON.stringify({
        message:
          'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key, then restart the dev server.'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const client = new Anthropic({ apiKey });
  const { messages } = (await request.json()) as { messages: WireMessage[] };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        const run = client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 8192,
          system: buildSystemPrompt(),
          messages
        });

        // Forward the client's abort straight through to the model stream.
        request.signal.addEventListener('abort', () => run.abort());

        run.on('text', (delta) => send('token', { text: delta }));
        await run.finalMessage();
        send('done', {});
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'stream failed' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, { headers: sseHeaders });
};
