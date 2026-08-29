import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Component } from 'svelte';

/**
 * Who takes part in the provider-cascade sweep, and with which slot names —
 * both read out of the source, never listed here.
 *
 * Three facts come from the code and none of them can be hand-maintained
 * without the list and the code drifting apart:
 *
 * - a component is public iff the package barrel exports the very module
 *   object the file default-exports (compared by identity, not by name);
 * - its provider name is the string literal it passes to `resolveSlotClasses`
 *   — without one it cannot be addressed from a provider's `defaults` at all;
 * - its slot names come from the `tv()` configs it composes from, read through
 *   the `.config` the engine exposes, because `Object.keys(config.slots)` is
 *   where the engine itself gets them.
 *
 * The condition object is deliberately *not* read here. It is captured at
 * mount time from the real `resolveSlotClasses` call, so its keys and the
 * values a component carries in that mount both come from the running
 * component rather than from a parse of an object literal that has prose in it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Loosely typed on purpose: the sweep mounts every component through one
 * host, so the props it hands over are only known at runtime. */
type AnyComponent = Component<Record<string, unknown>>;

// Discovery is bounded by these two directories: a component added under a new
// `src/lib/<dir>` would be exported, styled, and silently outside the sweep.
// Measured on this tree — the 368 barrel exports outside them are icons and
// infrastructure, and the only `.svelte` elsewhere that declares `unstyled` are
// the three `internal/core/*`, which the barrel deliberately never exports.
const componentLoaders = import.meta.glob<{ default: AnyComponent }>(
  '../../{components,primitives}/**/*.svelte'
);
const variantLoaders = import.meta.glob<Record<string, unknown>>('../../**/*variants*.ts');

const abs = (globKey: string) => resolve(HERE, globKey);

const componentsByPath = new Map(
  Object.entries(componentLoaders).map(([key, load]) => [abs(key), load])
);

/** `resolveSlotClasses(config, 'Name', …)` — the provider name of a component. */
const PROVIDER_NAME = /resolveSlotClasses\(\s*[A-Za-z_$][\w$]*\s*,\s*'([^']+)'/;
/** The destructuring pattern of the component's own `$props()` call. */
const PROPS_CALL = /let\s*\{([\s\S]*?)\}\s*(?::[^=]*)?=\s*\$props\(\)/;
/** Any identifier the source uses — matched against the tv() export index. */
const IDENTIFIER = /\b[A-Za-z_$][\w$]*\b/g;

export interface CascadeComponent {
  /** Provider name — the key a `defaults` entry is written under, if any. */
  providerName: string | null;
  /** The identifier the package barrel exports this component as. */
  exportName: string;
  /** Every slot name the tv() configs this component composes from declare. */
  slots: string[];
  /** Every class token those configs can emit — what `unstyled` has to drop. */
  libraryTokens: Set<string>;
  /** Prop names the component destructures from `$props()`. */
  declaredProps: string[];
  component: AnyComponent;
}

/**
 * Strip comments before scanning for names. Not cosmetic: the components put
 * prose *inside* the object literals and argument lists this file reads, so an
 * unstripped scan takes words out of a sentence for prop names.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Top-level identifiers of a destructuring pattern (`a = 1, b: c, ...rest`). */
function destructuredNames(pattern: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of pattern) {
    if ('{[('.includes(char)) depth++;
    else if ('}])'.includes(char)) depth--;
    if (char === ',' && depth === 0) {
      names.push(current);
      current = '';
    } else current += char;
  }
  names.push(current);
  return names
    .map((entry) => entry.trim())
    .filter((entry) => entry && !entry.startsWith('...'))
    .map((entry) => entry.split(/[:=]/)[0].trim())
    .filter((entry) => /^[A-Za-z_$][\w$]*$/.test(entry));
}

interface TvFacts {
  slots: string[];
  tokens: string[];
}

/** Every string leaf of a tv() config value, split into class tokens. */
function collectTokens(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    for (const token of value.split(/\s+/)) if (token) into.add(token);
  } else if (Array.isArray(value)) {
    for (const entry of value) collectTokens(entry, into);
  } else if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectTokens(entry, into);
  }
}

/**
 * Export name → the tv() facts of its module, over every module whose filename
 * carries `variants`. Indexed by export name rather than by import path
 * because a component may pull its resolver through the package barrel
 * (`buttonVariants` from `$lib/primitives`), where the path says nothing.
 */
async function buildTvIndex(): Promise<Map<string, TvFacts>> {
  const index = new Map<string, TvFacts>();
  for (const [key, load] of Object.entries(variantLoaders)) {
    if (/\.(test|spec)\.ts$/.test(key)) continue;
    const module = await load();
    const slots = new Set<string>();
    const tokens = new Set<string>();
    for (const exported of Object.values(module)) {
      const config = (exported as { config?: Record<string, unknown> })?.config;
      if (!config) continue;
      if (config.slots) for (const slot of Object.keys(config.slots as object)) slots.add(slot);
      // `defaultVariants` holds axis *values* ('md'), not classes — collecting
      // it would put words into the token set that no stylesheet ever emits.
      const { defaultVariants: _ignored, ...classBearing } = config;
      collectTokens(classBearing, tokens);
    }
    if (slots.size === 0 && tokens.size === 0) continue;
    const facts: TvFacts = { slots: [...slots], tokens: [...tokens] };
    for (const name of Object.keys(module)) index.set(name, facts);
  }
  return index;
}

let cache: Promise<CascadeComponent[]> | undefined;

/**
 * Every component the package exports, in stable export-name order.
 * A component the barrel does not export is not part of the contract.
 */
export function exportedComponents(): Promise<CascadeComponent[]> {
  cache ??= (async () => {
    const [barrel, tvIndex] = await Promise.all([import('$lib'), buildTvIndex()]);
    const exportNameByModule = new Map<unknown, string>();
    for (const [name, value] of Object.entries(barrel)) {
      if (typeof value === 'function' && /^[A-Z]/.test(name)) exportNameByModule.set(value, name);
    }

    const found: CascadeComponent[] = [];
    for (const [path, load] of componentsByPath) {
      const component = (await load()).default;
      const exportName = exportNameByModule.get(component);
      if (!exportName) continue;

      const code = stripComments(readFileSync(path, 'utf8'));
      const slots = new Set<string>();
      const libraryTokens = new Set<string>();
      for (const [identifier] of code.matchAll(IDENTIFIER)) {
        const facts = tvIndex.get(identifier);
        if (!facts) continue;
        for (const slot of facts.slots) slots.add(slot);
        for (const token of facts.tokens) libraryTokens.add(token);
      }

      found.push({
        providerName: code.match(PROVIDER_NAME)?.[1] ?? null,
        exportName,
        // A tv() config without `slots` routes its classes to `base`, and that
        // is the key such a component reads off the resolved record.
        slots: slots.size > 0 ? [...slots] : ['base'],
        libraryTokens,
        declaredProps: destructuredNames(code.match(PROPS_CALL)?.[1] ?? ''),
        component
      });
    }
    return found.sort((a, b) => a.exportName.localeCompare(b.exportName));
  })();
  return cache;
}
