// @vitest-environment jsdom
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuideController, type GuideStorageAdapter } from '../../utils/guide.svelte';
import GuideSurfacesHarness from './__fixtures__/GuideSurfacesHarness.svelte';

// The restProps contract of the Guide surfaces (COMPONENT-API-CONVENTIONS § Common props and
// § restProps ordering): an unmodelled attribute reaches the surface's own element, the
// attributes the surface computes win against a consumer's, and a handler the surface attaches
// itself runs before the consumer's instead of being replaced by it.

const noopStorage: GuideStorageAdapter = { load: () => [], save: () => {} };

let dispose: (() => void) | undefined;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The hint warns (DEV) while its anchor cannot be positioned in jsdom; not under test here.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  warn.mockRestore();
});

type HarnessProps = Omit<ComponentProps<typeof GuideSurfacesHarness>, 'controller'>;

function render(props: HarnessProps = {}) {
  const controller = new GuideController({ storage: noopStorage, dev: false });
  const instance = mount(GuideSurfacesHarness, {
    target: document.body,
    props: { controller, ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
  return controller;
}

const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
const click = (el: Element) => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  flushSync();
};

describe('GuideBeacon (restProps)', () => {
  it('passes an unmodelled attribute through and keeps its own type', () => {
    render({ beaconProps: { 'data-testid': 'beacon', type: 'submit' } });
    expect(byTestId('beacon').tagName).toBe('BUTTON');
    expect(byTestId('beacon').getAttribute('type')).toBe('button');
  });

  it('takes an aria-label when `label` is unset, and `label` over it', () => {
    render({ beaconProps: { 'data-testid': 'beacon', 'aria-label': 'Tour of reports' } });
    expect(byTestId('beacon').getAttribute('aria-label')).toBe('Tour of reports');
    dispose?.();

    render({ beaconProps: { 'data-testid': 'beacon', 'aria-label': 'ignored', label: 'Wins' } });
    expect(byTestId('beacon').getAttribute('aria-label')).toBe('Wins');
  });

  it('runs a consumer onclick after its own activation', () => {
    const order: string[] = [];
    render({
      beaconProps: {
        'data-testid': 'beacon',
        onActivate: () => order.push('activate'),
        onclick: () => order.push('consumer')
      }
    });
    click(byTestId('beacon'));
    expect(order).toEqual(['activate', 'consumer']);
  });
});

describe('GuideMarker (restProps)', () => {
  it('passes an unmodelled attribute through and keeps its own state', () => {
    render({ markerProps: { 'data-testid': 'marker', 'aria-expanded': true } });
    expect(byTestId('marker').hasAttribute('data-guide-marker')).toBe(true);
    // The panel is closed, so the computed `false` wins over the consumer's `true`.
    expect(byTestId('marker').getAttribute('aria-expanded')).toBe('false');
  });

  it('takes an aria-label when `label` is unset', () => {
    render({ markerProps: { 'data-testid': 'marker', 'aria-label': 'About saving' } });
    expect(byTestId('marker').getAttribute('aria-label')).toBe('About saving');
  });

  it('runs a consumer onclick after the panel opens', () => {
    const seen: boolean[] = [];
    const controller = render({
      markerProps: { 'data-testid': 'marker', onclick: () => seen.push(controller.panelOpen) }
    });
    click(byTestId('marker'));
    expect(seen).toEqual([true]);
  });
});

describe('GuideHint (restProps)', () => {
  it('passes an unmodelled attribute through and keeps its live-region role', () => {
    render({ hintProps: { 'data-testid': 'hint', role: 'alert', 'aria-label': 'Tip' } });
    expect(byTestId('hint').textContent).toContain('Hint body');
    expect(byTestId('hint').getAttribute('role')).toBe('status');
    expect(byTestId('hint').getAttribute('aria-label')).toBe('Tip');
  });

  it('runs a consumer onkeydown after its own Escape dismissal', () => {
    const seen: boolean[] = [];
    render({
      hintProps: { 'data-testid': 'hint', onkeydown: (event) => seen.push(event.defaultPrevented) }
    });
    byTestId('hint').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    flushSync();
    expect(seen).toEqual([true]);
  });
});

describe('GuidePanel (restProps)', () => {
  it('passes an unmodelled attribute through and keeps its own state and name', () => {
    render({
      panelProps: {
        'data-testid': 'panel',
        'data-state': 'open',
        'aria-labelledby': 'elsewhere'
      }
    });
    const panel = byTestId('panel');
    expect(panel.tagName).toBe('ASIDE');
    expect(panel.getAttribute('data-state')).toBe('closed');
    expect(panel.getAttribute('aria-labelledby')).toBe(`${panel.id}-title`);
  });
});

describe('GuideArticle (restProps)', () => {
  it('passes an unmodelled attribute through to the active article', () => {
    const controller = render({ articleProps: { 'data-testid': 'article', class: 'prose' } });
    controller.openPanel('a');
    flushSync();
    expect(byTestId('article').tagName).toBe('ARTICLE');
    expect(byTestId('article').classList.contains('prose')).toBe(true);
  });
});

describe('GuideRef (restProps)', () => {
  it('runs a consumer onclick after the navigation', () => {
    const seen: (string | null)[] = [];
    const controller = render({
      refProps: { 'data-testid': 'ref', onclick: () => seen.push(controller.activeArticle) }
    });
    expect(byTestId('ref').tagName).toBe('BUTTON');
    click(byTestId('ref'));
    expect(seen).toEqual(['a']);
  });

  it('keeps the attribute and handler on the plain-text fallback', () => {
    const onclick = vi.fn();
    render({ refProps: { 'data-testid': 'ref', article: 'missing', onclick } });
    expect(byTestId('ref').tagName).toBe('SPAN');
    click(byTestId('ref'));
    expect(onclick).toHaveBeenCalledOnce();
  });
});

describe('GuideMention (restProps)', () => {
  it('runs consumer hover and click handlers after its own highlight', () => {
    const seen: (string | null)[] = [];
    const controller = render({
      mentionProps: {
        'data-testid': 'mention',
        onmouseenter: () => seen.push(controller.highlightedId),
        onclick: () => seen.push(controller.highlightedId)
      }
    });
    byTestId('mention').dispatchEvent(new MouseEvent('mouseenter'));
    flushSync();
    click(byTestId('mention'));
    expect(seen).toEqual(['save', 'save']);
  });

  it('keeps the attribute and handler on the plain-text fallback', () => {
    const onclick = vi.fn();
    render({ mentionProps: { 'data-testid': 'mention', direction: 'to-guide', onclick } });
    expect(byTestId('mention').tagName).toBe('SPAN');
    click(byTestId('mention'));
    expect(onclick).toHaveBeenCalledOnce();
  });
});
