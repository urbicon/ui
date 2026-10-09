// @vitest-environment jsdom
import { resolve } from 'node:path';
import { flushSync, hydrate, mount, unmount } from 'svelte';
import { render } from 'svelte/server';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import IconRenderPath, { type IconRenderPathName } from './__fixtures__/IconRenderPath.svelte';
import { serverBuild } from './__fixtures__/server-build';
import type { IconProps } from './icon-types';
import LogInIcon from './LogInIcon.svelte';
import LogOutIcon from './LogOutIcon.svelte';
import logIn from './svg/log-in.svg?raw';
import logOut from './svg/log-out.svg?raw';

/**
 * An SVG child parsed or created in the HTML namespace is an unknown element
 * and draws nothing, so every shape is asserted by `namespaceURI`, not by
 * presence. The server half parses through jsdom's HTML parser, which applies
 * the spec's foreign-content rules inside `<svg>` the way a browser's does.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const LOG_OUT_FILE = resolve(import.meta.dirname, 'LogOutIcon.svelte');

const PATHS: [IconRenderPathName, string][] = [
  ['name', logOut],
  ['direct', logOut],
  ['resolveIcon', logOut],
  ['override-name', logIn],
  ['override-resolveIcon', logIn]
];

const server = serverBuild();
let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

afterAll(() => server.dispose());

function geometry(svg: string): string[] {
  return [...svg.matchAll(/\sd="([^"]+)"/g)].map(([, d]) => d);
}

/** The shapes inside the icon's `<g>`, in document order. */
function shapes(): Element[] {
  return [...document.body.querySelectorAll('svg > g > *')];
}

async function serverHtml(props: IconProps): Promise<string> {
  const LogOutServer = await server.load<IconProps>(LOG_OUT_FILE);
  return render(LogOutServer, { props }).body;
}

describe('icons on the client', () => {
  it.each(PATHS)('%s: a fresh mount draws SVG elements', (path, source) => {
    const instance = mount(IconRenderPath, { target: document.body, props: { path } });
    dispose = () => unmount(instance);
    flushSync();

    expect(shapes().map((shape) => shape.getAttribute('d'))).toEqual(geometry(source));
    for (const shape of shapes()) expect(shape.namespaceURI).toBe(SVG_NS);
  });
});

describe('icon hydration', () => {
  it.each<[string, IconProps]>([
    ['plain', {}],
    ['rotated and flipped', { rotate: 90, flip: 'x' }]
  ])('%s: adopts the server-rendered shapes without a mismatch', async (_, props) => {
    document.body.innerHTML = await serverHtml(props);
    const served = shapes();

    expect(served.map((shape) => shape.getAttribute('d'))).toEqual(geometry(logOut));
    for (const shape of served) expect(shape.namespaceURI).toBe(SVG_NS);

    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    const instance = hydrate(LogOutIcon, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();

    const hydrated = shapes();
    expect(hydrated).toHaveLength(served.length);
    for (const [i, shape] of hydrated.entries()) expect(shape).toBe(served[i]);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  // Positive control for the spies above: Svelte reports a hydration mismatch
  // through `console.warn`, so a client whose geometry differs from the server
  // HTML must show up there.
  it('reports a client whose geometry differs from the server HTML', async () => {
    document.body.innerHTML = await serverHtml({});

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const instance = hydrate(LogInIcon, { target: document.body, props: {} });
    dispose = () => unmount(instance);
    flushSync();

    expect(warn.mock.calls.flat().join(' ')).toContain('hydration_html_changed');
  });
});
