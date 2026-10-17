// @vitest-environment jsdom
import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import PlaygroundConfigurator from './PlaygroundConfigurator.svelte';

/**
 * The stage latch: while the reader works the controls the stage may grow but
 * never shrink; working the demo itself lets it follow its content (#211).
 *
 * jsdom does no layout, so the test drives the two inputs the latch reads by
 * hand — the stage's `offsetHeight` and the ResizeObserver callback.
 */

const CONTROLS: ControlDefinition[] = [
  { key: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false }
];

let observers: Array<() => void> = [];
const OriginalResizeObserver = window.ResizeObserver;
let cleanup: (() => void) | null = null;

beforeEach(() => {
  window.ResizeObserver = class {
    #callback: () => void;
    constructor(callback: () => void) {
      this.#callback = callback;
    }
    observe() {
      observers.push(this.#callback);
    }
    unobserve() {}
    disconnect() {
      observers = observers.filter((cb) => cb !== this.#callback);
    }
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup?.();
  cleanup = null;
  observers = [];
  window.ResizeObserver = OriginalResizeObserver;
});

function render() {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(PlaygroundConfigurator, {
    target,
    props: {
      controls: CONTROLS,
      children: createRawSnippet(() => ({
        render: () => '<button type="button">demo</button>'
      }))
    }
  });
  cleanup = () => {
    unmount(component);
    target.remove();
  };
  flushSync();

  const stage = target.querySelector<HTMLElement>('[data-docs-stage-frame] > div');
  const demo = target.querySelector<HTMLElement>('[data-docs-stage-frame] button');
  const knob = target.querySelector<HTMLElement>('input[type="checkbox"]');
  if (!stage || !demo || !knob) throw new Error('playground did not render its parts');

  let height = 0;
  Object.defineProperty(stage, 'offsetHeight', { get: () => height });
  Object.defineProperty(stage, 'offsetWidth', { get: () => 600 });
  // The attachment read jsdom's width of 0; the first tick sees 600 and is
  // spent dropping the mark for the width change, as it is in a browser.
  for (const cb of observers) cb();
  flushSync();

  return {
    stage,
    demo,
    knob,
    /** The content changed size: report it the way a ResizeObserver would. */
    resize(next: number) {
      height = next;
      for (const cb of observers) cb();
      flushSync();
    },
    press(el: HTMLElement) {
      el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      flushSync();
    }
  };
}

describe('PlaygroundConfigurator stage latch', () => {
  it('holds the tallest height while the controls are worked', () => {
    const { stage, resize } = render();

    resize(400);
    expect(stage.style.minHeight).toBe('400px');

    resize(250);
    expect(stage.style.minHeight).toBe('400px');
  });

  it('follows the content once the demo itself is worked', () => {
    const { stage, demo, resize, press } = render();
    resize(400);

    press(demo);
    expect(stage.style.minHeight).toBe('');

    resize(250);
    expect(stage.style.minHeight).toBe('');
  });

  it('re-arms at the current height when the reader returns to the controls', () => {
    const { stage, demo, knob, resize, press } = render();
    resize(400);
    press(demo);
    resize(250);

    press(knob);
    expect(stage.style.minHeight).toBe('250px');

    resize(180);
    expect(stage.style.minHeight).toBe('250px');
  });

  it('keeps the content top-aligned across release, re-arm and reset', () => {
    // Re-centring a specimen shorter than the stage between pointerdown and
    // pointerup moves it out from under the pointer and the click is lost.
    const { stage, demo, knob, resize, press } = render();
    resize(400);
    expect(stage.hasAttribute('data-latched')).toBe(true);

    press(demo);
    expect(stage.hasAttribute('data-latched')).toBe(true);

    press(knob);
    expect(stage.hasAttribute('data-latched')).toBe(true);

    knob.click();
    flushSync();
    const reset = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('(1)')
    );
    if (!reset) throw new Error('no "Reset all" after a knob change');
    reset.click();
    flushSync();
    expect(stage.style.minHeight).toBe('');
    expect(stage.hasAttribute('data-latched')).toBe(true);
  });

  it('keeps the mark when the stage’s own dead space is pressed', () => {
    const { stage, resize, press } = render();
    resize(400);

    press(stage);
    expect(stage.style.minHeight).toBe('400px');
  });
});
