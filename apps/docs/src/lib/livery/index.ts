import type { ComponentDefaults } from '@urbicon-ui/blocks';

/**
 * A livery is one salon's visual identity, in three layers:
 *
 * 1. **Design tokens** (`liveries.css`, keyed by `data-livery`) — colour ramps,
 *    radius tiers, type, ground texture. Names no component, reaches every one
 *    of them, including the ones an agent conjured a second ago.
 * 2. **Provider defaults** (below) — the exceptions tokens cannot express: a
 *    border idiom, a type jump, a shape a token tier bundles with something
 *    else. Still project configuration, still zero call sites touched.
 * 3. **Layout** (`layout`, consumed by the page) — where things sit. Not a
 *    token and not pretending to be one: a scattered edge grid and a
 *    symmetrical column are different page structures, not different values.
 *
 * Layer 3 is the honest boundary of this demo. Layers 1 and 2 reach the
 * agent-generated surface automatically; layer 3 does not, because the agent
 * decides its own composition (Column, Row, Section). A house whose identity
 * lives mostly in its grid will theme the chrome perfectly and the generated
 * form only as far as colour and type carry it.
 */
export interface Livery {
  id: string;
  name: string;
  /** The house it stands for, in one line. */
  tagline: string;
  /** What the reference hand does that a neutral-page-plus-accent cannot. */
  mechanism: string;
  layout: LiveryLayout;
  /** Component-level styling the token layer cannot reach. */
  defaults: Record<string, ComponentDefaults>;
}

/**
 * Page structure, not decoration.
 *
 * - `immersive` — one field edge to edge, content centred in a lot of nothing.
 * - `scatter`   — no centre: items pinned across a wide grid, big voids.
 * - `symmetric` — classical centred column, everything balanced.
 * - `edge`      — the wordmark runs past the text column and off the margin.
 */
export type LiveryLayout = 'immersive' | 'scatter' | 'symmetric' | 'edge';

/**
 * Nothing to do here any more — kept as a note because the absence is the point.
 *
 * Until 2026-07-31 every livery below carried a `CIRCULAR_RADIOS` provider
 * override, because `--radius-commit` drove BOTH the pill of a commit-tier
 * button and the circle of a radio indicator. A livery that squared its buttons
 * squared its radios with them, and a square radio is a checkbox to the eye —
 * shape is what carries "exactly one of these".
 *
 * ALL FOUR houses needed the workaround, including the one that only softens the
 * tier to 2px rather than zeroing it (2px on a 20px control already reads as a
 * square). That is what made it a token problem rather than a livery quirk: any
 * theme touching the tier at all lost the affordance.
 *
 * The controls now have their own tokens (`--radius-control`,
 * `--radius-checkbox` in foundation.css), so squaring the pill leaves them
 * alone. If a livery ever needs to override a radio's shape again, that is a
 * deliberate choice rather than damage control.
 */

const IMMERSION: Livery = {
  id: 'immersion',
  name: 'Immersion',
  tagline: 'A saturated violet fills everything. No white anywhere.',
  mechanism: 'The ground is the brand — the neutral ramp itself carries chroma.',
  layout: 'immersive',
  defaults: {
    // Cards must not read as panels floating on the field — they are the same
    // violet, one shade apart, held by a hairline.
    Card: {
      slotClasses: { base: 'border border-border-subtle shadow-none' }
    },
    Button: {
      slotClasses: { base: 'shadow-none hover:shadow-none active:shadow-none' },
      overrides: [{ variant: 'outlined', class: { base: 'border border-text-primary' } }]
    },
    // Underlines only. A boxed input would cut a second rectangle into a field
    // whose whole idea is that it is uninterrupted.
    //
    // NOTE the two different slots: Input paints its fill on `base` and its
    // border on `container`, Textarea does both on `base`. Clearing only the
    // container left the input sitting in a filled box under a bare underline
    // while the textarea beside it was correctly transparent — visible only by
    // looking, since both configs "read" right.
    Input: {
      slotClasses: {
        container: 'border-x-0 border-t-0 border-b bg-transparent',
        base: 'bg-transparent'
      }
    },
    Textarea: {
      slotClasses: { base: 'border-x-0 border-t-0 border-b bg-transparent' }
    }
  }
};

const GRAIN: Livery = {
  id: 'grain',
  name: 'Grain',
  tagline: 'Tinted off-white, visible noise, everything tiny and tracked out.',
  mechanism: 'Near-zero contrast and violent type jumps — no comfortable middle.',
  layout: 'scatter',
  defaults: {
    // The type jump has to reach the generated form too, or the house stops at
    // the page edge: labels drop to the smallest step the scale has, while the
    // wordmark runs at 8xl. Nothing sits in between anywhere.
    RadioItem: {
      slotClasses: {
        label: 'text-2xs tracking-[0.18em] uppercase',
        description: 'text-2xs'
      }
    },
    // The group's own label lives on RadioGroup, not RadioItem — two configs,
    // two provider keys. Missing this left "Which cut?" at body size while
    // every option under it was 10px caps, which read as an oversight rather
    // than a hierarchy.
    RadioGroup: {
      slotClasses: { label: 'text-3xs tracking-[0.24em]', message: 'text-3xs' }
    },
    Input: {
      slotClasses: {
        label: 'text-3xs tracking-[0.24em]',
        container: 'border-x-0 border-t-0 border-b bg-transparent',
        base: 'text-xs bg-transparent'
      }
    },
    Textarea: {
      slotClasses: { label: 'text-3xs tracking-[0.24em]', base: 'text-xs bg-transparent' }
    },
    Checkbox: {
      slotClasses: { label: 'text-2xs tracking-[0.18em] uppercase' }
    },
    Card: {
      slotClasses: { base: 'border border-border-subtle shadow-none bg-transparent' }
    },
    Button: {
      slotClasses: {
        base: 'shadow-none hover:shadow-none active:shadow-none text-2xs tracking-[0.24em] uppercase'
      }
    }
  }
};

const LACQUER: Livery = {
  id: 'lacquer',
  name: 'Lacquer',
  tagline: 'Black and gold, a classical serif, nothing else.',
  mechanism: 'A two-colour house: the second voice is the first, one step down.',
  layout: 'symmetric',
  defaults: {
    // This house sets `--radius-commit: 2px` rather than 0, and I first assumed
    // that was soft enough to leave the radio indicators alone. It is not: 2px
    // on a 20px control is a square, and the rendered form showed six square
    // "radios" that were indistinguishable from checkboxes.
    //
    // So all FOUR houses need the override, not three — the radio circle does
    // not survive any deviation from the pill default, however small. That is
    // the strongest form of the argument in docs/technical-debt.md: this is not
    // an edge case for austere themes, it is every theme that touches the tier.
    Card: {
      slotClasses: { base: 'border border-primary-900 shadow-none' }
    },
    Button: {
      // Gold hairline, never a gold fill except on the one real commitment.
      slotClasses: { base: 'shadow-none hover:shadow-none active:shadow-none' },
      overrides: [{ variant: 'outlined', class: { base: 'border border-primary-700' } }]
    },
    // This house keeps its boxes — it is the classical one — but they are drawn
    // in gold hairline over the lacquer, never filled.
    Input: {
      slotClasses: { container: 'border border-primary-900 bg-transparent', base: 'bg-transparent' }
    },
    Textarea: {
      slotClasses: { base: 'border border-primary-900 bg-transparent' }
    }
  }
};

const VITRINE: Livery = {
  id: 'vitrine',
  name: 'Vitrine',
  tagline: 'A duotone film grade over everything, display serif at the edge.',
  mechanism: 'The ground is an image, not a colour — the page is graded, not painted.',
  layout: 'edge',
  defaults: {
    // Everything is glass over the grade: surfaces stay translucent so the
    // light behind them keeps coming through.
    Card: {
      slotClasses: { base: 'border border-border-subtle bg-surface-base/70 shadow-none' }
    },
    Button: {
      slotClasses: { base: 'shadow-none hover:shadow-none active:shadow-none' },
      overrides: [{ variant: 'outlined', class: { base: 'border border-primary-600' } }]
    },
    Input: {
      slotClasses: {
        container: 'border-x-0 border-t-0 border-b bg-transparent',
        base: 'bg-transparent'
      }
    },
    Textarea: {
      slotClasses: { base: 'border-x-0 border-t-0 border-b bg-transparent' }
    }
  }
};

export const LIVERIES: Livery[] = [IMMERSION, GRAIN, LACQUER, VITRINE];

export const DEFAULT_LIVERY = IMMERSION;

/** Look up a livery by id, falling back to the default for unknown ids. */
export function liveryById(id: string | null | undefined): Livery {
  return LIVERIES.find((livery) => livery.id === id) ?? DEFAULT_LIVERY;
}
