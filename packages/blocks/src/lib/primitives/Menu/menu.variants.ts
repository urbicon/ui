import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const menuVariants = tv({
  slots: {
    base: ['relative inline-block'],
    trigger: ['w-full justify-between gap-3 min-w-36'],
    triggerText: ['flex flex-1 items-center text-left truncate'],
    chevron: [
      'w-4 h-4 shrink-0 opacity-70 transition-[opacity,transform] duration-[var(--blocks-duration-fast)] ease-out'
    ],
    // Floating panel surface. Position is owned by the wrapping Popover
    // (Floating UI sets `top` / `left` on its container); this slot just
    // paints the surface and lays out the items inside it. The corner
    // radius AND border colour are driven by the `tier` axis below so the
    // panel harmonises with the trigger — a pill (commit) trigger gets a
    // softly-rounded panel with the trigger's heavier neutral border, a
    // modify trigger stays on the subtler container border.
    content: [
      'box-border border shadow-[var(--blocks-shadow-md)] p-1',
      // 20rem (max-h-80) is the static design cap; the wrapping Popover's
      // useFloatingPanel sets `--blocks-overlay-available-height` on the panel,
      // which cascades to this content surface so the menu shrinks above the
      // iOS keyboard and recovers when it closes. Falls back to the design cap
      // when the var is unset (SSR / no JS).
      'max-h-[min(20rem,var(--blocks-overlay-available-height,100dvh))] overflow-y-auto',
      'bg-surface-elevated'
    ],
    header: ['sticky top-0 z-10 bg-surface-elevated', 'px-2 py-1 border-b border-border-hairline'],
    section: ['px-3 py-1.5 text-xs font-medium text-text-tertiary'],
    divider: ['my-1 h-px bg-border-hairline'],
    // No extra `py` — the `content` slot's `p-1` is the single edge inset
    // (symmetric 4px, same rhythm as the Select/Combobox listboxes, XC-9).
    items: ['space-y-0.5'],
    // tier: modify — menu items are momentary affordances inside the contain panel.
    item: [
      'flex w-full items-center gap-2 rounded-modify text-left',
      'text-text-primary hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50',
      'cursor-pointer select-none'
    ],
    // No `mr-*` — the item's `gap-2` owns the icon↔label distance (8px, the
    // same gap every listbox row in the library uses).
    indicator: ['inline-flex items-center self-center'],
    submenu: ['ml-4 mt-2 border-l border-border-hairline pl-2'],
    footer: [
      'sticky bottom-0 z-10 bg-surface-elevated',
      'px-2 py-2 border-t border-border-hairline'
    ]
  },
  variants: {
    open: {
      true: {
        base: 'blocks-menu--open'
      }
    },
    // Control menu content width behavior
    syncWidth: {
      true: {
        content: 'min-w-0'
      },
      false: {
        content: 'min-w-48'
      }
    },
    // Size for menu items. Typo tracks the Button ladder (text-sm/base/lg —
    // Action-family items read like the Button that opened them); py/min-h
    // sit on the shared listbox baseline (2 / 2.5 / 3 rem, XC-9). The section
    // header always shares the item's horizontal inset (px-3 lives on the
    // `section` slot base for md).
    itemSize: {
      sm: { item: 'px-2 py-1.5 text-sm min-h-[2rem]', section: 'px-2' },
      md: { item: 'px-3 py-2 text-base min-h-[2.5rem]' },
      lg: { item: 'px-4 py-2.5 text-lg min-h-[3rem]', section: 'px-4' }
    },
    disabled: {
      true: {
        item: 'opacity-50 cursor-not-allowed pointer-events-none'
      }
    },
    // Placement is the Popover's job (Floating UI). Kept on the variant axis
    // so consumers can still pass it for type-checking, but with no class
    // overrides — the inner content sits inside the already-positioned
    // Popover container and does not need its own corner anchoring.
    placement: {
      'bottom-start': {},
      bottom: {},
      'bottom-end': {},
      'top-start': {},
      top: {},
      'top-end': {}
    },
    chevronAnimation: {
      rotate: {
        chevron: 'rotate-0'
      },
      translate: {
        chevron: 'translate-y-0'
      },
      fade: {
        chevron: 'opacity-70'
      },
      none: {}
    },
    usePortal: {
      true: {
        content: ''
      },
      false: {}
    },
    // Couple the floating panel's corner radius AND border colour to the
    // trigger's tier so the two surfaces visually belong together. The
    // Menu trigger is a Button, which lives in the Action family and
    // therefore only ranges over `commit | modify` (= InteractiveTier) —
    // `contain` is the Container-family tier and is intentionally not
    // exposed here. A pill (commit) trigger gets the bridge radius
    // (`r-bridge`, ~6 px) so the panel reads as belonging to the pill
    // without becoming a giant pill itself; using `rounded-commit` would
    // yield a 9999 px pill panel, using `rounded-contain` would yield a
    // near-flat 2 px panel beneath the pill. The Action-family border
    // (`border-neutral`) mirrors the outlined-neutral Button it sits
    // under (Linear-style cohesion). A modify trigger mirrors its tier
    // directly and keeps the subtle container border because the trigger
    // there is already a low-key surface.
    tier: {
      commit: { content: 'rounded-bridge border-neutral' },
      modify: { content: 'rounded-modify border-border-hairline' }
    }
  },
  compoundVariants: [
    // Chevron animations when open
    {
      open: true,
      chevronAnimation: 'rotate',
      class: {
        chevron: 'rotate-180'
      }
    },
    {
      open: true,
      chevronAnimation: 'translate',
      class: {
        chevron: 'translate-y-1'
      }
    },
    {
      open: true,
      chevronAnimation: 'fade',
      class: {
        chevron: 'opacity-30'
      }
    }
  ],
  defaultVariants: {
    open: false,
    itemSize: 'md',
    syncWidth: true,
    placement: 'bottom-start',
    chevronAnimation: 'rotate',
    usePortal: true,
    tier: 'commit'
  }
});

export const menuIconVariants = tv({
  base: ['h-4 w-4 shrink-0 transition-colors duration-[var(--blocks-duration-fast)]'],
  variants: {
    type: {
      chevron: 'opacity-70',
      checkmark: 'text-primary'
    }
  },
  defaultVariants: {
    type: 'chevron'
  }
});

export type MenuVariants = VariantProps<typeof menuVariants>;
export type MenuIconVariants = VariantProps<typeof menuIconVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type MenuSlots = SlotNames<typeof menuVariants>;
