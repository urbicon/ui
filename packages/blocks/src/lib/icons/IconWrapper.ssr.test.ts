import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import IconRenderPath, { type IconRenderPathName } from './__fixtures__/IconRenderPath.svelte';
import LogOutIcon from './LogOutIcon.svelte';
import logIn from './svg/log-in.svg?raw';
import logOut from './svg/log-out.svg?raw';

/**
 * What a page shows before hydration — and, without JavaScript, for good — is
 * the server HTML. An icon whose geometry only arrives on the client is an
 * empty box there: a blank icon-only button.
 */

const PATHS: [IconRenderPathName, string][] = [
  ['name', logOut],
  ['direct', logOut],
  ['resolveIcon', logOut],
  ['override-name', logIn],
  ['override-resolveIcon', logIn]
];

/** The `d` of every path an icon's source file draws. */
function geometry(svg: string): string[] {
  return [...svg.matchAll(/\sd="([^"]+)"/g)].map(([, d]) => d);
}

/** The one `<g>` an icon renders: its attributes and what it holds. */
function group(body: string): { attributes: string; inner: string } {
  const match = /<g\b([^>]*)>([\s\S]*?)<\/g>/.exec(body);
  if (!match) throw new Error(`no <g> in the server HTML: ${body}`);
  return { attributes: match[1], inner: match[2] };
}

describe('icons (SSR)', () => {
  it.each(PATHS)('%s: the server HTML carries the geometry inside the <g>', (path, source) => {
    const { body } = render(IconRenderPath, { props: { path } });
    const { inner } = group(body);

    for (const d of geometry(source)) expect(inner).toContain(`d="${d}"`);
  });

  it('puts rotate and flip on the <g> that holds the geometry', () => {
    const { body } = render(LogOutIcon, { props: { rotate: 90, flip: 'x' } });
    const { attributes, inner } = group(body);

    expect(attributes).toContain('transform="translate(24 0) scale(-1 1) rotate(90 12 12)"');
    for (const d of geometry(logOut)) expect(inner).toContain(`d="${d}"`);
  });

  // `content` is rendered as markup. A caller's props reach an icon component
  // through `IconProps`' index signature, so a stray `content` must lose to the
  // icon's own geometry on every path.
  it.each(PATHS)('%s: a content prop from the caller does not reach the markup', (path, source) => {
    const { body } = render(IconRenderPath, {
      props: { path, content: '<circle data-injected="" />' }
    });

    expect(body).not.toContain('data-injected');
    for (const d of geometry(source)) expect(group(body).inner).toContain(`d="${d}"`);
  });
});
