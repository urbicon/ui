import Anthropic from '@anthropic-ai/sdk';
import {
  a2uiDataSchemaSection,
  a2uiSystemPrompt,
  urbiconA2uiCatalogSpec
} from '@urbicon-ui/blocks';
// $env/dynamic/private reads the API key at RUNTIME. `$env/static/private`
// would inline it at build time and fail the build when no .env is present —
// so the root build (`bun --filter='./apps/*' run build`) stays key-free.
import { env } from '$env/dynamic/private';
import { BOOKING_SCHEMA } from '$lib/booking-schema';
import { executeSalonTool, SALON_TOOLS } from '$lib/salon-tools';
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
  'offending envelopes, and re-emit a valid surface.',
  '',
  '## Grounding — never invent business data',
  '',
  'You have a tool for real salon data (services, stylists, free slots). Before',
  'you build a booking-related surface or confirm an appointment, CALL the tool',
  'and build the UI strictly from its data — never invent services, stylists,',
  'prices, dates or time slots. If the user asks for something the data does not',
  'offer, say so in prose instead of inventing options.'
].join('\n');

// The demo defaults to the Urbicon catalog (the full vocabulary + a data
// schema); `?catalog=basic` switches to the v0.9.1 Basic subset for an A/B
// comparison. The client picks the matching catalog for A2UIView.
function buildSystemPrompt(useUrbicon: boolean): string {
  if (useUrbicon) {
    return [
      a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
      a2uiDataSchemaSection(BOOKING_SCHEMA),
      TRANSPORT_SECTION
    ].join('\n\n');
  }
  return `${a2uiSystemPrompt()}\n\n${TRANSPORT_SECTION}`;
}

const sseHeaders = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  connection: 'keep-alive'
} as const;

export const POST: RequestHandler = async ({ request, url }) => {
  const useUrbicon = url.searchParams.get('catalog') !== 'basic';
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
      // Enqueueing after the client cancelled throws — a gone client is not an
      // error, so every send is a best-effort write.
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* client disconnected */
        }
      };

      try {
        // Agent loop: stream a turn; when the model stops to call a tool,
        // execute it, append the tool_result and stream the follow-up turn.
        // Text deltas of every round flow out as `token` events; `tool_start` /
        // `tool_result` bracket each execution so the client can render a
        // ToolCallCard. Bounded — a runaway tool loop fails loud.
        const MAX_TOOL_ROUNDS = 4;
        let turns: Anthropic.MessageParam[] = [...messages];

        for (let round = 0; ; round++) {
          // The request signal goes to the SDK as the request option: the SDK
          // both honors an ALREADY-aborted signal and listens for a later abort
          // (a bare addEventListener here would miss the former and leak one
          // listener per round).
          const run = client.messages.stream(
            {
              model: 'claude-opus-4-8',
              max_tokens: 8192,
              system: buildSystemPrompt(useUrbicon),
              messages: turns,
              tools: SALON_TOOLS
            },
            { signal: request.signal }
          );

          run.on('text', (delta) => send('token', { text: delta }));
          const final = await run.finalMessage();

          if (final.stop_reason !== 'tool_use') break;
          if (round >= MAX_TOOL_ROUNDS) {
            send('error', { message: `Tool loop exceeded ${MAX_TOOL_ROUNDS} rounds` });
            break;
          }

          const toolUses = final.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
          );
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUses) {
            send('tool_start', { id: toolUse.id, name: toolUse.name, input: toolUse.input });
            const output = executeSalonTool(toolUse.name, toolUse.input);
            send('tool_result', { id: toolUse.id, output });
            results.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(output)
            });
          }
          turns = [
            ...turns,
            { role: 'assistant', content: final.content },
            { role: 'user', content: results }
          ];
        }
        send('done', {});
      } catch (err) {
        // A client abort surfaces as an SDK abort error — end quietly.
        if (!request.signal.aborted) {
          send('error', { message: err instanceof Error ? err.message : 'stream failed' });
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed by cancellation */
        }
      }
    }
  });

  return new Response(stream, { headers: sseHeaders });
};
