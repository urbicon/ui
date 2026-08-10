/**
 * Catalog abstraction for the A2UI engine. A *catalog* bundles everything the
 * pure-TS engine (validate/render/prompt) needs to be catalog-agnostic: the
 * component registry, the icon-name set, the unsupported/ignored lists, the
 * flex-container set (which parents honour a child `weight`), and per-component
 * post-validation checks. This is the seam that lets a second, Urbicon-native
 * catalog (`urbicon/…`) sit alongside the v0.9.1 `basic` catalog without
 * touching the engine.
 *
 * Two layers:
 * - `A2uiCatalogSpec` — pure TS, Svelte-free, server-importable (a server
 *   building the system prompt or validating a payload has no DOM). This is
 *   what the engine threads.
 * - `A2uiCatalog` — adds the Svelte wiring (`Node` dispatcher, `createIcons`
 *   factory) via TYPE-ONLY imports, so importing this module still pulls no
 *   Svelte runtime. The `.svelte`-bearing catalog VALUE is assembled in a
 *   separate module (`a2ui-basic-catalog.ts`) so the pure spec stays isolated.
 *
 * The spec-level prop/component types live in `a2ui-registry.ts` (the Basic
 * data); they are re-exported here so a downstream catalog imports one place.
 */

import type { Component } from 'svelte';
import type { IconComponent } from '$lib/icons';
import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';
import {
  A2UI_CATALOG_ID,
  A2UI_ICON_NAMES,
  A2UI_IGNORED_PROPS,
  A2UI_REGISTRY,
  type A2uiComponentSpec,
  type A2uiPropKind,
  type A2uiPropSpec,
  lookupTable,
  UNSUPPORTED_A2UI_COMPONENTS
} from './a2ui-registry';
import type { A2uiNodeProps } from './a2ui-render';

export type { A2uiComponentSpec, A2uiPropKind, A2uiPropSpec };

/**
 * Context passed to a per-component post-validation check. `props` is the
 * already-validated (registry-declared, stored) prop map for the component;
 * `base` is its payload path (`/messages/<i>/updateComponents/components/<j>`).
 */
export interface A2uiComponentCheckContext {
  id: string;
  props: ReadonlyMap<string, unknown>;
  surfaceId: string;
  base: string;
}

/**
 * A per-component check the engine runs after generic prop validation, keyed by
 * component name. Returns any extra issues (e.g. ChoicePicker chips-fallback,
 * DateTimeInput missing-mode). Kept as catalog DATA rather than hardcoded
 * branches so each catalog owns its own semantic warnings.
 */
export type A2uiComponentCheck = (ctx: A2uiComponentCheckContext) => A2uiValidationIssue[];

/**
 * The Svelte-free half of a catalog — everything the engine (validate / render
 * graph / prompt) needs. Structurally satisfied by the richer `A2uiCatalog`.
 */
export interface A2uiCatalogSpec {
  /** Catalog id advertised in `createSurface` and matched against incoming surfaces. */
  catalogId: string;
  /** Additional ids that resolve to this catalog (version/back-compat aliases). */
  catalogIdAliases?: readonly string[];
  /** Component name → spec (the single source of truth for validation AND the prompt). */
  registry: Readonly<Record<string, A2uiComponentSpec>>;
  /** Mapped `Icon.name` values; an unmapped name degrades to a fallback glyph. */
  iconNames: readonly string[];
  /** Real catalog components deliberately not rendered (error chip, not "unknown"). */
  unsupportedComponents: ReadonlySet<string>;
  /** Props recognised anywhere but dropped before render (validation warning only). */
  ignoredProps: ReadonlySet<string>;
  /** Component names whose DIRECT children may carry a `weight` (flex-grow). */
  flexContainers: ReadonlySet<string>;
  /** Optional per-component post-validation checks, keyed by component name. */
  componentChecks?: Readonly<Record<string, A2uiComponentCheck>>;
}

/**
 * A full, renderable catalog — the spec plus its Svelte wiring. `Node` is the
 * recursive dispatcher A2UIView renders per surface; `createIcons` builds the
 * icon map (must run during component init — `resolveIcon` reads the
 * IconProvider context). The `Component`/`IconComponent` references are
 * TYPE-ONLY, so this module stays runtime-Svelte-free.
 */
export interface A2uiCatalog extends A2uiCatalogSpec {
  Node: Component<A2uiNodeProps>;
  createIcons: () => {
    icons: Readonly<Record<string, IconComponent>>;
    fallbackIcon: IconComponent;
  };
}

/**
 * Resolve a `createSurface.catalogId` to a configured catalog: exact id match
 * first, then an alias match. No prefix/semver matching (an id must round-trip
 * unchanged). Returns `undefined` when nothing matches — the caller falls back
 * to the default catalog.
 */
export function resolveCatalog<T extends A2uiCatalogSpec>(
  catalogs: readonly T[],
  catalogId: string
): T | undefined {
  for (const catalog of catalogs) {
    if (catalog.catalogId === catalogId) return catalog;
  }
  for (const catalog of catalogs) {
    if (catalog.catalogIdAliases?.includes(catalogId)) return catalog;
  }
  return undefined;
}

/**
 * The v0.9.1 `basic`-subset catalog, spec half. The Basic-specific ChoicePicker
 * and DateTimeInput warnings live here as `componentChecks` (previously
 * hardcoded in the validator) so the engine carries no catalog-specific
 * branches. Message strings are byte-identical to the pre-refactor validator.
 */
export const basicA2uiCatalogSpec: A2uiCatalogSpec = {
  catalogId: A2UI_CATALOG_ID,
  registry: A2UI_REGISTRY,
  iconNames: A2UI_ICON_NAMES,
  unsupportedComponents: UNSUPPORTED_A2UI_COMPONENTS,
  ignoredProps: A2UI_IGNORED_PROPS,
  flexContainers: new Set(['Row', 'Column']),
  componentChecks: lookupTable<A2uiComponentCheck>({
    Tabs: ({ id, props, surfaceId, base }) => {
      // The spec marks `tabs` minItems: 1. An empty array is a well-formed
      // `labeledChildren` value, so the kind check passes it — but it renders a
      // tab strip with nothing in it. Read tolerantly, report loudly.
      const tabs = props.get('tabs');
      if (Array.isArray(tabs) && tabs.length === 0) {
        return [
          {
            severity: 'warning',
            code: A2UI_ISSUE_CODES.TABS_EMPTY,
            message: `Tabs "${id}" has an empty tabs array; nothing is rendered`,
            surfaceId,
            path: base
          }
        ];
      }
      return [];
    },
    ChoicePicker: ({ id, props, surfaceId, base }) => {
      if (props.get('displayStyle') === 'chips' || props.get('filterable') === true) {
        return [
          {
            severity: 'warning',
            code: A2UI_ISSUE_CODES.CHOICEPICKER_FALLBACK,
            message: `ChoicePicker "${id}" chips/filterable are rendered with a fallback`,
            surfaceId,
            path: base
          }
        ];
      }
      return [];
    },
    DateTimeInput: ({ id, props, surfaceId, base }) => {
      // Both flags default to false in the spec — a DateTimeInput without either
      // would have no input UI at all. We read tolerantly (render a date input)
      // and report loudly so the agent fixes the payload.
      if (props.get('enableDate') !== true && props.get('enableTime') !== true) {
        return [
          {
            severity: 'warning',
            code: A2UI_ISSUE_CODES.DATETIME_NO_MODE,
            message: `DateTimeInput "${id}" sets neither enableDate nor enableTime; rendering a date input`,
            surfaceId,
            path: base
          }
        ];
      }
      return [];
    }
  })
};
