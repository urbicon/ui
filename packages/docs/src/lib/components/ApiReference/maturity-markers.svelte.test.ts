// @vitest-environment jsdom
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ApiReference from './ApiReference.svelte';
import type { ApiProp } from './index';

/**
 * `@deprecated` and `@experimental` on a prop reach `api.ts` in full — the
 * extractor sets them and `JSON.stringify` carries them through — but `ApiProp`
 * did not declare either field, so the table could not read what it was handed.
 * Two props in the library carry `@deprecated` with the replacement in the
 * message; both rendered as ordinary rows.
 *
 * The plain prop in every case is the control: it shares the rig, so an
 * assertion that a marker "appears" cannot pass on a table that marks
 * everything.
 */

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
});

function render(props: ApiProp[]): void {
  const instance = mount(ApiReference, { target: document.body, props: { props } });
  dispose = () => unmount(instance);
}

/** The row whose name cell holds `name` — the whole `<tr>`, badges included. */
function rowOf(name: string): HTMLElement {
  const code = [...document.body.querySelectorAll('code')].find((c) => c.textContent === name);
  const row = code?.closest('tr');
  if (!row) throw new Error(`no row for ${name}; body had: ${document.body.textContent}`);
  return row as HTMLElement;
}

const PLAIN: ApiProp = { name: 'plain', type: 'string' };
const GONE: ApiProp = {
  name: 'counter',
  type: 'boolean',
  deprecated: { message: 'Prefer `purpose="counter"`.' }
};
const MOVING: ApiProp = { name: 'moving', type: 'boolean', experimental: true };

describe('a prop that is deprecated or experimental says so in the table', () => {
  it('strikes a deprecated name through and leaves a plain one alone', () => {
    render([PLAIN, GONE]);

    const struck = rowOf('counter').querySelector('code')?.getAttribute('class') ?? '';
    const plain = rowOf('plain').querySelector('code')?.getAttribute('class') ?? '';
    expect(struck).toContain('line-through');
    expect(plain).not.toContain('line-through');
  });

  it('badges both levels, and badges neither on a plain prop', () => {
    render([PLAIN, GONE, MOVING]);

    expect(rowOf('counter').textContent).toContain('deprecated');
    expect(rowOf('moving').textContent).toContain('experimental');
    const plain = rowOf('plain').textContent ?? '';
    expect(plain).not.toContain('deprecated');
    expect(plain).not.toContain('experimental');
  });

  // Regression guard, not evidence: this one is green against the defect too,
  // because nothing was struck through before the fix either. It holds the line
  // if someone later reaches for the same treatment for both levels.
  it('does not strike through an experimental prop — it moves, it does not go away', () => {
    render([MOVING]);

    const classes = rowOf('moving').querySelector('code')?.getAttribute('class') ?? '';
    expect(classes).not.toContain('line-through');
  });
});
