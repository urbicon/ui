import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const cardVariants = tv({
  slots: {
    base: [
      // `translate`, NOT `transform`: Tailwind 4 emits `-translate-y-*` as the
      // discrete CSS `translate:` property, so a list naming only `transform`
      // never animates the `interactive` hover lift — it would jump.
      'relative block w-full transition-[color,background-color,border-color,box-shadow,opacity,translate] duration-[var(--blocks-duration-fast)] ease-out box-border',
      // Structure radius — cards are architectural surfaces, not human/CTA.
      'rounded-contain'
    ],
    header: ['flex items-center justify-between'],
    content: ['flex-1'],
    footer: ['flex items-center justify-between']
  },
  // Variant contract (surface-token explainer in
  // docs/ARCHITECTURE.md §Component Styling):
  //   quiet    → bg-surface-quiet, no border / no shadow — reading-flow default
  //   outlined → border only, transparent bg — architectural in-page
  //   elevated → shadow only, surface-elevated bg — lifted, no border
  //   floating → shadow-lg, surface-elevated bg — popover-family
  variants: {
    variant: {
      quiet: {
        base: ['bg-surface-quiet']
      },
      outlined: {
        base: ['bg-transparent border border-border-default']
      },
      elevated: {
        // The `hover:shadow-lg` lift is gated on `interactive: true` via the
        // compoundVariant below — a non-interactive elevated card should not
        // animate on hover (would falsely signal interactivity, WCAG 3.2).
        base: ['bg-surface-elevated', 'shadow-[var(--blocks-shadow-md)]']
      },
      floating: {
        base: ['bg-surface-elevated shadow-[var(--blocks-shadow-lg)]']
      }
    },
    padding: {
      none: {
        base: 'p-0',
        header: 'p-0',
        content: 'p-0',
        footer: 'p-0'
      },
      sm: {
        base: 'p-4',
        header: 'pb-2',
        content: 'py-2',
        footer: 'pt-2'
      },
      md: {
        base: 'p-6',
        header: 'pb-3',
        content: 'py-3',
        footer: 'pt-3'
      },
      lg: {
        base: 'p-8',
        header: 'pb-4',
        content: 'py-4',
        footer: 'pt-4'
      },
      xl: {
        base: 'p-10',
        header: 'pb-5',
        content: 'py-5',
        footer: 'pt-5'
      }
    },
    // Opt-in slot separators. Default `false`: header/footer
    // sit flush against the body, the slots are separated by spacing
    // only. Set `dividers={true}` for traditional card-with-header look.
    // Uses `border-hairline` — leiser als border-subtle.
    dividers: {
      true: {
        header: 'border-b border-border-hairline',
        footer: 'border-t border-border-hairline'
      }
    },
    // `interactive` is gated on a real click-source — `clickable`,
    // `onclick`, or `href`. The Card component derives it from those
    // props; consumers never set it directly. Setting it without a
    // click source would render the card as a non-button div with
    // `cursor-pointer` and a hover-translate, which falsely signals
    // interactivity (WCAG 3.2 Predictable).
    interactive: {
      true: {
        base: 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
      }
    },
    elementType: {
      button: {
        // `[font:inherit]` (arbitrary property), NOT `font-inherit`: Tailwind
        // v4 has no `font-inherit` utility (no `--font-inherit` theme key), so
        // that class emitted no rule and a clickable Card kept the UA button
        // font instead of inheriting the surrounding type. Same utility gap as
        // Button's `[gap:inherit]` (Codeberg #21); found ground-truthing the
        // variants-lint theme-existence guard (`font-` itself stays unguarded —
        // family keys are legitimately consumer-supplied).
        base: 'border-none [font:inherit] text-left cursor-pointer'
      },
      a: {
        base: 'no-underline text-inherit'
      },
      div: {}
    },
    disabled: {
      true: {
        base: 'opacity-50 cursor-not-allowed pointer-events-none'
      }
    }
  },
  compoundVariants: [
    {
      interactive: true,
      elementType: ['button', 'a'],
      class: {
        base: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
      }
    },
    {
      interactive: true,
      variant: 'quiet',
      class: { base: 'hover:bg-surface-hover' }
    },
    {
      interactive: true,
      variant: 'outlined',
      class: { base: 'hover:shadow-[var(--blocks-shadow-sm)]' }
    },
    {
      interactive: true,
      variant: 'elevated',
      class: { base: 'hover:shadow-[var(--blocks-shadow-lg)]' }
    },
    {
      interactive: true,
      variant: 'floating',
      class: { base: 'hover:bg-surface-hover' }
    }
  ],
  defaultVariants: {
    variant: 'quiet',
    padding: 'md',
    dividers: false,
    interactive: false,
    elementType: 'div',
    disabled: false
  }
});

export type CardVariants = VariantProps<typeof cardVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type CardSlots = SlotNames<typeof cardVariants>;
