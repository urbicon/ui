import Anthropic from '@anthropic-ai/sdk';
import {
  a2uiDataSchemaSection,
  a2uiFencedTransportSection,
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

// Transport: the fenced-JSONL contract ships WITH the parser
// (`a2uiFencedTransportSection` is the prompt half of `A2uiStreamSplitter`), so
// the format can never drift from what the client reads. Only the domain rule
// below is ours to write.
const GROUNDING_SECTION = [
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
  const sections = useUrbicon
    ? [a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }), a2uiDataSchemaSection(BOOKING_SCHEMA)]
    : [a2uiSystemPrompt()];
  return [...sections, a2uiFencedTransportSection(), GROUNDING_SECTION].join('\n\n');
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
