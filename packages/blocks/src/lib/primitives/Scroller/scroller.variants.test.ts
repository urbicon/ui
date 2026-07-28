import { describe, expect, it } from 'vitest';
import { scrollerVariants } from './scroller.variants';

// These assertions pin decisions from the plan that are invisible in the markup
// tests — they live entirely in CSS, so nothing else would catch them silently
// regressing.

const viewport = (props: Parameters<typeof scrollerVariants>[0] = {}) =>
  scrollerVariants(props).viewport();

describe('Scroller variants — the scroll mechanic is CSS', () => {
  it('scrolls on the inline axis and contains the overscroll', () => {
    const base = viewport();
    expect(base).toContain('overflow-x-auto');
    // A horizontal fling must not escape into page navigation / browser back.
    expect(base).toContain('overscroll-x-contain');
    // Without this, flexbox's min-content floor keeps the row from ever being
    // narrower than its items — so it would never overflow at all.
    expect(base).toContain('min-w-0');
  });

  it('sizes items from the itemBasis custom property and stops them shrinking', () => {
    const base = viewport();
    expect(base).toContain('[&>*]:shrink-0');
    expect(base).toContain('[&>*]:basis-[var(--blocks-scroller-item)]');
  });

  it('never scrolls vertically, and leaves room for a focus ring', () => {
    // Regression guard, found in the browser: CSS promotes the other axis from
    // `visible` to `auto` as soon as one axis scrolls, so `overflow-x-auto`
    // alone grows a VERTICAL scrollbar whenever a child reaches past the box —
    // the emphasis lift does it every time, and so does any card shadow.
    const base = viewport();
    expect(base).toContain('overflow-y-clip');
    // `clip` would otherwise shave off a `ring-2 ring-offset-2` focus ring on
    // an item, which is a focus indicator disappearing — not a cosmetic loss.
    expect(base).toContain('py-1');
  });

  it('makes vertical room for the emphasis lift', () => {
    expect(viewport({ emphasis: true })).toContain('py-3');
  });

  it('does NOT hide the native scrollbar (non-goal §7)', () => {
    // On pointer devices the scrollbar is the only standing promise that there
    // is more to see; touch platforms hide it themselves.
    const base = viewport();
    expect(base).not.toContain('scrollbar-none');
    expect(base).not.toContain('scrollbar-hide');
    expect(base).not.toContain('[&::-webkit-scrollbar]');
  });

  it('defaults to proximity snapping, never mandatory', () => {
    // `mandatory` can strand content between snap points; it stays an explicit
    // opt-in for "exactly one item per screen".
    expect(viewport()).toContain('snap-proximity');
    expect(viewport()).not.toContain('snap-mandatory');
    expect(viewport({ snap: 'mandatory' })).toContain('snap-mandatory');
    expect(viewport({ snap: 'none' })).toContain('snap-none');
  });

  it('drops smooth scrolling under prefers-reduced-motion', () => {
    const base = viewport();
    expect(base).toContain('scroll-smooth');
    expect(base).toContain('motion-reduce:scroll-auto');
  });
});

describe('Scroller variants — align', () => {
  it('start snaps items flush and adds no edge padding', () => {
    const start = viewport({ align: 'start' });
    expect(start).toContain('[&>*]:snap-start');
    expect(start).not.toContain('calc(50%');
  });

  it('center pads the track by half the leftover width — the centred-carousel fix', () => {
    // Without this padding the first and last item can never reach the middle:
    // the browser clamps at the scroll extent and they rest at the edge. It is
    // the most common defect in centred carousels and only shows up once you
    // swipe all the way to one end.
    const centre = viewport({ align: 'center' });
    expect(centre).toContain('[&>*]:snap-center');
    expect(centre).toContain('px-[calc(50%_-_var(--blocks-scroller-item)/2)]');
    expect(centre).not.toContain('[&>*]:snap-start');
  });
});

describe('Scroller variants — emphasis', () => {
  it('is off by default', () => {
    expect(viewport()).not.toContain('animation-timeline');
  });

  it('drives the lift from scroll POSITION, not from a clock', () => {
    const lifted = viewport({ emphasis: true });
    expect(lifted).toContain('[&>*]:[animation:blocks-scroller-emphasis_linear_both]');
    // `view(inline)` ties progress to where the item sits in the scrollport.
    // Where it is unsupported the animation simply never advances — the row
    // stays fully usable, just flat. That is why this technique ships today and
    // the ::scroll-marker one does not.
    expect(lifted).toContain('[&>*]:[animation-timeline:view(inline)]');
  });

  it('removes the animation entirely under prefers-reduced-motion', () => {
    // Not by clearing the timeline: an animation without a timeline falls back
    // to the document clock and would run on its own, which is the opposite of
    // what reduced motion asks for.
    const lifted = viewport({ emphasis: true });
    expect(lifted).toContain('motion-reduce:[&>*]:[animation:none]');
    expect(lifted).not.toContain('motion-reduce:[&>*]:[animation-timeline:none]');
  });

  it('never dims or blurs the neighbours (§3.7 condition 1)', () => {
    // Coverflow's inheritance. Dimming the edges destroys the very thing the
    // centred variant exists for — seeing how many there are.
    const lifted = viewport({ emphasis: true, align: 'center' });
    expect(lifted).not.toContain('blur');
    expect(lifted).not.toMatch(/\[&>\*\]:opacity-/);
  });
});

describe('Scroller variants — controls', () => {
  it('gives the dot a 24px hit target around an 8px mark (WCAG 2.5.8)', () => {
    const dot = scrollerVariants().dot();
    expect(dot).toContain('size-6');
    expect(dot).toContain('after:size-2');
  });

  it('drives the active dot look from aria-current, so state and style cannot drift', () => {
    expect(scrollerVariants().dot()).toContain('aria-[current=true]:after:bg-primary');
  });

  it('gives the jump buttons a comfortable touch target', () => {
    expect(scrollerVariants().control()).toContain('size-9');
  });
});
