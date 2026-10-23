// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clippingBoundary } from './floating';

// jsdom has no layout: every box is placed by hand, and `getComputedStyle`
// reads the inline styles set below — overflow as longhands, because jsdom does
// not expand the `overflow` shorthand the way a browser computes it. jsdom
// opens no top layer either; `topLayer` stands one in by answering `:modal` or
// `:popover-open`.

const VIEWPORT = { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };

afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute('style');
});

function el(style: string, rect?: { left: number; top: number; width: number; height: number }) {
  const node = document.createElement('div');
  node.setAttribute('style', style);
  if (rect) {
    node.getBoundingClientRect = () =>
      ({
        ...rect,
        x: rect.left,
        y: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height
      }) as DOMRect;
    Object.defineProperty(node, 'clientWidth', { value: rect.width });
    Object.defineProperty(node, 'clientHeight', { value: rect.height });
  }
  return node;
}

/** An element `inTopLayer` reads as open in the top layer: a modal dialog, or an open popover. */
function topLayer(style: string, state: ':modal' | ':popover-open' = ':modal') {
  const node = el(style);
  const matches = node.matches.bind(node);
  node.matches = ((selector: string) =>
    selector === state || matches(selector)) as typeof node.matches;
  return node;
}

/** Nests each element in the next one, innermost first, and mounts the outermost. */
function nest(...chain: HTMLElement[]) {
  for (let i = 0; i < chain.length - 1; i++) chain[i + 1].appendChild(chain[i]);
  document.body.appendChild(chain[chain.length - 1]);
  return chain[0];
}

const BOX = { left: 40, top: 100, width: 300, height: 200 };
const BOX_EDGES = { left: 40, top: 100, right: 340, bottom: 300 };

describe('clippingBoundary', () => {
  it('is the viewport when nothing clips', () => {
    const panel = nest(el('position: absolute'), el('position: relative'));
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('is the padding box of a scroll box that holds the containing block', () => {
    const panel = nest(
      el('position: absolute'),
      el('overflow-x: auto; overflow-y: auto; position: relative', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(BOX_EDGES);
  });

  it('clips through an in-flow positioned wrapper inside the scroll box', () => {
    const panel = nest(
      el('position: absolute'),
      el('position: relative'),
      el('overflow-x: auto; overflow-y: auto', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(BOX_EDGES);
  });

  it('lets an absolute panel escape a scroll box below its positioned ancestor', () => {
    const panel = nest(
      el('position: absolute'),
      el('overflow-x: auto; overflow-y: auto', BOX),
      el('position: relative')
    );
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('lets a fixed panel escape every scroll box', () => {
    const panel = nest(
      el('position: fixed'),
      el('overflow-x: auto; overflow-y: auto; position: relative', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('clips a fixed panel whose containing block is a transformed scroll box', () => {
    const panel = nest(
      el('position: fixed'),
      el('overflow-x: auto; overflow-y: auto; transform: scale(1)', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(BOX_EDGES);
  });

  it('follows an out-of-flow ancestor to its own containing block', () => {
    // panel → positioned card (absolute) → static scroll box → positioned page.
    // The card escapes the scroll box, and the panel goes with it.
    const panel = nest(
      el('position: absolute'),
      el('position: absolute'),
      el('overflow-x: auto; overflow-y: auto', BOX),
      el('position: relative')
    );
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('intersects nested scroll boxes and the viewport', () => {
    const panel = nest(
      el('position: absolute'),
      el('overflow-x: auto; overflow-y: auto; position: relative', {
        left: 0,
        top: 650,
        width: 500,
        height: 400
      }),
      el('overflow-x: hidden; overflow-y: hidden', { left: 100, top: 0, width: 2000, height: 2000 })
    );
    expect(clippingBoundary(panel)).toEqual({
      left: 100,
      top: 650,
      right: 500,
      bottom: VIEWPORT.bottom
    });
  });

  it('leaves a top-layer panel the viewport inside a transformed scroll box', () => {
    // A portalled listbox declared in the box: the transform makes the box the
    // containing block of a fixed panel, but not of one in the top layer.
    const panel = nest(
      topLayer('position: fixed', ':popover-open'),
      el('overflow-x: auto; overflow-y: auto; transform: translateX(0)', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('lets a fixed panel inside a top-layer dialog escape a transformed box around the dialog', () => {
    // A Dialog declared inside the Sidebar: its aside is transformed and clips,
    // but the dialog is laid out against the viewport and so is its fixed panel.
    const panel = nest(
      el('position: fixed'),
      topLayer('position: fixed'),
      el('overflow-x: hidden; overflow-y: hidden; transform: translateX(0)', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('positive control: without the top layer the transformed box clips the fixed panel', () => {
    const panel = nest(
      el('position: fixed'),
      el('position: fixed'),
      el('overflow-x: hidden; overflow-y: hidden; transform: translateX(0)', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(BOX_EDGES);
  });

  it('does not take a size container for the containing block of a fixed panel', () => {
    const panel = nest(
      el('position: fixed'),
      el('container-type: inline-size'),
      el('overflow-x: hidden; overflow-y: hidden', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('takes content-visibility and preserve-3d for containing blocks of a fixed panel', () => {
    for (const containing of ['content-visibility: auto', 'transform-style: preserve-3d']) {
      const panel = nest(
        el('position: fixed'),
        el(`overflow-x: hidden; overflow-y: hidden; ${containing}`, BOX)
      );
      expect(clippingBoundary(panel), containing).toEqual(BOX_EDGES);
      document.body.replaceChildren();
    }
  });

  it('does not take a display: contents element for a containing block', () => {
    const absolute = nest(
      el('position: absolute'),
      el('position: relative; display: contents'),
      el('overflow-x: auto; overflow-y: auto', BOX),
      el('position: relative')
    );
    expect(clippingBoundary(absolute), 'position: relative').toEqual(VIEWPORT);
    document.body.replaceChildren();

    const fixed = nest(
      el('position: fixed'),
      el('filter: opacity(1); display: contents'),
      el('overflow-x: hidden; overflow-y: hidden', BOX)
    );
    expect(clippingBoundary(fixed), 'filter').toEqual(VIEWPORT);
  });

  it('does not take a display: contents element out of flow', () => {
    // Its position applies to no box: the panel's containing block stays in
    // flow inside the scroll box, and the box clips it.
    const panel = nest(
      el('position: absolute'),
      el('position: relative'),
      el('position: absolute; display: contents'),
      el('overflow-x: auto; overflow-y: auto', BOX),
      el('position: relative')
    );
    expect(clippingBoundary(panel)).toEqual(BOX_EDGES);
  });

  it('narrows only the axis an overflow-x: clip box clips', () => {
    const panel = nest(el('position: absolute'), el('overflow-x: clip; position: relative', BOX));
    expect(clippingBoundary(panel)).toEqual({
      ...VIEWPORT,
      left: BOX_EDGES.left,
      right: BOX_EDGES.right
    });
  });

  it('does not consult body, whose scroll lock hides nothing on screen', () => {
    document.body.setAttribute('style', 'overflow: hidden');
    const panel = nest(el('position: absolute'), el('position: relative'));
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });
});
