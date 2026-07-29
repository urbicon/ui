// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMicroInteraction } from './engine';

/**
 * The cleanup contract of the micro-interaction engine.
 *
 * Every one of these cases was live in the shipped library: the cleanup
 * listened to `animationend` AND `transitionend`, unfiltered and without a
 * target guard, so ANY of them ended the effect. Measured on a Checkbox with
 * `mint="bounce"`: the class was gone 20 ms into a 500 ms animation, killed by
 * the box's own `background-color` transition. That made every click-mint
 * (bounce/shake/wiggle on Button, ButtonGroup, SegmentItem, Checkbox) a no-op.
 *
 * jsdom fires neither animations nor transitions on its own — the tests
 * dispatch the end events by hand, which is exactly the point: they assert
 * WHICH event the engine accepts, not that the browser produces one.
 */

const CLASS = 'blocks-mint-bounce';

// jsdom implements neither AnimationEvent nor TransitionEvent, so the fields
// the engine filters on (`animationName` / `propertyName`) have to be attached
// by hand. Same shape the browser dispatches — that is all the engine reads.
function animationEnd(animationName: string): Event {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  return event;
}

function transitionEnd(propertyName: string): Event {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  return event;
}

let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  // The engine early-returns on reduced motion; report "no preference".
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  host = document.createElement('button');
  document.body.append(host);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function bounce(el: HTMLElement = host) {
  const mint = createMicroInteraction(
    CLASS,
    { trigger: 'click', duration: 600 },
    { via: 'animation' }
  );
  mint.init(el);
  return mint;
}

describe('createMicroInteraction — cleanup signal', () => {
  it('survives a foreign transition on the animated element', () => {
    bounce();
    host.click();
    expect(host.classList.contains(CLASS)).toBe(true);

    // What the Checkbox's checked-change does: color/background-color/
    // border-color/box-shadow/scale all finish long before the keyframes do.
    for (const propertyName of ['background-color', 'border-color', 'box-shadow']) {
      host.dispatchEvent(transitionEnd(propertyName));
    }

    expect(host.classList.contains(CLASS)).toBe(true);
  });

  it('survives an end event bubbling up from a child', () => {
    const icon = document.createElement('span');
    host.append(icon);
    bounce();
    host.click();

    // Both event types bubble. An icon finishing its own animation must not
    // end the button's mint.
    icon.dispatchEvent(animationEnd(CLASS));

    expect(host.classList.contains(CLASS)).toBe(true);
  });

  it('settles on its own animation end', () => {
    bounce();
    host.click();

    host.dispatchEvent(animationEnd(CLASS));

    expect(host.classList.contains(CLASS)).toBe(false);
    expect(host.hasAttribute(`data-animating-${CLASS}`)).toBe(false);
  });

  it('ignores a foreign animation name on the element itself', () => {
    bounce();
    host.click();

    host.dispatchEvent(animationEnd('some-app-keyframes'));

    expect(host.classList.contains(CLASS)).toBe(true);
  });

  it('falls back to the timeout when no end event ever arrives', () => {
    bounce();
    host.click();

    vi.advanceTimersByTime(650);

    expect(host.classList.contains(CLASS)).toBe(false);
  });

  it('does not let a settled run strip the next run', () => {
    bounce();
    host.click();
    host.dispatchEvent(animationEnd(CLASS));

    // Second click well inside the first run's fallback window. The stale timer
    // used to survive the event cleanup and fire into this run.
    host.click();
    expect(host.classList.contains(CLASS)).toBe(true);

    vi.advanceTimersByTime(100);
    expect(host.classList.contains(CLASS)).toBe(true);
  });

  it('accepts only the declared transition property', () => {
    const mint = createMicroInteraction(
      'blocks-mint-glow',
      { trigger: 'click', duration: 300 },
      { via: 'transition', properties: ['box-shadow'] }
    );
    mint.init(host);
    host.click();

    host.dispatchEvent(transitionEnd('background-color'));
    expect(host.classList.contains('blocks-mint-glow')).toBe(true);

    host.dispatchEvent(transitionEnd('box-shadow'));
    expect(host.classList.contains('blocks-mint-glow')).toBe(false);
  });

  it('survives a framework rewriting the whole class attribute', async () => {
    bounce();
    host.className = 'blocks-button intent-primary';
    host.click();
    expect(host.classList.contains(CLASS)).toBe(true);

    // What Svelte does on the re-render the click itself triggers: it sets
    // `class` wholesale from its own template value, with no idea a mint added
    // one. Measured on a Checkbox: 0.7 ms after the class went on.
    host.setAttribute('class', 'blocks-button intent-primary is-checked');

    // MutationObserver callbacks are delivered on the microtask queue.
    await Promise.resolve();

    expect(host.classList.contains(CLASS)).toBe(true);
    // …and the framework's own classes are untouched.
    expect(host.classList.contains('is-checked')).toBe(true);
  });

  it('stops defending the class once the run is over', async () => {
    bounce();
    host.click();
    host.dispatchEvent(animationEnd(CLASS));
    expect(host.classList.contains(CLASS)).toBe(false);

    // A later unrelated rewrite must not resurrect the effect.
    host.setAttribute('class', 'blocks-button');
    await Promise.resolve();

    expect(host.classList.contains(CLASS)).toBe(false);
  });

  it('ends a run in flight when the element is destroyed', () => {
    const mint = bounce();
    host.click();
    expect(host.classList.contains(CLASS)).toBe(true);

    mint.destroy?.(host);

    expect(host.classList.contains(CLASS)).toBe(false);
  });
});

describe('createMicroInteraction — click surface', () => {
  it('hears a click on the label that owns the animated box', () => {
    // The Checkbox shape: the mint animates the box, but the click target a
    // user hits is the label text next to it.
    const label = document.createElement('label');
    const box = document.createElement('span');
    const text = document.createElement('span');
    text.textContent = 'Send me updates';
    label.append(box, text);
    document.body.append(label);

    bounce(box);
    text.click();

    expect(box.classList.contains(CLASS)).toBe(true);
  });

  it('keeps hover on the element itself', () => {
    const label = document.createElement('label');
    const box = document.createElement('span');
    const text = document.createElement('span');
    label.append(box, text);
    document.body.append(label);

    const glow = createMicroInteraction(
      'blocks-mint-glow',
      { trigger: 'hover', duration: 300 },
      { via: 'transition', properties: ['box-shadow'] }
    );
    glow.init(box);

    // Pointer over the label text, 80 px from the box — the box must stay dark.
    text.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(box.classList.contains('blocks-mint-glow')).toBe(false);

    box.dispatchEvent(new MouseEvent('mouseenter'));
    expect(box.classList.contains('blocks-mint-glow')).toBe(true);
  });
});
