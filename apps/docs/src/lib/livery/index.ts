import type { ComponentDefaults } from '@urbicon-ui/blocks';

/**
 * A livery is one house's visual identity, in three layers:
 *
 * 1. **Design tokens** (`liveries.css`, keyed by `data-livery`) — colour ramps,
 *    radius tiers, type, ground texture. Names no component, reaches every one
 *    of them, including the ones an agent conjured a second ago.
 * 2. **Provider defaults** (below) — the exceptions tokens cannot express: a
 *    border idiom, a type jump, a shape a token tier bundles with something
 *    else. Still project configuration, still zero call sites touched.
 * 3. **Layout** (`layout`, consumed by the page) — where things sit. Not a
 *    token and not pretending to be one: a scattered edge grid and a single
 *    horizon line are different page structures, not different values.
 *
 * Layer 3 is the honest boundary of this demo. Layers 1 and 2 reach the
 * agent-generated surface automatically; layer 3 does not, because the agent
 * decides its own composition (Column, Row, Section). A house whose identity
 * lives mostly in its grid will theme the chrome perfectly and the generated
 * form only as far as colour and type carry it.
 *
 * Since the move to the hotel universe (2026-08-10) a livery IS a house of the
 * Fermata group — the sub-brands of `$lib/hotel-tools`, which is the real
 * shape of this pattern in the wild: one booking platform, three identities.
 * The ids here must therefore match `HOUSES[].id`; the full page joins the two
 * registries by that key, and a livery without house data would be a switch
 * position that renders an empty page. (A fourth livery, Mori — cedar dusk,
 * `pillar` layout — was cut with its house on 2026-08-10.)
 */
export interface Livery {
  id: string;
  name: string;
  layout: LiveryLayout;
  /** Component-level styling the token layer cannot reach. */
  defaults: Record<string, ComponentDefaults>;
}

/**
 * Page structure, not decoration.
 *
 * - `courtyard` — a symmetric centred column; every section head sits under a
 *   whitewashed arch.
 * - `scatter`   — no centre: items pinned across a wide grid, big voids.
 * - `horizon`   — everything sits on one full-bleed line, the wordmark resting
 *   on it like the sun on the dune crest.
 */
export type LiveryLayout = 'courtyard' | 'scatter' | 'horizon';

/**
 * Nothing to do here any more — kept as a note because the absence is the point.
 *
 * Until 2026-07-31 every livery carried a `CIRCULAR_RADIOS` provider override,
 * because `--radius-commit` drove BOTH the pill of a commit-tier button and the
 * circle of a radio indicator. A livery that squared its buttons squared its
 * radios with them, and a square radio is a checkbox to the eye — shape is
 * what carries "exactly one of these".
 *
 * ALL houses needed the workaround, including one that only softened the tier
 * to 2px (2px on a 20px control already reads as a square). That is what made
 * it a token problem rather than a livery quirk: any theme touching the tier
 * at all lost the affordance. The controls now have their own tokens
 * (`--radius-control`, `--radius-checkbox` in foundation.css), so Cala and
 * Duna pushing the commit tier to a full pill leaves them alone.
 */

const CALA: Livery = {
  id: 'cala',
  name: 'Cala',
  layout: 'courtyard',
  defaults: {
    // A card is a whitewashed cube: one hairline, no floating. Depth on this
    // page belongs to the blue of the type, not to drop shadows.
    Card: {
      slotClasses: { base: 'border border-border-subtle shadow-none' }
    },
    // `px-6` because this house makes the commit tier a full pill. The library's
    // 16px is measured against its own 6px radius; at radius 999px on a 40px
    // control the first 20px of each end IS the curve, so the same 16px leaves
    // the label sitting in the round (measured 2026-08-13: "Book these nights"
    // came out 152px wide with the text hard against both bows). A pill wants
    // more side room than a rounded rectangle — the theme chose the pill, so the
    // theme pays for it.
    Button: {
      slotClasses: { base: 'px-6 shadow-none hover:shadow-none active:shadow-none' },
      overrides: [{ variant: 'outlined', class: { base: 'border border-primary-600' } }]
    },
    // Boxed inputs: the library's own outlined chrome IS the house box — its
    // border and radius already resolve through Cala's tokens.
    //
    // ANATOMY, measured 2026-08-10 (this corrects a salon-era comment that
    // said the opposite): Input draws its field chrome on `base` — the input
    // element itself — and `container` is a layout wrapper. The salon-era
    // defaults styled the container, which stacked a second frame around
    // every field; the DatePicker made it visible. The clean per-house idiom
    // would be a VARIANT default (`underline` exists), but ComponentDefaults
    // carries only slotClasses/overrides today — noted as a library follow-up.
    Input: {
      slotClasses: { base: 'bg-transparent' }
    },
    Textarea: {
      slotClasses: { base: 'border border-border-default bg-transparent' }
    }
  }
};

const FIRN: Livery = {
  id: 'firn',
  name: 'Firn',
  layout: 'scatter',
  defaults: {
    // ONE VALUE FOR LABEL TRACKING, AND IT IS THE TOKEN.
    //
    // The house states its tracking once, as `--livery-label-tracking`, and
    // `liveries.css` applies it to every `<label>` element. Where a label slot
    // IS that element — Input, Textarea — nothing is needed here: the rule
    // already computes the em against the size set below.
    //
    // Where it is a `<span>` (Checkbox, RadioItem, RadioGroup), the property
    // must be RE-DECLARED, and the reason is the trap this file fell into:
    // `letter-spacing: 0.2em` resolves to an absolute px at the element that
    // declares it, and that px is what inherits. Measured 2026-08-13: the
    // wrapping `<label>` is 16px, so 0.2em becomes 3.2px, and on the 11px
    // `text-2xs` span below that is 0.29em — half again too wide. Re-declaring
    // re-anchors the em to the span's own size.
    //
    // What went, and why: three hand-written numbers (0.18em / 0.2em / 0.24em)
    // for one intent, of which the two on Input/Textarea never even rendered
    // (the rule outranks the utility there — 2px on 10px, measured), plus an
    // `uppercase` that was always redundant, because `text-transform` inherits
    // as a keyword and carries no size dependency.
    //
    // The type jump itself is real and stays: labels drop to the smallest step
    // the scale has while the wordmark spans the full measure, and nothing
    // sits in between anywhere.
    RadioItem: {
      slotClasses: {
        label: 'text-2xs tracking-[var(--livery-label-tracking)]',
        description: 'text-2xs'
      }
    },
    // A RadioGroup's own label is a `<span>` in a `<div>` — it labels a group,
    // not a control, so it is correctly not a `<label>` and sits inside none.
    // Nothing reaches it, by selector or by inheritance, so it is the one slot
    // that also has to name the case.
    RadioGroup: {
      slotClasses: {
        label: 'text-3xs tracking-[var(--livery-label-tracking)] uppercase',
        message: 'text-3xs'
      }
    },
    Input: {
      slotClasses: {
        label: 'text-3xs',
        // Underline = the library box minus three edges, ON `base` (see Cala's
        // anatomy note): focus and error still repaint the remaining edge.
        base: 'text-xs border-x-0 border-t-0 rounded-none bg-transparent'
      }
    },
    Textarea: {
      slotClasses: {
        label: 'text-3xs',
        base: 'text-xs border-x-0 border-t-0 rounded-none bg-transparent'
      }
    },
    Checkbox: {
      slotClasses: { label: 'text-2xs tracking-[var(--livery-label-tracking)]' }
    },
    Card: {
      slotClasses: { base: 'border border-border-subtle shadow-none bg-transparent' }
    },
    Button: {
      slotClasses: {
        base: 'shadow-none hover:shadow-none active:shadow-none text-2xs tracking-[0.12em] uppercase'
      }
    }
  }
};

const DUNA: Livery = {
  id: 'duna',
  name: 'Duna',
  layout: 'horizon',
  defaults: {
    // Everything is glass over the glow: surfaces stay translucent so the
    // light behind them keeps coming through.
    Card: {
      slotClasses: { base: 'border border-border-subtle bg-surface-base/70 shadow-none' }
    },
    // `px-6` for the same reason as Cala: this house is the other one that
    // pushes the commit tier to a full pill.
    Button: {
      slotClasses: { base: 'px-6 shadow-none hover:shadow-none active:shadow-none' },
      overrides: [{ variant: 'outlined', class: { base: 'border border-primary-500' } }]
    },
    Input: {
      slotClasses: {
        // Underline on `base` — see Cala's anatomy note.
        base: 'border-x-0 border-t-0 rounded-none bg-transparent'
      }
    },
    // Identical to the Input above, deliberately: one house, one field idiom.
    // It used to read `border-x-0 border-t-0 border-b bg-transparent` — the
    // `border-b` was redundant (the base slot already carries `border`, and
    // stripping three edges leaves the fourth at its width) and the missing
    // `rounded-none` left the textarea with rounded corners on a field that
    // has only a bottom edge, while its own Input had none.
    Textarea: {
      slotClasses: { base: 'border-x-0 border-t-0 rounded-none bg-transparent' }
    }
  }
};

export const LIVERIES: Livery[] = [CALA, FIRN, DUNA];

/** Cala is the group's first house — the page opens on the quietest one. */
export const DEFAULT_LIVERY = CALA;

/** Look up a livery by id, falling back to the default for unknown ids. */
export function liveryById(id: string | null | undefined): Livery {
  return LIVERIES.find((livery) => livery.id === id) ?? DEFAULT_LIVERY;
}
