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
 *    token and not pretending to be one: a scattered edge grid and a vertical
 *    pillar are different page structures, not different values.
 *
 * Layer 3 is the honest boundary of this demo. Layers 1 and 2 reach the
 * agent-generated surface automatically; layer 3 does not, because the agent
 * decides its own composition (Column, Row, Section). A house whose identity
 * lives mostly in its grid will theme the chrome perfectly and the generated
 * form only as far as colour and type carry it.
 *
 * Since the move to the hotel universe (2026-08-10) a livery IS a house of the
 * Fermata group — the four sub-brands of `$lib/hotel-tools`, which is the real
 * shape of this pattern in the wild: one booking platform, four identities.
 * The ids here must therefore match `HOUSES[].id`; the full page joins the two
 * registries by that key, and a livery without house data would be a switch
 * position that renders an empty page.
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
 * - `courtyard` — a symmetric centred column; every section head sits under a
 *   whitewashed arch.
 * - `scatter`   — no centre: items pinned across a wide grid, big voids.
 * - `pillar`    — one narrow column; the wordmark stands VERTICAL at the edge,
 *   read top to bottom like a hanging scroll.
 * - `horizon`   — everything sits on one full-bleed line, the wordmark resting
 *   on it like the sun on the dune crest.
 */
export type LiveryLayout = 'courtyard' | 'scatter' | 'pillar' | 'horizon';

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
  tagline: 'Whitewash over a shallow bay. The shadows are blue, never grey.',
  mechanism: 'Overexposure — the ground is light itself; structure comes from shadow.',
  layout: 'courtyard',
  defaults: {
    // A card is a whitewashed cube: one hairline, no floating. Depth on this
    // page belongs to the blue of the type, not to drop shadows.
    Card: {
      slotClasses: { base: 'border border-border-subtle shadow-none' }
    },
    Button: {
      slotClasses: { base: 'shadow-none hover:shadow-none active:shadow-none' },
      overrides: [{ variant: 'outlined', class: { base: 'border border-primary-600' } }]
    },
    // Boxed inputs, softly rounded — the one house that keeps its boxes, drawn
    // as openings in a wall rather than panels on it.
    //
    // NOTE the two different slots: Input paints its fill on `base` and its
    // border on `container`, Textarea does both on `base`. Clearing only the
    // container leaves the input in a filled box — visible only by looking,
    // since both configs "read" right (learned in the salon universe).
    Input: {
      slotClasses: {
        container: 'border border-border-default bg-transparent',
        base: 'bg-transparent'
      }
    },
    Textarea: {
      slotClasses: { base: 'border border-border-default bg-transparent' }
    }
  }
};

const FIRN: Livery = {
  id: 'firn',
  name: 'Firn',
  tagline: 'Ink on snow at 1,850 metres. One glacier line.',
  mechanism: 'Thin air — near-nothing on the page; precision stands in for colour.',
  layout: 'scatter',
  defaults: {
    // The type jump has to reach the generated form too, or the house stops at
    // the page edge: labels drop to the smallest step the scale has, while the
    // wordmark spans the full measure. Nothing sits in between anywhere.
    RadioItem: {
      slotClasses: {
        label: 'text-2xs tracking-[0.18em] uppercase',
        description: 'text-2xs'
      }
    },
    // The group's own label lives on RadioGroup, not RadioItem — two configs,
    // two provider keys. Missing this left the question at body size while
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

const MORI: Livery = {
  id: 'mori',
  name: 'Mori',
  tagline: 'Cedar dusk, paper type, one lantern.',
  mechanism: 'The ground is the forest at dusk — light is warm and pointed, never a flood.',
  layout: 'pillar',
  defaults: {
    // Shoji logic: surfaces are frames, not panels. A card is a hairline
    // rectangle the dusk shows through.
    Card: {
      slotClasses: { base: 'border border-border-subtle bg-transparent shadow-none' }
    },
    Button: {
      // Lantern hairline; the warm fill is reserved for the one commitment.
      slotClasses: { base: 'shadow-none hover:shadow-none active:shadow-none' },
      overrides: [{ variant: 'outlined', class: { base: 'border border-primary-600' } }]
    },
    // Underlines only — a boxed input would cut a pane into the paper.
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

const DUNA: Livery = {
  id: 'duna',
  name: 'Duna',
  tagline: 'Dune grass at last light. Everything on the horizon.',
  mechanism: 'The ground is a gradient — the page is an evening, banded like sand.',
  layout: 'horizon',
  defaults: {
    // Everything is glass over the glow: surfaces stay translucent so the
    // light behind them keeps coming through.
    Card: {
      slotClasses: { base: 'border border-border-subtle bg-surface-base/70 shadow-none' }
    },
    Button: {
      slotClasses: { base: 'shadow-none hover:shadow-none active:shadow-none' },
      overrides: [{ variant: 'outlined', class: { base: 'border border-primary-500' } }]
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

export const LIVERIES: Livery[] = [CALA, FIRN, MORI, DUNA];

/** Cala is the group's first house — the page opens on the quietest one. */
export const DEFAULT_LIVERY = CALA;

/** Look up a livery by id, falling back to the default for unknown ids. */
export function liveryById(id: string | null | undefined): Livery {
  return LIVERIES.find((livery) => livery.id === id) ?? DEFAULT_LIVERY;
}
