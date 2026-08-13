/**
 * Records a real agent conversation into the replay fixture.
 *
 * The hotel demo (`/hotel`, the landing's A2UI tile) plays this back instead
 * of calling the model: the showcase is the *design* claim (one payload, four
 * houses), so it must not depend on an API key, on the network, or on the
 * model's mood on the day.
 *
 * What this script writes is genuine model output throughout. The fixture in
 * the repo is that, minus some prose: the A2UI envelopes are untouched, the
 * sentences around them were tightened by hand on 2026-08-13. Re-running this
 * script overwrites both — expect to redo that pass, and see the note in
 * `src/lib/replay/player.ts` for which line is being held.
 *
 * This script IS the recording source the salon era lost when `apps/chat-demo`
 * was retired: instead of a dev-server relay it runs the same agent loop
 * in-process — Anthropic streaming, the fenced-A2UI system prompt from
 * `@urbicon-ui/blocks`, and `executeHotelTool` answering the tool calls — and
 * writes the frames exactly as an SSE relay would have emitted them
 * (`token` / `tool_start` / `tool_result`), so the player consumes either
 * transport unchanged. No endpoint ships anywhere; the key never leaves the
 * machine that records.
 *
 * Usage (from the repo root, so Bun picks up the root .env):
 *   bun apps/docs/scripts/record-fixture.ts
 *
 * Turns are recorded in sequence, each seeing the previous ones as history. The
 * follow-up turn is the user pressing a button on the surface the first turn
 * built, so its `[ui-action]` line is derived from that payload rather than
 * written by hand — the model names its own actions, and a guessed name would
 * record the agent answering a click it never offered.
 */

import Anthropic from '@anthropic-ai/sdk';
// Relative dist imports on purpose: the package barrel re-exports Svelte
// runtime modules (`.svelte.js` with runes), which bare Bun cannot execute —
// the old relay only got away with the barrel because it ran inside Vite. The
// exports map allows no deep subpaths, so the workspace path it is. These two
// modules are plain TS output with no Svelte in their import graph.
import { a2uiSystemPrompt } from '../../../packages/blocks/dist/components/Chat/A2UIView/a2ui-prompt.js';
import { a2uiDataSchemaSection } from '../../../packages/blocks/dist/components/Chat/A2UIView/a2ui-schema.js';
import { a2uiFencedTransportSection } from '../../../packages/blocks/dist/components/Chat/A2UIView/a2ui-stream.js';
import { urbiconA2uiCatalogSpec } from '../../../packages/blocks/dist/components/Chat/A2UIView/urbicon/a2ui-urbicon-registry.js';
import { BOOKING_SCHEMA } from '../src/lib/booking-schema';
import { executeHotelTool, HOTEL_TOOLS } from '../src/lib/hotel-tools';

interface Frame {
  event: string;
  data: unknown;
}
interface RecordedTurn {
  /** What goes on the wire (may carry the `[ui-action]` prefix). */
  wire: string;
  /** What the transcript shows the user (falls back to `wire`). */
  display?: string;
  frames: Frame[];
}

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const outPath = flag(
  'out',
  new URL('../src/lib/replay/booking-fixture.json', import.meta.url).pathname
);
const model = flag('model', 'claude-opus-5');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(
    'ANTHROPIC_API_KEY is not set — run from the repo root so Bun loads the root .env.'
  );
  process.exit(1);
}

/** The opening turn. Everything after it is derived from what the model emits.
 * The year is spelled out: an unanchored "early September" got resolved into
 * the model's own past on the first recording, and a demo that books last
 * year reads as a bug, not as a booking. */
const OPENING =
  'Two of us, three quiet nights by the sea in early September 2026 — somewhere we can swim before breakfast.';

/**
 * What the user "fills in" before pressing the action button. Checked against
 * the deterministic availability before recording: for 2026-09-03 → 06 Cala
 * has exactly one garden room free, which is the stay the opening asks for.
 */
const FILLED_IN = {
  name: 'Marlowe',
  house: ['cala'],
  room: ['garden'],
  checkIn: '2026-09-03',
  checkOut: '2026-09-06',
  guests: 2,
  notes: '',
  agreed: true
};

// Same assembly as a live relay would use: the catalog contract, the
// data-model contract and the wire format all come from the library, so the
// prompt can never describe UI the renderer rejects. Only the domain rule
// below is ours to write.
const GROUNDING_SECTION = [
  '## Grounding — never invent business data',
  '',
  'You have a tool for real hotel data (the houses of the group, room types,',
  'rates, and what is free for a date range). Before you build a booking-related',
  'surface, CALL get_hotel_info and build the UI strictly from its data — never',
  'invent houses, room types, rates, dates or availability. If the user asks for',
  'something the data does not offer, say so in prose instead of inventing',
  'options.',
  '',
  // One call, not two: the first recording opened with a parameterless catalog
  // call followed by the dated one, and two identical tool chips in the
  // transcript read as a retry to anyone watching the replay.
  'One call with checkIn and checkOut returns everything at once — the houses,',
  'the room types with rates, AND the availability. Never call get_hotel_info',
  'twice in one turn, and never call it without dates when the user has given any.',
  '',
  // The write half. Without this the model narrates the booking: it has all the
  // numbers from the read tool and no reason to believe a further call exists,
  // so "Booked — €900 total" comes out as prose it computed itself.
  '## Confirming a stay',
  '',
  'When the guest presses the button that commits the booking, CALL create_booking.',
  'Do not announce a confirmed stay before that call returns, and do not call',
  'get_hotel_info first — create_booking re-checks availability itself.',
  '',
  'The reference, the total and the `note` in its result are the authoritative',
  'ones: quote them, never compute or invent them. The note states that this is a',
  'demonstration — pass it on to the guest in your own confirmation, and keep the',
  'reference visible on the surface you build.'
].join('\n');

const SYSTEM_PROMPT = [
  a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
  a2uiDataSchemaSection(BOOKING_SCHEMA),
  a2uiFencedTransportSection(),
  GROUNDING_SECTION
].join('\n\n');

/**
 * Find every action button in a recorded turn, in payload order: event name,
 * the surface it lives on and the component that carries it. Derived rather
 * than passed in — the model names its own actions, and a hand-guessed name
 * would record the agent answering a click that its own payload never offered.
 *
 * Order matters downstream: when the form carries two buttons, the first is
 * the mid-form round trip (re-check availability) and the last is the
 * commitment — pressing them in that order is the walk a real guest takes.
 */
function findActions(
  raw: string
): { name: string; surfaceId: string; sourceComponentId: string }[] {
  const actions: { name: string; surfaceId: string; sourceComponentId: string }[] = [];
  for (const line of raw.split('\n')) {
    if (!line.includes('"action"')) continue;
    let envelope: {
      updateComponents?: {
        surfaceId?: string;
        components?: { id?: string; action?: { event?: { name?: string } } }[];
      };
    };
    try {
      envelope = JSON.parse(line);
    } catch {
      continue; // prose, a fence marker, or a half-line — not an envelope
    }
    const surfaceId = envelope.updateComponents?.surfaceId;
    for (const carrier of envelope.updateComponents?.components ?? []) {
      const name = carrier?.action?.event?.name;
      if (surfaceId && carrier?.id && name) {
        actions.push({ name, surfaceId, sourceComponentId: carrier.id });
      }
    }
  }
  return actions;
}

const client = new Anthropic({ apiKey });
const history: Anthropic.MessageParam[] = [];
const turns: RecordedTurn[] = [];

/**
 * Send one wire message, record the stream (running the tool loop like the
 * old relay did), return the assistant's raw text.
 */
async function runTurn(wire: string, display?: string): Promise<string> {
  process.stdout.write(`\nTurn ${turns.length + 1}: ${wire.slice(0, 70)}\n  `);
  history.push({ role: 'user', content: wire });

  const frames: Frame[] = [];
  // Agent loop: stream a turn; when the model stops to call a tool, execute
  // it, append the tool_result and stream the follow-up turn. Text deltas of
  // every round flow out as `token` frames; `tool_start` / `tool_result`
  // bracket each execution. Bounded — a runaway tool loop fails loud.
  const MAX_TOOL_ROUNDS = 4;
  let rounds: Anthropic.MessageParam[] = [...history];

  for (let round = 0; ; round++) {
    const run = client.messages.stream({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: rounds,
      tools: HOTEL_TOOLS
    });

    run.on('text', (delta) => {
      frames.push({ event: 'token', data: { text: delta } });
      process.stdout.write('·');
    });
    const final = await run.finalMessage();

    if (final.stop_reason !== 'tool_use') break;
    if (round >= MAX_TOOL_ROUNDS) {
      throw new Error(`Tool loop exceeded ${MAX_TOOL_ROUNDS} rounds`);
    }

    const toolUses = final.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      process.stdout.write(`\n  ↳ tool: ${toolUse.name}\n  `);
      frames.push({
        event: 'tool_start',
        data: { id: toolUse.id, name: toolUse.name, input: toolUse.input }
      });
      const output = executeHotelTool(toolUse.name, toolUse.input);
      frames.push({ event: 'tool_result', data: { id: toolUse.id, output } });
      results.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(output)
      });
    }
    rounds = [
      ...rounds,
      { role: 'assistant', content: final.content },
      { role: 'user', content: results }
    ];
  }

  turns.push({ wire, display, frames });

  // The assistant's raw text is the concatenation of every token frame — the
  // same string the client's splitter keeps as `metadata.raw`, so replaying it
  // as history reproduces exactly what the model saw the first time.
  const raw = frames
    .filter((f) => f.event === 'token')
    .map((f) => (f.data as { text?: string }).text ?? '')
    .join('');
  history.push({ role: 'assistant', content: raw });
  return raw;
}

const opening = await runTurn(OPENING);

// The follow-up turns are the user pressing buttons the model just built.
// Names/surfaces/components come out of that payload, so the recorded
// exchange is one the agent could really have had: with two buttons on the
// form the guest first re-checks availability (a live tool round trip inside
// the surface), then commits; with one, they commit directly.
const actions = findActions(opening);
const presses =
  actions.length >= 2 ? [actions[0], actions[actions.length - 1]] : actions.slice(0, 1);
if (presses.length === 0) {
  process.stdout.write('\n  ! no action button in turn 1 — recording the opening turn only\n');
}
for (const [i, action] of presses.entries()) {
  process.stdout.write(
    `\n  ↳ action: ${action.name} on ${action.surfaceId}#${action.sourceComponentId}\n  `
  );
  await runTurn(
    `[ui-action] ${JSON.stringify({
      ...action,
      timestamp: `2026-09-01T10:1${2 + i}:00.000Z`,
      context: {},
      dataModel: FILLED_IN
    })}`,
    `▸ ${action.name}`
  );
}

await Bun.write(outPath, `${JSON.stringify({ turns }, null, 2)}\n`);
process.stdout.write(`\n\n✓ ${turns.length} turn(s) → ${outPath}\n`);
