import { createOptionalContext } from './optional-context';

/**
 * Semantic radius tier for interactive surfaces (3-tier system).
 *
 * - `commit`  → r-human   (CTA, identity, status declarations)
 * - `modify`  → r-interactive (fields, navigation, secondary actions)
 *
 * Container components (Card, Alert, Toolbar surface, …) live in a third
 * tier `contain` (r-structure) which is **not** part of this propagation
 * context — those surfaces are always r-structure by design and have no
 * tier-flip use case.
 */
export type InteractiveTier = 'commit' | 'modify';

export interface TierContext {
  readonly tier: InteractiveTier;
}

/**
 * Shared optional context for tier propagation. Set by parent containers
 * that wrap tier-aware children (Toolbar, ButtonGroup). Read by tier-aware
 * leaf components (Button, Badge, Input, Textarea, Select, Combobox) which
 * merge it with their own `tier` prop:
 *
 *   const tierCtx = getTierContext();
 *   const effectiveTier = $derived(tierProp ?? tierCtx?.tier ?? 'commit');
 *
 * Closer providers override farther ones automatically via Svelte's
 * `setContext` semantics. This keeps the API single-axis (one prop name)
 * and lets new containers opt into propagation without inventing their
 * own context module.
 */
const [getTierContext, setTierContext] = createOptionalContext<TierContext>();

export { getTierContext, setTierContext };
