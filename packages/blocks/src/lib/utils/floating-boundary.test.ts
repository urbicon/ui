// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clippingBoundary } from './floating';

// jsdom has no layout: every box is placed by hand, and `getComputedStyle`
// reads the inline styles set below. The top layer cannot be built here — jsdom
// knows no `:popover-open` — so that path is the e2e suite's.

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
    const panel = nest(el('position: absolute'), el('overflow-y: auto; position: relative', BOX));
    expect(clippingBoundary(panel)).toEqual(BOX_EDGES);
  });

  it('clips through an in-flow positioned wrapper inside the scroll box', () => {
    const panel = nest(
      el('position: absolute'),
      el('position: relative'),
      el('overflow: auto', BOX)
    );
    expect(clippingBoundary(panel)).toEqual(BOX_EDGES);
  });

  it('lets an absolute panel escape a scroll box below its positioned ancestor', () => {
    const panel = nest(
      el('position: absolute'),
      el('overflow: auto', BOX),
      el('position: relative')
    );
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('lets a fixed panel escape every scroll box', () => {
    const panel = nest(el('position: fixed'), el('overflow: auto; position: relative', BOX));
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('clips a fixed panel whose containing block is a transformed scroll box', () => {
    const panel = nest(el('position: fixed'), el('overflow: auto; transform: scale(1)', BOX));
    expect(clippingBoundary(panel)).toEqual(BOX_EDGES);
  });

  it('follows an out-of-flow ancestor to its own containing block', () => {
    // panel → positioned card (absolute) → static scroll box → positioned page.
    // The card escapes the scroll box, and the panel goes with it.
    const panel = nest(
      el('position: absolute'),
      el('position: absolute'),
      el('overflow: auto', BOX),
      el('position: relative')
    );
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });

  it('intersects nested scroll boxes and the viewport', () => {
    const panel = nest(
      el('position: absolute'),
      el('overflow: auto; position: relative', { left: 0, top: 650, width: 500, height: 400 }),
      el('overflow: hidden', { left: 100, top: 0, width: 2000, height: 2000 })
    );
    expect(clippingBoundary(panel)).toEqual({
      left: 100,
      top: 650,
      right: 500,
      bottom: VIEWPORT.bottom
    });
  });

  it('does not consult body, whose scroll lock hides nothing on screen', () => {
    document.body.setAttribute('style', 'overflow: hidden');
    const panel = nest(el('position: absolute'), el('position: relative'));
    expect(clippingBoundary(panel)).toEqual(VIEWPORT);
  });
});
