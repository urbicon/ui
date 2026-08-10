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
  // The engine early-returns on reduced motion and gates held hover on
  // `(hover: hover)` — report "no reduced-motion preference, real pointer".
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('hover: hover')
  }));
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

describe('createMicroInteraction — infinite animation (pulse shape)', () => {
  function pulse() {
    const mint = createMicroInteraction(
      'blocks-mint-pulse',
      { trigger: 'click', duration: 1000 },
      { via: 'animation-iteration' }
    );
    mint.init(host);
    return mint;
  }

  function animationIteration(animationName: string): Event {
    const event = new Event('animationiteration', { bubbles: true });
    Object.defineProperty(event, 'animationName', { value: animationName });
    return event;
  }

  it('settles at the end of the cycle instead of the fallback timeout', () => {
    pulse();
    host.click();
    expect(host.classList.contains('blocks-mint-pulse')).toBe(true);

    // An `infinite` animation never fires `animationend`; the iteration
    // boundary is the only clean moment to remove the class.
    host.dispatchEvent(animationIteration('blocks-mint-pulse'));

    expect(host.classList.contains('blocks-mint-pulse')).toBe(false);
  });

  it('ignores a foreign animation name on the iteration event', () => {
    pulse();
    host.click();

    host.dispatchEvent(animationIteration('some-app-keyframes'));

    expect(host.classList.contains('blocks-mint-pulse')).toBe(true);
  });

  it('still falls back to the timeout when no iteration ever completes', () => {
    pulse();
    host.click();

    vi.advanceTimersByTime(1050);

    expect(host.classList.contains('blocks-mint-pulse')).toBe(false);
  });
});

describe('createMicroInteraction — consumer config as inline custom properties', () => {
  function scale(config?: Record<string, unknown>) {
    const mint = createMicroInteraction(
      'blocks-mint-scale',
      { trigger: 'click', duration: 200 },
      { via: 'transition', properties: ['transform'] }
    );
    mint.init(host, config);
    return mint;
  }

  it('writes the intensity property the stylesheet actually reads', () => {
    scale({ intensity: 1.1 });

    // `.blocks-mint-scale` reads `--blocks-mint-scale-intensity`. The engine
    // used to write the legacy `--scale-intensity`, whose styles.css alias
    // maps old name → new only — configured intensity silently did nothing.
    expect(host.style.getPropertyValue('--blocks-mint-scale-intensity')).toBe('1.1');
    expect(host.style.getPropertyValue('--scale-intensity')).toBe('');
  });

  it('writes duration and easing as per-effect vars, for the mint lifetime', () => {
    const mint = scale({ duration: 500, easing: 'linear' });

    // Lifetime, not per run: the exit transition after a settle still reads
    // them, so they only leave with destroy().
    expect(host.style.getPropertyValue('--blocks-mint-scale-duration')).toBe('500ms');
    expect(host.style.getPropertyValue('--blocks-mint-scale-easing')).toBe('linear');

    host.click();
    host.dispatchEvent(transitionEnd('transform'));
    expect(host.style.getPropertyValue('--blocks-mint-scale-duration')).toBe('500ms');

    mint.destroy?.(host);
    expect(host.style.getPropertyValue('--blocks-mint-scale-duration')).toBe('');
    expect(host.style.getPropertyValue('--blocks-mint-scale-easing')).toBe('');
    expect(host.style.getPropertyValue('--blocks-mint-scale-intensity')).toBe('');
  });

  it('registration defaults do NOT become inline vars — theme tokens stay in charge', () => {
    // The negative control: the factory's own default duration (200 above)
    // must not override the theme's `--blocks-duration-*` tokens.
    scale();

    expect(host.style.getPropertyValue('--blocks-mint-scale-duration')).toBe('');
    expect(host.style.getPropertyValue('--blocks-mint-scale-easing')).toBe('');
  });
});

describe('createMicroInteraction — held triggers (hover, focus)', () => {
  function hoverScale(config?: Record<string, unknown>) {
    const mint = createMicroInteraction(
      'blocks-mint-scale',
      { trigger: 'hover', duration: 200 },
      { via: 'transition', properties: ['transform'] }
    );
    mint.init(host, config);
    return mint;
  }

  it('holds the class while hovered — no clock and no settle event end it', () => {
    hoverScale();
    host.dispatchEvent(new MouseEvent('mouseenter'));
    expect(host.classList.contains('blocks-mint-scale')).toBe(true);

    // The one-shot model used to remove the class on the enter transition's
    // own transitionend (~150 ms) while the pointer was still on the element.
    host.dispatchEvent(transitionEnd('transform'));
    vi.advanceTimersByTime(10_000);

    expect(host.classList.contains('blocks-mint-scale')).toBe(true);
  });

  it('releases on mouseleave', () => {
    hoverScale();
    host.dispatchEvent(new MouseEvent('mouseenter'));
    host.dispatchEvent(new MouseEvent('mouseleave'));

    expect(host.classList.contains('blocks-mint-scale')).toBe(false);
  });

  it('defends the class against a framework class rewrite while held', async () => {
    hoverScale();
    host.dispatchEvent(new MouseEvent('mouseenter'));

    host.setAttribute('class', 'blocks-button is-active');
    await Promise.resolve();
    expect(host.classList.contains('blocks-mint-scale')).toBe(true);

    host.dispatchEvent(new MouseEvent('mouseleave'));
    host.setAttribute('class', 'blocks-button');
    await Promise.resolve();
    expect(host.classList.contains('blocks-mint-scale')).toBe(false);
  });

  it('a leave before the configured delay elapses never applies', () => {
    hoverScale({ delay: 100 });
    host.dispatchEvent(new MouseEvent('mouseenter'));
    host.dispatchEvent(new MouseEvent('mouseleave'));

    vi.advanceTimersByTime(200);
    expect(host.classList.contains('blocks-mint-scale')).toBe(false);
  });

  it('destroy releases a held class', () => {
    const mint = hoverScale();
    host.dispatchEvent(new MouseEvent('mouseenter'));

    mint.destroy?.(host);
    expect(host.classList.contains('blocks-mint-scale')).toBe(false);
  });

  it('focus holds only for keyboard (focus-visible) focus, and blur releases', () => {
    const mint = createMicroInteraction('blocks-mint-glow', { trigger: 'focus' }, undefined);
    mint.init(host);

    // jsdom runs the real input-modality heuristic: fresh and after-mouse
    // focus is NOT :focus-visible, after a keydown it is.

    // Pointer-modality focus — the visible-focus gate must reject it.
    host.dispatchEvent(new MouseEvent('mousedown'));
    host.focus();
    expect(host.classList.contains('blocks-mint-glow')).toBe(false);
    host.blur();

    // Keyboard-modality focus — this is what the effect exists for.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    host.focus();
    expect(host.classList.contains('blocks-mint-glow')).toBe(true);

    host.blur();
    expect(host.classList.contains('blocks-mint-glow')).toBe(false);
  });
});

describe('createMicroInteraction — review fixes (re-sync, touch gate, orphaned runs)', () => {
  it('a re-applied mint picks up focus the element already has', () => {
    // mintAttachment tears down and re-applies on every enabled flip / prop
    // identity change. The fresh instance must not wait for the NEXT enter —
    // for a resting pointer or held focus that event never comes.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    host.focus();

    const mint = createMicroInteraction('blocks-mint-glow', { trigger: 'focus' }, undefined);
    mint.init(host);

    expect(host.classList.contains('blocks-mint-glow')).toBe(true);
  });

  it('held hover does not engage on a touch-primary device', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      // reduced-motion: no preference; (hover: hover): false — touch device.
      matches: false
    }));
    const mint = createMicroInteraction(
      'blocks-mint-scale',
      { trigger: 'hover' },
      { via: 'transition', properties: ['transform'] }
    );
    mint.init(host);

    // The tap-simulated mouseenter must not stick the effect.
    host.dispatchEvent(new MouseEvent('mouseenter'));
    expect(host.classList.contains('blocks-mint-scale')).toBe(false);
  });

  it('destroy during the run delay window cancels the scheduled run', () => {
    const mint = createMicroInteraction(
      'blocks-mint-shake',
      { trigger: 'click', duration: 500, delay: 300 },
      { via: 'animation' }
    );
    mint.init(host);
    host.click();
    mint.destroy?.(host);

    vi.advanceTimersByTime(1000);
    expect(host.classList.contains('blocks-mint-shake')).toBe(false);
    expect(host.hasAttribute('data-animating-blocks-mint-shake')).toBe(false);
  });

  it('a second click inside the delay window does not start a second run', () => {
    const mint = createMicroInteraction(
      'blocks-mint-shake',
      { trigger: 'click', duration: 500, delay: 300 },
      { via: 'animation' }
    );
    mint.init(host);
    host.click();
    host.click();

    vi.advanceTimersByTime(300);
    expect(host.classList.contains('blocks-mint-shake')).toBe(true);

    // One run, one cleanup: after the single fallback window the class is
    // gone and STAYS gone — a second orphaned timer would have re-stripped
    // a later run instead.
    vi.advanceTimersByTime(550);
    expect(host.classList.contains('blocks-mint-shake')).toBe(false);
    expect(host.hasAttribute('data-animating-blocks-mint-shake')).toBe(false);
  });

  it('destroy before the load rAF fires cancels the run', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks[id - 1] = () => {};
    });

    const mint = createMicroInteraction(
      'blocks-mint-bounce',
      { trigger: 'load', duration: 600 },
      { via: 'animation' }
    );
    mint.init(host);
    mint.destroy?.(host);

    for (const callback of rafCallbacks) callback(0);
    expect(host.classList.contains('blocks-mint-bounce')).toBe(false);
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
