import type { ComponentAPIData } from '../../types';

/** Legacy inline slot union on the `slotClasses` prop type, e.g. `Record<'a' | 'b', string>`. */
const INLINE_SLOT_RECORD_RE = /Record<['"]([\w\s|']+)['"],/;

/**
 * Resolve the `slotClasses` slot names for a component.
 *
 * Authoritative source: the `slots:` keys of the component's tv() config,
 * lifted by `VariantsExtractor` onto `ComponentAPIData.slots`. The repo derives
 * the public `XSlots` type from those keys (`SlotNames<typeof xVariants>`) — a
 * type alias the older `slotClasses` prop-type regex could not resolve, so it
 * reported `[]` for nearly every slotted component (Card, Button, Alert …).
 *
 * Falls back to two legacy heuristics only when no tv() slots were parsed (e.g.
 * a component with no variants file): a variant literally named `slot`/`slots`,
 * or an inline `Record<'a' | 'b', …>` on the `slotClasses` prop type.
 *
 * Shared by both catalog surfaces — the per-component `llm.txt`
 * (`LLMDocumentationGenerator`) and the MCP component catalog
 * (`MCPCatalogGenerator`) — so the two can never diverge again.
 *
 * Slot names only: tv() `slots:` values are class-name arrays with no per-key
 * documentation, so there is no description source to surface here.
 */
export function resolveSlotNames(compApi: ComponentAPIData): string[] {
  const names = new Set<string>();

  // Primary: the tv() `slots:` keys, in source order (base, header, …).
  for (const slot of compApi.slots ?? []) {
    const trimmed = slot?.trim();
    if (trimmed) names.add(trimmed);
  }

  if (names.size === 0) {
    // Fallback A: a variant literally named `slot`/`slots` (defensive; legacy).
    for (const variant of compApi.variants ?? []) {
      if (variant.name === 'slot' || variant.name === 'slots') {
        for (const value of variant.values) {
          const trimmed = value?.trim();
          if (trimmed) names.add(trimmed);
        }
      }
    }

    // Fallback B: an inline `Record<'a' | 'b', …>` on the slotClasses prop.
    const slotClassesProp = compApi.props?.find((p) => p.name === 'slotClasses');
    const inlineRecord = slotClassesProp?.type?.match(INLINE_SLOT_RECORD_RE);
    if (inlineRecord?.[1]) {
      for (const key of inlineRecord[1].split(/[|']/)) {
        const trimmed = key.trim();
        if (trimmed) names.add(trimmed);
      }
    }
  }

  return [...names];
}
