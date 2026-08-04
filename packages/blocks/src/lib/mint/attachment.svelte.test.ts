// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Button from '../primitives/Button/Button.svelte';
import Input from '../primitives/Input/Input.svelte';
import { mintRegistry } from './registry';
import { mintAttachment } from './svelte';
import type { Mint } from './types';

// The positive control for `mintAttachment`.
//
// Before this file, every mint test called `mintRegistry.apply({} as HTMLElement, …)`
// directly — nothing ever mounted a component with a `mint` prop. So the suite was
// green whether or not a component actually applied its mint, which is exactly the
// blind spot the 2026-08 `{@attach}` migration needed covered: 17 components moved
// from `bind:this` + `$effect` to `{@attach mintAttachment(…)}`, and only a test
// that renders one can tell the difference.
//
// Deliberately registers its own mint rather than asserting on `scaleMint`: the
// built-in short-circuits on `prefers-reduced-motion`, which jsdom answers however
// its matchMedia stub feels like — a test that skips silently proves nothing.

type Call = { el: HTMLElement; tag: string };

let inits: Call[] = [];
let destroys: Call[] = [];

const probeMint = (): Mint => ({
  init(el) {
    inits.push({ el, tag: el.tagName });
    el.dataset.probeApplied = 'yes';
  },
  destroy(el) {
    destroys.push({ el, tag: el.tagName });
    delete el.dataset.probeApplied;
  }
});

const otherMint = (): Mint => ({
  init(el) {
    el.dataset.otherApplied = 'yes';
  },
  destroy(el) {
    delete el.dataset.otherApplied;
  }
});

const label = createRawSnippet(() => ({ render: () => '<span>Go</span>' }));

let target: HTMLElement;

beforeEach(() => {
  inits = [];
  destroys = [];
  mintRegistry.register('probe', probeMint);
  mintRegistry.register('other', otherMint);
  target = document.createElement('div');
  document.body.appendChild(target);
});

afterEach(() => {
  target.remove();
});

describe('mintAttachment — a rendered component actually applies its mint', () => {
  it('applies to the real element, not to an undefined ref', () => {
    const comp = mount(Button, { target, props: { mint: 'probe', children: label } });
    flushSync();

    expect(inits).toHaveLength(1);
    expect(inits[0].tag).toBe('BUTTON');
    expect(target.querySelector('button')?.dataset.probeApplied).toBe('yes');

    unmount(comp);
  });

  it('tears down on unmount', () => {
    const comp = mount(Button, { target, props: { mint: 'probe', children: label } });
    flushSync();
    expect(destroys).toHaveLength(0);

    unmount(comp);
    flushSync();
    expect(destroys).toHaveLength(1);
    expect(destroys[0].tag).toBe('BUTTON');
  });

  it('does not apply while the component is disabled', () => {
    const comp = mount(Button, {
      target,
      props: { mint: 'probe', disabled: true, children: label }
    });
    flushSync();

    expect(inits).toHaveLength(0);
    expect(target.querySelector('button')?.dataset.probeApplied).toBeUndefined();

    unmount(comp);
  });

  it('applies once the disabled gate opens, and tears down when it closes again', () => {
    const props = $state({ mint: 'probe', disabled: true, children: label });
    const comp = mount(Button, { target, props });
    flushSync();
    expect(inits).toHaveLength(0);

    props.disabled = false;
    flushSync();
    expect(inits).toHaveLength(1);
    expect(target.querySelector('button')?.dataset.probeApplied).toBe('yes');

    props.disabled = true;
    flushSync();
    expect(destroys).toHaveLength(1);
    expect(target.querySelector('button')?.dataset.probeApplied).toBeUndefined();

    unmount(comp);
  });

  it('swapping the mint prop tears the old one down and applies the new one', () => {
    const props = $state({ mint: 'probe', children: label });
    const comp = mount(Button, { target, props });
    flushSync();
    const el = target.querySelector('button');
    expect(el?.dataset.probeApplied).toBe('yes');

    props.mint = 'other';
    flushSync();
    expect(destroys).toHaveLength(1);
    expect(el?.dataset.probeApplied).toBeUndefined();
    expect(el?.dataset.otherApplied).toBe('yes');

    unmount(comp);
  });

  it("mint='none' is a no-op", () => {
    const comp = mount(Button, { target, props: { mint: 'none', children: label } });
    flushSync();
    expect(inits).toHaveLength(0);
    unmount(comp);
  });

  it('an absent mint applies the component default — on Button that is NOT nothing', () => {
    // This test used to read "mint='none' and an absent mint are both no-ops"
    // and assert `inits` stayed at 0 for a Button with no mint prop. It passed
    // for the wrong reason: `inits` only counts the probe, and Button defaults
    // to `mint = 'scale'` (Button.svelte:25) — it is the one component in the
    // set that does. So the assertion held while the opposite of its claim was
    // true.
    //
    // Registering the probe under the default's own name makes the real
    // behaviour observable, and doubles as the precedence check: a registry
    // entry outranks the caller's `fallbacks` (registry.ts → `apply`).
    mintRegistry.register('scale', probeMint);
    const comp = mount(Button, { target, props: { children: label } });
    flushSync();

    expect(inits).toHaveLength(1);
    expect(inits[0].tag).toBe('BUTTON');

    unmount(comp);
  });

  it('an absent mint IS a no-op where the default is none (Input)', () => {
    // The claim the old test meant to make, on a component where it holds.
    const comp = mount(Input, { target, props: {} });
    flushSync();
    expect(inits).toHaveLength(0);
    expect(target.querySelector('input')?.dataset.probeApplied).toBeUndefined();
    unmount(comp);
  });

  it('lands on the inner control, not on the wrapper (Input)', () => {
    const comp = mount(Input, { target, props: { mint: 'probe' } });
    flushSync();

    expect(inits).toHaveLength(1);
    expect(inits[0].tag).toBe('INPUT');

    unmount(comp);
  });
});

describe('mintAttachment — the fallbacks the caller imported statically', () => {
  // `fallbacks` is what keeps a component's *own* default tree-shaken: Button
  // imports `scaleMint` directly and hands it over, instead of the registry
  // demand-loading the whole built-in set (~3.9 KB). Dropping the option on the
  // way through `mintAttachment` would not break a single other test in this
  // file — the built-ins load asynchronously and would paper over it a
  // microtask later — so it needs asserting here, synchronously.
  //
  // The name is deliberately one no built-in owns, so the assertion cannot be
  // satisfied by the demand-load arriving instead.
  const UNKNOWN = 'no-builtin-owns-this';

  it('resolves a name the registry does not know, synchronously', () => {
    const el = document.createElement('div');
    const attach = mintAttachment(UNKNOWN, { fallbacks: { [UNKNOWN]: probeMint } });
    expect(attach).not.toBe(false);

    const cleanup = (attach as Attachment<HTMLElement>)(el);
    expect(inits).toHaveLength(1);
    expect(el.dataset.probeApplied).toBe('yes');

    cleanup?.();
    expect(destroys).toHaveLength(1);
    expect(el.dataset.probeApplied).toBeUndefined();
  });

  it('without them the same name resolves nothing synchronously', () => {
    // The negative control: proves the test above measures the fallback and not
    // merely "apply() ran".
    const el = document.createElement('div');
    const attach = mintAttachment(UNKNOWN);
    (attach as Attachment<HTMLElement>)(el);

    expect(inits).toHaveLength(0);
    expect(el.dataset.probeApplied).toBeUndefined();
  });

  it('returns false — an inert attachment — when there is nothing to apply', () => {
    expect(mintAttachment(undefined)).toBe(false);
    expect(mintAttachment('none')).toBe(false);
    expect(mintAttachment('probe', { enabled: false })).toBe(false);
  });
});
