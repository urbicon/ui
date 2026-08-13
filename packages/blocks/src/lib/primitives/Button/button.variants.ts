import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const buttonVariants = tv({
  slots: {
    base: [
      'relative inline-flex items-center justify-center gap-2',
      'font-medium text-center whitespace-nowrap border cursor-pointer select-none',
      // `scale`, NOT `transform`: Tailwind 4 emits `scale-*` as the discrete
      // CSS `scale:` property, so a list naming only `transform` never animates
      // the press cue (`active:scale-[0.98]` / `pressed`) — it would jump.
      'transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-[var(--blocks-duration-fast)] ease-out overflow-hidden',
      // Resting + hover + press depth. Identical for all six intents, so it
      // lives here rather than six times over on the `intent` axis, which now
      // carries only what actually differs per intent (the focus ring). The flat
      // variants (ghost/text) drop the resting step again via their own
      // `shadow-none` — declared after this slot, so they win that bucket
      // exactly as they did before; the `active:` steps sit in a different
      // bucket and survive, which is what keeps a ghost button's press legible.
      'shadow-[var(--blocks-shadow-sm)]',
      'hover:shadow-[var(--blocks-shadow-md)]',
      // The press depth step. It has to DIFFER from whatever the button rests
      // at, and the resting value is not one thing: `base` sets `sm`, the flat
      // variants and a connected group drop it to `none`. So the step is `sm`
      // here — a real change for everything resting at `none` — and the one
      // combination that rests at `sm` without a colour change of its own
      // overrides it below (see the `outlined` compounds).
      //
      // Measured, because the obvious "press = one step down everywhere" is
      // wrong: moving this to `xs` weakened the cue on every flat surface
      // instead (light ghost peaked at 22/255 differing pixels on `sm`, 8/255 on
      // `xs`; dark ghost 7/255 → 4/255, which is not a visible press). Those
      // variants rest at `none`, so their press makes a shadow appear rather
      // than recede, and a smaller one says less.
      'active:shadow-[var(--blocks-shadow-sm)]',
      // The press sink: the button dips while the pointer holds it. Reads
      // `--blocks-press-scale`, which is 0.98 by default, 1 under
      // `prefers-reduced-motion` (interaction.css), and 1 on a button whose
      // `mint` is off — Button.svelte sets it locally for that case, which is
      // every button inside a ButtonGroup unless the group asks for a mint (#192).
      // Steering it through the token rather than a variant axis is what keeps
      // the switch OUT of the public prop surface: a `pressCue` axis would be
      // promoted to a documented `<Button pressCue>` prop by docs-gen and land
      // in restProps as a stray DOM attribute, without doing anything.
      'active:scale-[var(--blocks-press-scale)]',
      // Radius is driven by the `tier` variant axis below — see `tier`.
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
    ],
    content: [
      // `[gap:inherit]` (arbitrary property), NOT `gap-inherit`: Tailwind v4 has
      // no `gap-inherit` utility — the spacing-based `gap-*` scale has no
      // `inherit` member (unlike `text-inherit`/`border-inherit`), so that class
      // emits no rule and the icon↔label gap silently collapses to 0. The
      // arbitrary property makes `content` inherit `base`'s per-size gap as
      // intended. (Codeberg #21)
      'flex items-center [gap:inherit] transition-opacity duration-[var(--blocks-duration-fast)]'
    ],
    spinner: [
      'flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-[var(--blocks-duration-fast)]'
    ]
  },
  variants: {
    // 3-tier semantic radius. Default `commit` (pill) — Button is a commit
    // surface. Opt-in `modify` (soft) is for tight contexts like icon-only
    // toolbars, where pill-shaped ghost buttons read as tags. Usually
    // inherited from a wrapping <Toolbar> / <ButtonGroup> via TierContext.
    tier: {
      commit: { base: 'rounded-commit' },
      modify: { base: 'rounded-modify' }
    },
    // Only the focus ring differs per intent — the depth cues it used to repeat
    // six times over (resting, hover and held) now sit once in `base`.
    intent: {
      primary: { base: 'focus-visible:ring-primary/50' },
      secondary: { base: 'focus-visible:ring-secondary/50' },
      success: { base: 'focus-visible:ring-success/50' },
      warning: { base: 'focus-visible:ring-warning/50' },
      danger: { base: 'focus-visible:ring-danger/50' },
      neutral: { base: 'focus-visible:ring-neutral/50' }
    },
    // Declared BEFORE `variant` so the flat variants (ghost/text
    // `shadow-none`) win the shadow bucket over the pressed depth cue —
    // a pressed ghost button stays flat. For filled/outlined (no shadow of
    // their own) the pressed `shadow-xs` still applies. (Measured on the config
    // as it stood in a8632fc2: moving this axis after `variant` changed 3456 of
    // 27648 combinations, while the same move on an `active:`-prefixed rule
    // changed none — a modifier puts the class in its own merge bucket. The
    // absolute counts track the axis list; the asymmetry is the point.)
    //
    // Unlike the `active:` press cue in `base` this is a MODELLED state, not
    // click feedback: the consumer says the control is down (a toolbar toggle),
    // so `mint="none"` does not clear it. It shares the press token so reduced
    // motion takes the size change out of both, leaving brightness + shadow to
    // carry the state.
    pressed: {
      true: {
        base: 'scale-[var(--blocks-press-scale)] brightness-90 shadow-[var(--blocks-shadow-xs)]'
      }
    },
    variant: {
      // The border on a filled button carries no colour of its own, and that
      // is the point. `base` sets `border` only so filled and outlined share a
      // box geometry; painting it `border-<intent>` made it a SECOND copy of
      // the fill colour, and the interaction ladder below moves only one of the
      // two (`hover:bg-<intent>-hover`, `active:bg-<intent>-active`). The
      // result was a ring in the resting tone around a darkened fill — a light
      // halo on light pages, and inverted in dark mode, where the fill lightens
      // (500 → 400 → 300) while the border stayed at 500.
      //
      // `transparent` makes that disagreement unrepresentable rather than
      // gating it: the background paints under the border (`background-clip`
      // is `border-box`), so nothing about the resting button moves, and there
      // is no second value left to fall behind.
      //
      // Measured against the old rendering (Chromium, 2× DPR, md/commit, the
      // primary ramp): at rest 312 of 21120 px differ, ALL of them on the
      // pill's rounded ends — an antialiasing seam where the edge is now
      // clipped background rather than painted border. At hover the difference
      // is 1505 px with only half of it on the ends, i.e. a ring running the
      // full outline: that is the halo, and removing it is the point. The
      // seam does not scale down with DPR — at 1× the corner pixels differ by
      // up to 109/255 — but it stays on the curve, so it reads as the same
      // edge drawn slightly differently, not as a change of state.
      //
      // What this does NOT buy: forced-colors mode. Both forms come out
      // identical there (`rgb(0,0,0)` on the same 1px, measured with
      // `forcedColors: 'active'`) — the browser overrides a named border
      // colour and a transparent one alike. Only a surface with NO border at
      // all gains anything from `border-transparent`, and this one always had
      // one.
      //
      // The one place a filled button still paints its border is the connected
      // ButtonGroup divider at the end of this list — that one is a boundary
      // between two buttons, not a copy of one button's fill.
      filled: { base: 'border-transparent' },
      outlined: {
        base: ['bg-transparent border-1']
      },
      ghost: {
        base: ['bg-transparent border-transparent shadow-none']
      },
      text: {
        // No `px-*` here: the size axis (declared later) always supplies the
        // horizontal padding, so a variant-level `px-2` could never win —
        // it was dead weight under the old CSS-order tie-break too.
        base: ['bg-transparent border-none shadow-none', 'hover:bg-transparent hover:underline']
      }
    },
    size: {
      '2xs': {
        base: 'h-4 px-2 text-xs gap-1'
      },
      xs: {
        base: 'h-6 px-2 text-xs gap-1'
      },
      sm: {
        base: 'h-8 px-3 text-sm gap-1.5'
      },
      md: {
        base: 'h-10 px-4 text-base gap-2'
      },
      lg: {
        base: 'h-12 px-6 text-lg gap-2.5'
      },
      xl: {
        base: 'h-14 px-8 text-xl gap-3'
      }
    },
    loading: {
      true: {
        base: 'cursor-wait'
      },
      false: {
        spinner: 'hidden'
      }
    },
    loadingPlacement: {
      overlay: {},
      start: {},
      end: {}
    },
    active: {
      true: {},
      false: {}
    },
    buttonGroupConnected: {
      true: {
        base: 'rounded-none shadow-none focus-visible:z-10'
      }
    }
  },
  compoundVariants: [
    // The one hole in the press feedback, and its patch (#192).
    //
    // Every variant reports a press somehow: `filled` darkens its fill
    // (`active:bg-<intent>-active`, below), and the flat ones plus every child
    // of a connected group rest at `shadow-none`, so the `active:shadow-sm` in
    // `base` is a real step for them. `outlined` is the exception — it rests at
    // `sm` like `filled` but has no fill to darken, so that step lands on its
    // own resting value and says nothing. With `mint="none"` taking the sink
    // away too (every ButtonGroup child, and `outlined` is the group default), a
    // standalone outlined button reported a click with NOTHING on any path that
    // never passes through hover: touch, and keyboard activation.
    //
    // Stepping it down to `xs` is right precisely because it rests high. The
    // second compound puts it back for a connected group, where
    // `buttonGroupConnected` has already flattened the resting value to `none`
    // and `xs` would be the weaker of the two available directions.
    {
      variant: 'outlined',
      class: { base: 'active:shadow-[var(--blocks-shadow-xs)]' }
    },
    {
      variant: 'outlined',
      buttonGroupConnected: true,
      class: { base: 'active:shadow-[var(--blocks-shadow-sm)]' }
    },
    // Filled Variants per intent
    {
      intent: 'primary',
      variant: 'filled',
      class: {
        base: 'bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-active'
      }
    },
    {
      intent: 'secondary',
      variant: 'filled',
      class: {
        base: 'bg-secondary text-text-on-fill hover:bg-secondary-hover active:bg-secondary-active'
      }
    },
    {
      intent: 'success',
      variant: 'filled',
      class: {
        base: 'bg-success text-text-on-fill hover:bg-success-hover active:bg-success-active'
      }
    },
    {
      intent: 'warning',
      variant: 'filled',
      class: {
        base: 'bg-warning text-text-on-warning hover:bg-warning-hover active:bg-warning-active'
      }
    },
    {
      intent: 'danger',
      variant: 'filled',
      class: {
        base: 'bg-danger text-text-on-fill hover:bg-danger-hover active:bg-danger-active'
      }
    },
    {
      intent: 'neutral',
      variant: 'filled',
      class: {
        base: 'bg-neutral text-text-on-fill hover:bg-neutral-hover active:bg-neutral-active'
      }
    },
    // Loading placement behaviors
    {
      loading: true,
      loadingPlacement: 'overlay',
      class: {
        content: 'opacity-0',
        spinner: 'opacity-100 absolute inset-0 z-10'
      }
    },
    {
      loading: true,
      loadingPlacement: 'start',
      class: {
        base: 'gap-2',
        spinner: 'opacity-100 mr-2 order-first'
      }
    },
    {
      loading: true,
      loadingPlacement: 'end',
      class: {
        base: 'gap-2',
        spinner: 'opacity-100 ml-2 order-last'
      }
    },
    // Outlined variants for each intent
    {
      intent: 'primary',
      variant: 'outlined',
      class: {
        base: 'text-primary-emphasis border-primary hover:bg-primary-subtle'
      }
    },
    {
      intent: 'secondary',
      variant: 'outlined',
      class: {
        base: 'text-secondary-emphasis border-secondary hover:bg-secondary-subtle'
      }
    },
    {
      intent: 'success',
      variant: 'outlined',
      class: {
        base: 'text-success-emphasis border-success hover:bg-success-subtle'
      }
    },
    {
      intent: 'warning',
      variant: 'outlined',
      class: {
        base: 'text-warning-emphasis border-warning hover:bg-warning-subtle'
      }
    },
    {
      intent: 'danger',
      variant: 'outlined',
      class: {
        base: 'text-danger-emphasis border-danger hover:bg-danger-subtle'
      }
    },
    {
      intent: 'neutral',
      variant: 'outlined',
      class: {
        base: 'text-neutral-emphasis border-neutral hover:bg-neutral-subtle'
      }
    },
    // Ghost Variants
    {
      intent: 'primary',
      variant: 'ghost',
      class: {
        base: 'text-primary-emphasis hover:bg-primary-subtle'
      }
    },
    {
      intent: 'secondary',
      variant: 'ghost',
      class: {
        base: 'text-secondary-emphasis hover:bg-secondary-subtle'
      }
    },
    {
      intent: 'success',
      variant: 'ghost',
      class: {
        base: 'text-success-emphasis hover:bg-success-subtle'
      }
    },
    {
      intent: 'warning',
      variant: 'ghost',
      class: {
        base: 'text-warning-emphasis hover:bg-warning-subtle'
      }
    },
    {
      intent: 'danger',
      variant: 'ghost',
      class: {
        base: 'text-danger-emphasis hover:bg-danger-subtle'
      }
    },
    {
      intent: 'neutral',
      variant: 'ghost',
      class: {
        base: 'text-neutral-emphasis hover:bg-neutral-subtle'
      }
    },
    // Text Variants
    {
      intent: 'primary',
      variant: 'text',
      class: {
        base: 'text-primary-text'
      }
    },
    {
      intent: 'secondary',
      variant: 'text',
      class: {
        base: 'text-secondary-text'
      }
    },
    {
      intent: 'success',
      variant: 'text',
      class: {
        base: 'text-success-text'
      }
    },
    {
      intent: 'warning',
      variant: 'text',
      class: {
        base: 'text-warning-emphasis'
      }
    },
    {
      intent: 'danger',
      variant: 'text',
      class: {
        base: 'text-danger-text'
      }
    },
    {
      intent: 'neutral',
      variant: 'text',
      class: {
        base: 'text-neutral'
      }
    },
    // Active + Outlined: promote to filled appearance, hover matches filled hover
    //
    // The border moves WITH the fill here (`hover:border-<intent>-hover`)
    // rather than going transparent as it does on `filled`: on an outlined
    // button the border is the variant, and in a connected ButtonGroup —
    // whose default variant is `outlined` — it is also the divider between
    // this button and its neighbours. Dropping it on the active member would
    // punch a hole in that seam. Pinning the hover bucket is what makes the
    // step land at all: a modifier prefix is its own conflict bucket, so the
    // plain `border-<intent>` never folds it (same reason the error compounds
    // in checkbox.variants.ts pin `group-hover:border-danger`).
    {
      active: true,
      variant: 'outlined',
      intent: 'primary',
      class: {
        base: 'bg-primary text-text-on-primary border-primary hover:bg-primary-hover hover:border-primary-hover'
      }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'secondary',
      class: {
        base: 'bg-secondary text-text-on-fill border-secondary hover:bg-secondary-hover hover:border-secondary-hover'
      }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'success',
      class: {
        base: 'bg-success text-text-on-fill border-success hover:bg-success-hover hover:border-success-hover'
      }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'warning',
      class: {
        base: 'bg-warning text-text-on-warning border-warning hover:bg-warning-hover hover:border-warning-hover'
      }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'danger',
      class: {
        base: 'bg-danger text-text-on-fill border-danger hover:bg-danger-hover hover:border-danger-hover'
      }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'neutral',
      class: {
        base: 'bg-neutral text-text-on-fill border-neutral hover:bg-neutral-hover hover:border-neutral-hover'
      }
    },
    // Active + Ghost: subtle intent background + ring outline + bolder text;
    // the subtle-tone alone is too close to surface-base on light pages —
    // the ring is what makes the active state visible (BGR-2).
    {
      active: true,
      variant: 'ghost',
      intent: 'primary',
      class: {
        base: 'bg-primary-subtle text-primary-emphasis font-semibold ring-1 ring-inset ring-primary/30 hover:bg-primary-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'secondary',
      class: {
        base: 'bg-secondary-subtle text-secondary-emphasis font-semibold ring-1 ring-inset ring-secondary/30 hover:bg-secondary-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'success',
      class: {
        base: 'bg-success-subtle text-success-emphasis font-semibold ring-1 ring-inset ring-success/30 hover:bg-success-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'warning',
      class: {
        base: 'bg-warning-subtle text-warning-emphasis font-semibold ring-1 ring-inset ring-warning/30 hover:bg-warning-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'danger',
      class: {
        base: 'bg-danger-subtle text-danger-emphasis font-semibold ring-1 ring-inset ring-danger/30 hover:bg-danger-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'neutral',
      class: {
        base: 'bg-neutral-subtle text-neutral-emphasis font-semibold ring-1 ring-inset ring-neutral/40 hover:bg-neutral-subtle'
      }
    },
    // Active + Filled: deeper shade, stabilize hover. No `border-*-active`
    // here — it only ever restated the fill, and the variant axis now keeps
    // the border transparent for every filled button (see `variant.filled`).
    {
      active: true,
      variant: 'filled',
      intent: 'primary',
      class: { base: 'bg-primary-active hover:bg-primary-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'secondary',
      class: { base: 'bg-secondary-active hover:bg-secondary-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'success',
      class: { base: 'bg-success-active hover:bg-success-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'warning',
      class: { base: 'bg-warning-active hover:bg-warning-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'danger',
      class: { base: 'bg-danger-active hover:bg-danger-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'neutral',
      class: { base: 'bg-neutral-active hover:bg-neutral-active' }
    },
    // Active + Text: permanent underline, distinct from ghost active (no background)
    {
      active: true,
      variant: 'text',
      intent: 'primary',
      class: { base: 'text-primary-text font-semibold underline underline-offset-4 decoration-2' }
    },
    {
      active: true,
      variant: 'text',
      intent: 'secondary',
      class: { base: 'text-secondary-text font-semibold underline underline-offset-4 decoration-2' }
    },
    {
      active: true,
      variant: 'text',
      intent: 'success',
      class: { base: 'text-success-text font-semibold underline underline-offset-4 decoration-2' }
    },
    {
      active: true,
      variant: 'text',
      intent: 'warning',
      class: {
        base: 'text-warning-emphasis font-semibold underline underline-offset-4 decoration-2'
      }
    },
    {
      active: true,
      variant: 'text',
      intent: 'danger',
      class: { base: 'text-danger-text font-semibold underline underline-offset-4 decoration-2' }
    },
    {
      active: true,
      variant: 'text',
      intent: 'neutral',
      class: { base: 'text-neutral font-semibold underline underline-offset-4 decoration-2' }
    },
    // ButtonGroupConnected + Filled: darker per-intent border so the
    // `-ml-px`/`-mt-px` overlap renders a visible divider between
    // adjacent filled buttons (BGR-1). Since `variant.filled` went
    // `border-transparent`, this is the ONLY filled border that paints —
    // which is the right shape for it: it separates two buttons instead of
    // tracing one, so it cannot fall behind the fill the way the resting-stop
    // border did.
    //
    // It is not fully immune in the other direction, though, and that is
    // pre-existing: the divider sits on `-active`, which is exactly where
    // `active:bg-<intent>-active` takes the fill, so while a member is held
    // down its own seam disappears into its fill. The neighbour's border
    // still draws the edge (the two overlap by the `-ml-px`), so the group
    // does not come apart — but nobody should read this compound as a border
    // that never meets its fill.
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'primary',
      class: { base: 'border-primary-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'secondary',
      class: { base: 'border-secondary-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'success',
      class: { base: 'border-success-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'warning',
      class: { base: 'border-warning-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'danger',
      class: { base: 'border-danger-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'neutral',
      class: { base: 'border-neutral-active' }
    }
  ],
  defaultVariants: {
    tier: 'commit',
    intent: 'neutral',
    variant: 'filled',
    size: 'md',
    loading: false,
    pressed: false,
    active: false,
    loadingPlacement: 'start'
  }
});

export type ButtonVariants = VariantProps<typeof buttonVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type ButtonSlots = SlotNames<typeof buttonVariants>;
