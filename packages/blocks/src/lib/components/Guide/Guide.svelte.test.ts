// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { GuideController, type GuideStorageAdapter } from '../../utils/guide.svelte';
import GuideTourHarness from './__fixtures__/GuideTourHarness.svelte';
import type { GuideProps } from './index';

// The tour renderer's restProps contract (COMPONENT-API-CONVENTIONS § Common
// props). Guide has no single root — a live region, a full-screen popover layer
// and the scrim are positioning machinery — so the rest lands on the bubble, the
// `role="dialog"` surface that `class` styles too. Target-less steps keep the
// bubble centered, so no layout is needed.

const noopStorage: GuideStorageAdapter = { load: () => [], save: () => {} };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function startTour(guideProps: GuideProps = {}) {
  const controller = new GuideController({ storage: noopStorage, dev: false });
  const instance = mount(GuideTourHarness, {
    target: document.body,
    props: { controller, guideProps }
  });
  dispose = () => unmount(instance);
  flushSync();
  controller.startTour({ id: 'welcome', steps: [{ title: 'One' }, { title: 'Two' }] });
  flushSync();
  return controller;
}

const bubble = () => document.querySelector('[role="dialog"]') as HTMLElement;

describe('Guide (restProps)', () => {
  it('passes an unmodelled attribute through to the bubble', () => {
    startTour({ 'data-testid': 'tour', class: 'max-w-xs' });

    expect(bubble().getAttribute('data-testid')).toBe('tour');
    expect(bubble().textContent).toContain('One');
    // `class` keeps going through the tv() pipeline next to the spread.
    expect(bubble().classList.contains('max-w-xs')).toBe(true);
    expect(bubble().classList.contains('guide-tour-bubble')).toBe(true);
  });

  it('renders the attribute only while a step shows', () => {
    const controller = new GuideController({ storage: noopStorage, dev: false });
    const instance = mount(GuideTourHarness, {
      target: document.body,
      props: { controller, guideProps: { 'data-testid': 'tour' } }
    });
    dispose = () => unmount(instance);
    flushSync();

    expect(document.querySelector('[data-testid="tour"]')).toBeNull();
  });

  it('keeps its own dialog semantics against a contradicting consumer', () => {
    startTour({ role: 'region', tabindex: 0, 'aria-modal': 'false', 'aria-label': 'Tour' });

    const el = document.querySelector('.guide-tour-bubble') as HTMLElement;
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('tabindex')).toBe('-1');
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.getAttribute('aria-label')).toBe('Guided tour');
  });

  it('keeps its positioning style against a consumer style', () => {
    startTour({ style: 'position:static' });
    expect(bubble().style.position).toBe('fixed');
  });

  it('runs a consumer onkeydown after its own arrow-key stepping', () => {
    const seen: boolean[] = [];
    const controller = startTour({ onkeydown: (event) => seen.push(event.defaultPrevented) });

    bubble().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    );
    flushSync();

    expect(controller.stepIndex).toBe(1);
    expect(bubble().textContent).toContain('Two');
    // The bubble had already claimed the key when the consumer's handler ran.
    expect(seen).toEqual([true]);
  });

  it('still skips the tour on Escape when a consumer onkeydown prevents it', () => {
    const controller = startTour({ onkeydown: (event) => event.preventDefault() });

    bubble().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    flushSync();

    expect(controller.isTourActive).toBe(false);
  });
});
