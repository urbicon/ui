// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Button from '../primitives/Button/Button.svelte';
import Input from '../primitives/Input/Input.svelte';
import { mintRegistry } from './registry';
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

  it("mint='none' and an absent mint are both no-ops", () => {
    const a = mount(Button, { target, props: { mint: 'none', children: label } });
    flushSync();
    expect(inits).toHaveLength(0);
    unmount(a);

    const b = mount(Button, { target, props: { children: label } });
    flushSync();
    expect(inits).toHaveLength(0);
    unmount(b);
  });

  it('lands on the inner control, not on the wrapper (Input)', () => {
    const comp = mount(Input, { target, props: { mint: 'probe' } });
    flushSync();

    expect(inits).toHaveLength(1);
    expect(inits[0].tag).toBe('INPUT');

    unmount(comp);
  });
});
