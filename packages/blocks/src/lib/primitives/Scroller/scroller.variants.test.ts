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

  it('keeps the native scrollbar by default (plan §3.4/§7)', () => {
    // A bare row has no other way to promise there is more to see. It is hidden
    // only where controls or dots take over that job — see the scrollbar axis.
    const base = viewport();
    expect(base).not.toContain('scrollbar-none');
    expect(base).not.toContain('[&::-webkit-scrollbar]');
  });

  it('offers every snap strictness', () => {
    expect(viewport({ snap: 'proximity' })).toContain('snap-proximity');
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
  const lifted = (emphasis: 'subtle' | 'strong') => viewport({ emphasis, align: 'center' });

  it('is off by default', () => {
    expect(viewport()).not.toContain('animation-timeline');
  });

  it('drives the lift from scroll POSITION, not from a clock', () => {
    // `view(inline)` ties progress to where the item sits in the scrollport.
    // Where it is unsupported the animation simply never advances — the row
    // stays fully usable, just flat. That is why this technique ships today and
    // the ::scroll-marker one does not.
    expect(lifted('subtle')).toContain('[&>*]:[animation:blocks-scroller-emphasis_linear_both]');
    expect(lifted('subtle')).toContain('[&>*]:[animation-timeline:view(inline)]');
  });

  it('is wired ONLY for align="center" — a start-aligned row has no middle', () => {
    // The lift marks the item that has arrived in the middle of the scrollport.
    // With `align="start"` nothing ever arrives anywhere, so the same animation
    // would just make cards breathe at random. The component warns in DEV.
    for (const strength of ['subtle', 'strong'] as const) {
      expect(viewport({ emphasis: strength, align: 'start' })).not.toContain('animation-timeline');
      expect(viewport({ emphasis: strength, align: 'start' })).not.toContain('pt-3');
    }
  });

  it('scales the lift through custom properties, so strong is visibly stronger', () => {
    expect(lifted('subtle')).toContain('[--blocks-scroller-emphasis-scale:1.04]');
    expect(lifted('strong')).toContain('[--blocks-scroller-emphasis-scale:1.08]');
    // The elevation step between the strengths is carried by the scale alone:
    // strong deliberately does NOT switch to shadow-lg — it falls ~33px below
    // the card and reads as clipped even with generous padding. Both strengths
    // share the keyframe's md fallback; a deeper shadow stays a per-instance
    // custom-property override.
    expect(lifted('strong')).not.toContain('--blocks-scroller-emphasis-shadow');
  });

  it('makes vertical room for the lift AND its falling shadow', () => {
    // A scroll container clips at its padding box, so the padding is the only
    // room the raised card and its shadow get. Above, only the scale grows;
    // below, the md shadow's dense part plus the scale growth need ~28px.
    // Cutting through the dense part of the shadow is a visible hard edge on
    // the card (the bug this pins); only the faint outer tail may clip.
    for (const strength of ['subtle', 'strong'] as const) {
      expect(lifted(strength)).toContain('pt-3');
      expect(lifted(strength)).toContain('pb-7');
    }
  });

  it('removes the animation entirely under prefers-reduced-motion', () => {
    // Not by clearing the timeline: an animation without a timeline falls back
    // to the document clock and would run on its own, which is the opposite of
    // what reduced motion asks for.
    expect(lifted('subtle')).toContain('motion-reduce:[&>*]:[animation:none]');
    expect(lifted('subtle')).not.toContain('motion-reduce:[&>*]:[animation-timeline:none]');
  });

  it('never dims or blurs the neighbours (§3.7 condition 1)', () => {
    // Coverflow's inheritance. Dimming the edges destroys the very thing the
    // centred variant exists for — seeing how many there are.
    expect(lifted('strong')).not.toContain('blur');
    expect(lifted('strong')).not.toMatch(/\[&>\*\]:opacity-/);
  });
});

describe('Scroller variants — scrollbar', () => {
  it('shows the native scrollbar when nothing else promises there is more', () => {
    const bare = viewport({ scrollbar: 'visible' });
    expect(bare).not.toContain('[scrollbar-width:none]');
    expect(bare).not.toContain('[&::-webkit-scrollbar]:hidden');
  });

  it('hides it once controls or dots carry that promise instead', () => {
    // Otherwise a scrollbar sits directly above the control bar and the row has
    // three indicators for one fact.
    const withControls = viewport({ scrollbar: 'hidden' });
    expect(withControls).toContain('[scrollbar-width:none]');
    expect(withControls).toContain('[&::-webkit-scrollbar]:hidden');
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
