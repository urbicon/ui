// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatMessageData, ChatMessagePart } from '../chat.types';
import A2UIView from './A2UIView.svelte';
import { A2uiSurfaceRouter } from './a2ui-router';
import { A2uiStreamSplitter } from './a2ui-stream';
import { revokeMessage, routeMessageParts } from './a2ui-transcript';

// The chat wiring the A2UI guide and recipe show — one splitter, one router,
// the transcript reassigned with the splitter's snapshot on every token — on a
// mounted A2UIView. The snapshot carries the same envelope objects token after
// token, and the view appends only while it is handed them. A transcript in a
// deep `$state` wraps every message assigned to it in new proxies, envelopes
// included, so the view rebuilds on every token; the first test is that
// control, so the second cannot pass by a view that keeps its input anyway.
// The same wrapping hides a delivered patch from `revokeMessage`, which finds
// its envelopes by reference.

const V = 'v0.9.1';
const NOTE = 'We hold the table for fifteen minutes.';
const lines = [
  { version: V, createSurface: { surfaceId: 'booking', catalogId: 'x' } },
  {
    version: V,
    updateComponents: {
      surfaceId: 'booking',
      components: [
        { id: 'root', component: 'Column', children: ['name', 'note'] },
        { id: 'name', component: 'TextField', label: 'Name', value: { path: '/name' } }
      ]
    }
  },
  {
    version: V,
    updateComponents: {
      surfaceId: 'booking',
      components: [{ id: 'note', component: 'Text', text: NOTE }]
    }
  }
].map((envelope) => JSON.stringify(envelope));

// The field is complete in the first chunk; the rest is a line cut in two,
// the closing fence, and prose after it.
const FIRST = `Here is the form:\n\`\`\`a2ui\n${lines[0]}\n${lines[1]}\n`;
const LATER = [lines[2].slice(0, 20), `${lines[2].slice(20)}\n`, '```\n', 'Tell me ', 'your name.'];

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** One streaming assistant turn, its transcript held in `$state.raw` or a deep `$state`. */
function streamTurn(holder: 'raw' | 'deep') {
  let rawMessages = $state.raw<ChatMessageData[]>([]);
  let deepMessages = $state<ChatMessageData[]>([]);
  const read = () => (holder === 'raw' ? rawMessages : deepMessages);
  const write = (next: ChatMessageData[]) => {
    if (holder === 'raw') rawMessages = next;
    else deepMessages = next;
  };

  const router = new A2uiSurfaceRouter();
  const splitter = new A2uiStreamSplitter();
  const id = 'assistant-1';
  write([{ id, role: 'assistant', parts: [], status: 'streaming' }]);

  const instance = mount(A2UIView, {
    target: document.body,
    props: {
      get payload() {
        const part = read()[0].parts.find((p) => p.type === 'a2ui');
        return part?.type === 'a2ui' ? part.payload : [];
      },
      streaming: true
    }
  });
  dispose = () => unmount(instance);
  flushSync();

  return {
    push(chunk: string) {
      splitter.push(chunk);
      flushSync(() => {
        const routed = routeMessageParts(
          router,
          read(),
          id,
          splitter.snapshot() as ChatMessagePart[]
        );
        write(routed.messages.map((m) => (m.id === id ? { ...m, parts: routed.parts } : m)));
      });
    }
  };
}

function nameInput(): HTMLInputElement {
  const input = document.querySelector('input[type="text"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('the Name field is not rendered');
  return input;
}

describe('A2UIView in a transcript reassigned on every token', () => {
  it('remounts the surface on the next token when the transcript is a deep $state', async () => {
    const user = userEvent.setup();
    const turn = streamTurn('deep');
    turn.push(FIRST);
    const typedInto = nameInput();
    await user.type(typedInto, 'Ada');
    flushSync();
    expect(typedInto.value).toBe('Ada');

    turn.push(LATER[0]);

    expect(nameInput()).not.toBe(typedInto);
    expect(nameInput().value).toBe('');
  });

  it('keeps the field and its input through every token when the transcript is $state.raw', async () => {
    const user = userEvent.setup();
    const turn = streamTurn('raw');
    turn.push(FIRST);
    const typedInto = nameInput();
    await user.type(typedInto, 'Ada');
    flushSync();

    for (const chunk of LATER) {
      turn.push(chunk);
      expect(nameInput()).toBe(typedInto);
      expect(nameInput().value).toBe('Ada');
    }
    expect(document.body.textContent).toContain(NOTE);
  });
});

describe('revokeMessage on a transcript in $state', () => {
  const fence = (...envelopes: string[]) => `\`\`\`a2ui\n${envelopes.join('\n')}\n\`\`\`\n`;
  const patch = JSON.stringify({
    version: V,
    updateComponents: {
      surfaceId: 'booking',
      components: [{ id: 'extra', component: 'Text', text: 'x' }]
    }
  });

  /** Two turns, the second patching the first's surface; the first's payload length after revoking the second. */
  function revokeThePatch(holder: 'raw' | 'deep') {
    let rawMessages = $state.raw<ChatMessageData[]>([]);
    let deepMessages = $state<ChatMessageData[]>([]);
    const read = () => (holder === 'raw' ? rawMessages : deepMessages);
    const write = (next: ChatMessageData[]) => {
      if (holder === 'raw') rawMessages = next;
      else deepMessages = next;
    };
    const router = new A2uiSurfaceRouter();
    for (const [id, text] of [
      ['assistant-1', fence(lines[0], lines[1], lines[2])],
      ['assistant-2', fence(patch)]
    ]) {
      const splitter = new A2uiStreamSplitter();
      splitter.push(text);
      splitter.end();
      write([...read(), { id, role: 'assistant', parts: [], status: 'complete' }]);
      const routed = routeMessageParts(
        router,
        read(),
        id,
        splitter.snapshot() as ChatMessagePart[]
      );
      write(routed.messages.map((m) => (m.id === id ? { ...m, parts: routed.parts } : m)));
    }
    const firstPayload = () => {
      const part = read()[0].parts.find((p) => p.type === 'a2ui');
      return part?.type === 'a2ui' ? (part.payload as unknown[]) : [];
    };
    const delivered = firstPayload().length;
    write(revokeMessage(router, read(), 'assistant-2'));
    return { delivered, afterRevoke: firstPayload().length };
  }

  it('finds nothing to take back through a deep $state', () => {
    expect(revokeThePatch('deep')).toEqual({ delivered: 4, afterRevoke: 4 });
  });

  it('takes the patch back out of a $state.raw transcript', () => {
    expect(revokeThePatch('raw')).toEqual({ delivered: 4, afterRevoke: 3 });
  });
});
