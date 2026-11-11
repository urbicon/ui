// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { healedPrefix } from './__fixtures__/healed-json';
import A2UIView from './A2UIView.svelte';
import { A2uiToolInputStabilizer } from './a2ui-mcp-app';

// What a host's partial tool arguments do to a mounted A2UIView, with and
// without the stabilizer. The first test is the control: it shows the remount
// the stabilizer exists to prevent, so the second cannot pass by a view that
// would have kept the input anyway.
//
// The payload is held in `$state.raw` and handed over through a getter, as a
// consumer should hold it: a deep `$state` proxies every array assigned to it
// afresh, envelopes included, and the view then sees new objects whatever the
// stabilizer returned — the last test pins that.

const V = 'v0.9.1';
const NOTE = 'We hold the table for fifteen minutes after the booked time.';
const ARGS = JSON.stringify({
  messages: [
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
  ]
});
// Two partials that both end inside the note: the field is complete in each.
const EARLY = ARGS.indexOf('fifteen');
const LATER = ARGS.indexOf('booked');

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** Mount with the payload in `$state.raw` (or a deep `$state`, for the last test). */
function render(initial: unknown, holder: 'raw' | 'deep' = 'raw') {
  let rawPayload = $state.raw(initial);
  let deepPayload = $state(initial);
  let streaming = $state(true);
  const instance = mount(A2UIView, {
    target: document.body,
    props: {
      get payload() {
        return holder === 'raw' ? rawPayload : deepPayload;
      },
      get streaming() {
        return streaming;
      }
    }
  });
  dispose = () => unmount(instance);
  flushSync();
  return {
    set(payload: unknown, settled = false) {
      flushSync(() => {
        if (holder === 'raw') rawPayload = payload;
        else deepPayload = payload;
        if (settled) streaming = false;
      });
    }
  };
}

function nameInput(): HTMLInputElement {
  const input = document.querySelector('input[type="text"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('the Name field is not rendered');
  return input;
}

describe('A2UIView fed partial tool arguments', () => {
  it('remounts the surface and drops the input when given the raw snapshots', async () => {
    const user = userEvent.setup();
    const view = render(healedPrefix(ARGS, EARLY));
    const typedInto = nameInput();
    await user.type(typedInto, 'Ada');
    flushSync();
    expect(typedInto.value).toBe('Ada');
    // The cut-short note is on screen.
    expect(document.body.textContent).toContain('We hold the table for');
    expect(document.body.textContent).not.toContain(NOTE);

    view.set(healedPrefix(ARGS, LATER));

    expect(nameInput()).not.toBe(typedInto);
    expect(nameInput().value).toBe('');
  });

  it('keeps the field and its input through the stabilizer, and the note arrives whole', async () => {
    const user = userEvent.setup();
    const input = new A2uiToolInputStabilizer();
    const view = render(input.partial(healedPrefix(ARGS, EARLY)));
    const typedInto = nameInput();
    await user.type(typedInto, 'Ada');
    flushSync();

    view.set(input.partial(healedPrefix(ARGS, LATER)));
    expect(document.body.textContent).not.toContain('We hold the table');

    view.set(input.complete(JSON.parse(ARGS)), true);

    expect(nameInput()).toBe(typedInto);
    expect(nameInput().value).toBe('Ada');
    expect(document.body.textContent).toContain(NOTE);
  });

  it('still remounts when the stabilized payload goes through a deep $state', async () => {
    const user = userEvent.setup();
    const input = new A2uiToolInputStabilizer();
    const view = render(input.partial(healedPrefix(ARGS, EARLY)), 'deep');
    const typedInto = nameInput();
    await user.type(typedInto, 'Ada');
    flushSync();

    view.set(input.complete(JSON.parse(ARGS)), true);

    expect(nameInput()).not.toBe(typedInto);
    expect(nameInput().value).toBe('');
  });
});
