import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Scroller — an overflow behaviour, not a navigation pattern.
 *
 * The whole scroll mechanic is CSS; JavaScript only observes it (does it
 * overflow? where is it?) and drives the optional controls. Two custom
 * properties, set inline by the component, parameterise the track:
 *
 * - `--blocks-scroller-item` — each item's flex basis (the `itemBasis` prop).
 *   It is what decides WHEN the row overflows, and the centred variant needs it
 *   to compute its edge padding.
 * - `--blocks-scroller-emphasis-scale` / `-shadow` — retune the `emphasis`
 *   lift per instance without widening the component API (the Tooltip
 *   convention). The keyframes live in `style/interaction.css`; `@keyframes`
 *   cannot be expressed as a utility.
 */
export const scrollerVariants = tv({
  slots: {
    // Column: the row itself, then the control bar underneath it. The bar sits
    // BELOW rather than floating over the items on purpose — overlay arrows
    // cover content, compete with the cards for clicks, and need contrast work
    // against whatever the consumer put in the row. A bar needs none of that.
    root: ['flex flex-col min-w-0'],

    // The scroll container. `overscroll-x-contain` keeps a horizontal fling from
    // escaping into the page/browser history; `min-w-0` defeats flexbox's
    // min-content floor so the row can actually be narrower than its items —
    // without it the container simply grows and never overflows.
    //
    // The native scrollbar is deliberately NOT hidden (plan §3.4/§7): on pointer
    // devices it is the only standing promise that there is more to see. Touch
    // platforms hide it themselves.
    //
    // No `scroll-padding`: its job — never leaving a focused item half outside —
    // is already done by `scroll-snap-align` (the browser scrolls focus to the
    // snap position, i.e. flush or centred), and with `snap="none"` the native
    // "scroll minimally into view" is by definition fully-in-view. Adding it
    // would also shift the snapport edge and desync `scroller.utils`' geometry.
    viewport: [
      // `overflow-y-clip` is load-bearing, not tidiness: CSS promotes the other
      // axis from `visible` to `auto` as soon as one axis scrolls, so a plain
      // `overflow-x-auto` row grows a VERTICAL scrollbar the moment anything
      // reaches past its box — a card shadow, a focus ring, or the `emphasis`
      // lift. A horizontal row must never scroll vertically; `clip` says so,
      // and unlike `hidden` it does not create a scroll container on that axis.
      //
      // `py-1` is the flip side of that clip: it leaves exactly the 4px a
      // `ring-2 ring-offset-2` focus ring needs, so clipping can never swallow
      // a focus indicator. Deeper shadows want more — `slotClasses.viewport`.
      // `relative` makes the viewport its items' `offsetParent`, which is what
      // lets the component measure them with the transform-free layout API
      // (offsetLeft/offsetWidth) instead of the visual rect — see measure().
      'relative flex min-w-0 overflow-x-auto overflow-y-clip overscroll-x-contain py-1',
      'scroll-smooth motion-reduce:scroll-auto',
      // Items are consumer markup, so their layout rules are applied from here
      // rather than asked for in the docs. `shrink-0` + the basis is what makes
      // the row overflow at all.
      '[&>*]:shrink-0 [&>*]:basis-[var(--blocks-scroller-item)]',
      // The ring can live on the base because the component only makes the
      // viewport focusable while it actually overflows — on a row that fits,
      // there is no tabindex for this to ever show on.
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'
    ],

    // Controls + dots on one line: previous, indicator, next.
    controls: ['flex items-center justify-center gap-2 pt-3'],

    // Visual identity for the internal CoreIconButton (which ships behaviour
    // only). 36px clears the 24px WCAG 2.5.8 floor with room for touch.
    control: [
      'size-9 rounded-full',
      'border border-border-default bg-surface-base text-text-secondary',
      'transition-[background-color,color,border-color] duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover hover:text-text-primary hover:border-border-strong',
      'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'
    ],

    indicator: ['flex items-center gap-1'],

    // The dot is a 24px hit target (WCAG 2.5.8) around an 8px mark: the button
    // carries the size, the `::after` carries the look. Its active state is
    // driven by `aria-current` — the accessible state IS the styling state, so
    // the two can never drift apart.
    dot: [
      'relative size-6 flex items-center justify-center rounded-full cursor-pointer',
      "after:content-[''] after:size-2 after:rounded-full after:bg-border-strong",
      'after:transition-[background-color,scale] after:duration-[var(--blocks-duration-fast)]',
      'hover:after:bg-text-tertiary',
      'aria-[current=true]:after:bg-primary aria-[current=true]:after:scale-125',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'
    ]
  },

  variants: {
    // Where an item comes to rest. `center` additionally pads the track by half
    // the leftover width, which is the ONLY way the first and last item can ever
    // reach the middle — without it the browser clamps at the scroll extent and
    // they rest at the edge. That is the classic centred-carousel bug (plan
    // §3.7), and it is a layout rule, not decoration, so it lives here.
    align: {
      start: { viewport: '[&>*]:snap-start' },
      center: {
        viewport: ['[&>*]:snap-center', 'px-[calc(50%_-_var(--blocks-scroller-item)/2)]']
      }
    },

    snap: {
      // Default. `mandatory` can strand content the browser then skips past;
      // `proximity` snaps when you let go nearby and otherwise stays out of the
      // way (plan §3.5).
      proximity: { viewport: 'snap-x snap-proximity' },
      // Deliberate opt-in for "exactly one item per screen".
      mandatory: { viewport: 'snap-x snap-mandatory' },
      none: { viewport: 'snap-none' }
    },

    gap: {
      xs: { viewport: 'gap-1' },
      sm: { viewport: 'gap-2' },
      md: { viewport: 'gap-4' },
      lg: { viewport: 'gap-6' },
      xl: { viewport: 'gap-8' }
    },

    // Scroll-driven lift of whatever item sits in the middle of the scrollport.
    // Pure CSS: `animation-timeline: view(inline)` ties progress to the item's
    // position, so there is no JS to keep in sync and nothing to fall back to —
    // where the timeline is unsupported the animation simply never advances and
    // the row is exactly as usable, only flat (plan §3.7).
    //
    // The neighbours are NOT dimmed or blurred (plan §3.7 condition 1): the
    // point is to mark the middle, not to devalue the edges — dimming kills the
    // "you can see how many there are" that justifies the whole variant.
    emphasis: {
      true: {
        viewport: [
          '[&>*]:[animation:blocks-scroller-emphasis_linear_both]',
          '[&>*]:[animation-timeline:view(inline)]',
          'motion-reduce:[&>*]:[animation:none]',
          // The lift grows the item past the track's box on BOTH axes. The
          // vertical growth has nowhere to go (see `overflow-y-clip` above), so
          // the row makes room for it — otherwise the raised card and its
          // shadow are shaved off at the top and bottom.
          'py-3'
        ]
      }
    }

    // No `overflowing` style axis on purpose. Overflow decides *behaviour* —
    // the tab stop, the controls, the dots — and changes nothing about the
    // resting look, so a tv() axis would either be empty or invent a class to
    // justify itself (`cursor-grab` would be the tempting one, and it would be
    // a lie: there is no drag-to-scroll here, the browser does the scrolling).
    // The state is exposed as `data-overflowing` on the root instead, which is
    // a styling hook without a styling claim.
  },

  defaultVariants: {
    align: 'start',
    snap: 'proximity',
    gap: 'md',
    emphasis: false
  }
});

export type ScrollerVariants = VariantProps<typeof scrollerVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type ScrollerSlots = SlotNames<typeof scrollerVariants>;
