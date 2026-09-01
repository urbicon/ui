import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import NumberInput from '$lib/components/NumberInput/NumberInput.svelte';
import WrapperCascadeHost from './__fixtures__/WrapperCascadeHost.svelte';
import type { ComponentDefaults, PresetMap } from './blocks-context';

/**
 * NumberInput is the one wrapper with markup of its own: the two `stepper`
 * slots, rendered as Input's `rightIcon` — that is, *inside* the component
 * whose cascade dresses them.
 *
 * So the classes on those two elements are decided by something that has
 * already run by the time the snippet renders, and this file is what pins
 * "already" to the server pass. A resolution installed from an effect would
 * satisfy every jsdom assertion in this suite and still ship a server string
 * without the override classes — a flash of the undressed stepper on first
 * paint, in exactly the classes the cascade exists to place.
 *
 * The expected order is the same fold `wrapper-cascade-order.svelte.test.ts`
 * measures on the client, asserted here against the same array so the two
 * cannot drift: the stepper is NumberInput's own slot, so only NumberInput's
 * five rungs reach it — Input's name never dresses an element Input has no
 * slot for.
 */

const W = ['zzw1', 'zzw2', 'zzw3', 'zzw4', 'zzw5'] as const;
const MARKER = /^zzw\d$/;

const defaults: Record<string, ComponentDefaults> = {
  NumberInput: {
    slotClasses: { stepper: W[0], stepperButton: W[0] },
    overrides: [{ variant: 'outlined', class: { stepper: W[1], stepperButton: W[1] } }]
  }
};

const presets: PresetMap = {
  NumberInput: {
    compact: {
      slotClasses: { stepper: W[2], stepperButton: W[2] },
      overrides: [{ variant: 'outlined', class: { stepper: W[3], stepperButton: W[3] } }]
    }
  }
};

/** The marker tokens of every `class="…"` in the string that carries `anchor`. */
function markedClassLists(html: string, anchor: string): string[][] {
  const lists: string[][] = [];
  for (const match of html.matchAll(/class="([^"]*)"/g)) {
    const tokens = match[1].split(/\s+/);
    if (!tokens.includes(anchor)) continue;
    lists.push(tokens.filter((token) => MARKER.test(token)));
  }
  return lists;
}

function body(): string {
  return render(WrapperCascadeHost, {
    props: {
      component: NumberInput,
      props: { slotClasses: { stepper: W[4], stepperButton: W[4] } },
      preset: 'compact',
      defaults,
      presets
    } as never
  }).body;
}

describe("NumberInput's own slots on the server pass", () => {
  it('carries the whole cascade on the stepper column', () => {
    expect(
      markedClassLists(body(), W[4]).length,
      'the stepper rendered no marked element'
    ).toBeGreaterThan(0);
    expect(markedClassLists(body(), W[4])[0]).toEqual([W[0], W[1], W[2], W[3], W[4]]);
  });

  it('carries it on both stepper buttons too', () => {
    // Three elements share the marker set — the column and its two buttons —
    // so a fold that reached only the outer one is visible as a count.
    const lists = markedClassLists(body(), W[4]);
    expect(lists).toHaveLength(3);
    for (const list of lists) expect(list).toEqual([W[0], W[1], W[2], W[3], W[4]]);
  });

  it('dresses the field it wraps in the same pass', () => {
    // The control on the control: without it, a stepper that renders nothing at
    // all would read as "no missing classes".
    const html = render(WrapperCascadeHost, {
      props: {
        component: NumberInput,
        props: { slotClasses: { base: W[4] } },
        defaults: { Input: { slotClasses: { base: W[0] } } }
      } as never
    }).body;

    expect(markedClassLists(html, W[4])[0]).toEqual([W[0], W[4]]);
  });
});
