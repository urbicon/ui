/**
 * The missing-`children` contract, rendered on the server.
 *
 * SSR is the expensive half of this guard: without it the old flat form dies
 * inside `{@render children()}` with Svelte's `invalid_snippet`, which names
 * neither the component nor the migration, and takes the whole page down as a
 * 500. The vitest env here is `node`, so this is the real server path — the
 * client half lives in `Menu.callforms.svelte.test.ts`.
 */
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Host from './__fixtures__/MenuSectionContractHost.svelte';

const CONTRACT = /requires the items it names as its children/;

// `render()` returns lazy accessors: the component tree is only evaluated when
// `.body` is read, so a `toThrow` around the bare call measures nothing and
// passes for the wrong reason. Measured — without the `.body` read this suite
// reported "did not throw" while the same render throws in a try/catch.
const renderBody = (omitChildren: boolean) => render(Host, { props: { omitChildren } }).body;

describe('MenuSection children contract (SSR)', () => {
  it('names the component and the fix when the section renders no items', () => {
    expect(() => renderBody(true)).toThrow(CONTRACT);
    // Not Svelte's own snippet error, which says nothing actionable.
    expect(() => renderBody(true)).not.toThrow(/invalid_snippet/);
  });

  it('renders the nested form without throwing', () => {
    const body = renderBody(false);
    expect(body).toContain('role="group"');
    expect(body).toContain('Group A');
  });
});
