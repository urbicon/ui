import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const avatarVariants = tv({
  slots: {
    // Outer positioning context. Carries sizing, the ring, interactive/mint
    // effects — but NOT `overflow-hidden`, so the status dot (a sibling of
    // `frame`) is never clipped (AVT-1). The radius is mirrored here purely so
    // the ring follows the avatar's shape.
    base: [
      'relative inline-flex shrink-0',
      // `scale` is listed because the `interactive` axis adds
      // `hover:scale-105 active:scale-95` — Tailwind 4 emits those as the
      // discrete `scale:` property, which nothing else in this list covers.
      'transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-[var(--blocks-duration-fast)] ease-out'
    ],
    // The visible disc. This is the element that clips the image/initials to
    // the avatar shape; the status dot lives outside it so it stays whole.
    frame: [
      'flex items-center justify-center w-full h-full overflow-hidden',
      'font-semibold text-center select-none',
      'bg-surface-interactive text-text-secondary'
    ],
    image: ['w-full h-full object-cover'],
    fallback: ['flex items-center justify-center w-full h-full', 'font-semibold uppercase'],
    status: ['absolute rounded-full z-10', 'border-2 border-surface-base']
  },
  variants: {
    size: {
      xs: {
        base: 'w-6 h-6 text-xs',
        status: 'w-2 h-2 border'
      },
      sm: {
        base: 'w-8 h-8 text-xs',
        status: 'w-2.5 h-2.5 border'
      },
      md: {
        base: 'w-10 h-10 text-sm',
        status: 'w-3 h-3 border-2'
      },
      lg: {
        base: 'w-12 h-12 text-base',
        status: 'w-3.5 h-3.5 border-2'
      },
      xl: {
        base: 'w-16 h-16 text-lg',
        status: 'w-4 h-4 border-2'
      },
      '2xl': {
        base: 'w-20 h-20 text-xl',
        status: 'w-4 h-4 border-2'
      }
    },
    // Avatar shape is an identity axis, not a layout-tier. Avatars represent
    // people and stand apart from the commit/modify/contain semantic system —
    // a brand that flattens commit-tier surfaces (e.g. squared pill-buttons)
    // should not also lose circular avatars. The radii below are physical
    // shape tokens, not tier tokens. `frame` clips the content to the shape;
    // `base` mirrors it so the ring tracks the same silhouette.
    variant: {
      circle: {
        base: 'rounded-full',
        frame: 'rounded-full',
        image: 'rounded-full'
      },
      rounded: {
        // Avatar-specific soft-square. Maps to --radius-xl (foundation scale);
        // brands tune via the foundation token, not via a tier override.
        base: 'rounded-xl',
        frame: 'rounded-xl',
        image: 'rounded-xl'
      },
      square: {
        base: 'rounded-none',
        frame: 'rounded-none',
        image: 'rounded-none'
      }
    },
    intent: {
      primary: {
        frame: 'bg-primary-subtle text-primary-emphasis'
      },
      secondary: {
        frame: 'bg-secondary-subtle text-secondary-emphasis'
      },
      success: {
        frame: 'bg-success-subtle text-success-emphasis'
      },
      warning: {
        frame: 'bg-warning-subtle text-warning-emphasis'
      },
      danger: {
        frame: 'bg-danger-subtle text-danger-emphasis'
      },
      neutral: {
        frame: 'bg-surface-interactive text-text-secondary'
      }
    },
    // Each status also publishes its colour as `--blocks-avatar-pulse-color`
    // so the opt-in `pulse` ring (see Avatar.svelte) radiates in the matching
    // hue without a second colour source.
    status: {
      online: {
        status: 'bg-success [--blocks-avatar-pulse-color:var(--color-success)]'
      },
      offline: {
        status: 'bg-text-quaternary [--blocks-avatar-pulse-color:var(--color-text-quaternary)]'
      },
      away: {
        status: 'bg-warning [--blocks-avatar-pulse-color:var(--color-warning)]'
      },
      busy: {
        status: 'bg-danger [--blocks-avatar-pulse-color:var(--color-danger)]'
      }
    },
    // Status dot is translated out of the avatar's edge so it half-overlaps the
    // corner (AVT-1). Translation magnitude is intentionally fractional — the
    // dot sits half-overlapping the edge, which matches the conventional badge
    // look (Slack, Discord, Linear).
    statusPosition: {
      'bottom-right': {
        status: 'bottom-0 right-0 translate-x-1/4 translate-y-1/4'
      },
      'top-right': {
        status: 'top-0 right-0 translate-x-1/4 -translate-y-1/4'
      },
      'bottom-left': {
        status: 'bottom-0 left-0 -translate-x-1/4 translate-y-1/4'
      },
      'top-left': {
        status: 'top-0 left-0 -translate-x-1/4 -translate-y-1/4'
      }
    },
    // Opt-in "live" pulse on the status dot — a radar ring that draws the eye to
    // presence changes. Only has a visible effect together with `status`; the
    // animation itself + reduced-motion handling live in Avatar.svelte.
    pulse: {
      true: {
        status: 'blocks-avatar-status-pulse'
      }
    },
    ring: {
      true: {
        base: 'ring-2 ring-offset-2 ring-offset-surface-base'
      }
    },
    ringIntent: {
      primary: {
        base: 'ring-primary'
      },
      secondary: {
        base: 'ring-secondary'
      },
      success: {
        base: 'ring-success'
      },
      warning: {
        base: 'ring-warning'
      },
      danger: {
        base: 'ring-danger'
      },
      neutral: {
        base: 'ring-border-default'
      }
    },
    interactive: {
      true: {
        base: [
          'cursor-pointer',
          'hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-primary focus-visible:ring-offset-2'
        ]
      }
    }
  },
  compoundVariants: [
    {
      ring: true,
      ringIntent: 'primary',
      class: { base: 'ring-primary' }
    },
    {
      ring: true,
      ringIntent: 'secondary',
      class: { base: 'ring-secondary' }
    },
    {
      ring: true,
      ringIntent: 'success',
      class: { base: 'ring-success' }
    },
    {
      ring: true,
      ringIntent: 'warning',
      class: { base: 'ring-warning' }
    },
    {
      ring: true,
      ringIntent: 'danger',
      class: { base: 'ring-danger' }
    },
    {
      ring: true,
      ringIntent: 'neutral',
      class: { base: 'ring-border-default' }
    }
  ],
  defaultVariants: {
    size: 'md',
    variant: 'circle',
    intent: 'neutral',
    statusPosition: 'bottom-right',
    pulse: false,
    ring: false,
    ringIntent: 'primary',
    interactive: false
  }
});

export type AvatarVariants = VariantProps<typeof avatarVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type AvatarSlots = SlotNames<typeof avatarVariants>;
