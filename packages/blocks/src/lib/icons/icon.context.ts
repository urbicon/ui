import { createOptionalContext } from '$lib/utils/optional-context';
import type { IconComponent, IconName, IconSet } from './icon-types';

// Re-export the icon type surface so existing `from './icon.context'` imports —
// the leaf icons (type-only) and any consumer that imported types here —
// keep resolving after the registry/types/transform split.
export type {
  IconCategory,
  IconComponent,
  IconMeta,
  IconName,
  IconProps,
  IconSet
} from './icon-types';

// Icon overrides are optional. `resolveIcon()` (here) and `getIcon()` (in
// ./icon-registry) fall back to the caller's default / DEFAULT_ICONS when no
// IconProvider is present.
const [getIconOverrides, setIconOverrides] = createOptionalContext<Partial<IconSet>>();

/** @internal Used by the icon registry's `getIcon` (./icon-registry); not part of the public API. */
export { getIconOverrides };

/**
 * Provide icon overrides to all descendant components.
 * Must be called during component initialisation (e.g. in IconProvider).
 */
export function setIcons(overrides: Partial<IconSet>): void {
  setIconOverrides(overrides);
}

/**
 * Resolve an icon by name with a caller-supplied fallback. Returns the
 * context override (set via `IconProvider` / `setIcons`) when present,
 * otherwise the `fallback` the caller imported directly.
 *
 * Prefer this over `getIcon` inside components: because it never touches the
 * `DEFAULT_ICONS` registry, a component that imports its default icons
 * statically and resolves them here pulls ONLY those icons into the consumer
 * bundle — not the whole icon set. See docs/ICON-DESIGN.md →
 * "Icon resolution & tree-shaking".
 *
 * Must be called during component initialisation.
 */
export function resolveIcon(name: IconName, fallback: IconComponent): IconComponent {
  const overrides = getIconOverrides();
  return overrides?.[name] ?? fallback;
}
