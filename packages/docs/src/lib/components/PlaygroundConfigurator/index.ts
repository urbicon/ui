import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { CodeSetup } from './code-gen';
import type {
  PlaygroundConfiguratorSlots,
  PlaygroundConfiguratorVariantProps
} from './playground-configurator.variants';

/**
 * The configurator's own slots, plus the two CodePanel slots it forwards to the
 * embedded panel (`codeToolbar` → the panel's `toolbar`, `codeDisplay` → its
 * `codeDisplay`). The panel's `root` is reached through the own `codePanel` slot.
 */
export type PlaygroundConfiguratorSlotName =
  | PlaygroundConfiguratorSlots
  | 'codeToolbar'
  | 'codeDisplay';

/**
 * Splits generated component props into hand-written descriptions (for tooltips)
 * and variant-only keys (for a "V" badge). Direct/JSDoc descriptions always win
 * over auto-generated tv() descriptions.
 *
 * A prop's `summary` wins over its `description` where one exists. The two have
 * different readers: the description is the contract an agent reads out of
 * `llm.txt` or the MCP catalog and may run to a paragraph — beside a knob that
 * paragraph is not help, it is a wall. `CurrencyInput.locale` was the measured
 * case: nine lines on SSR hydration and `Intl.NumberFormat` internals next to a
 * three-way switch. Most props need no summary and get none; the fallback is
 * the description, unchanged.
 */
export function extractPlaygroundDocs(
  props: Array<{
    name: string;
    description?: string;
    summary?: string;
    source?: { type: string };
  }>
): { propDocs: Record<string, string>; variantKeys: string[] } {
  const propDocs: Record<string, string> = {};
  const variantNames = new Set<string>();
  const directNames = new Set<string>();

  for (const p of props) {
    const text = p.summary ?? p.description;
    if (!text) continue;
    if (p.source?.type === 'variant') {
      variantNames.add(p.name);
    } else {
      directNames.add(p.name);
      propDocs[p.name] = text;
    }
  }

  const variantKeys = [...variantNames].filter((n) => !directNames.has(n));
  return { propDocs, variantKeys };
}

/**
 * Interactive playground configurator for component documentation.
 * Renders a live preview, control panel for props, and generated code block.
 *
 * @example
 * ```svelte
 * <PlaygroundConfigurator
 *   componentName="Button"
 *   controls={controls}
 *   values={values}
 * >
 *   {#snippet children(vals)}
 *     <Button {...vals}>Click me</Button>
 *   {/snippet}
 * </PlaygroundConfigurator>
 * ```
 * @summary Live component playground pairing a preview stage with prop controls and a generated snippet.
 * @tag display
 *
 */
export interface PlaygroundConfiguratorProps<
  TValues extends Record<string, unknown> = Record<string, unknown>
> extends Omit<PlaygroundConfiguratorVariantProps, 'size'>,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * Controls the density of the playground layout – padding, grid columns, and text size.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /** Heading text above the playground panel. */
  title?: string;

  /** Descriptive text below the title. */
  subtitle?: string;

  /**
   * Control definitions that drive the props panel (dropdown, toggle, text, etc.).
   *
   * Optional, because not every component has anything to turn: the auth family
   * has API paths and callbacks, not variant axes. Left out, the props panel is
   * not rendered at all and the configurator carries just the stage and the code
   * panel — which is the part those components were missing.
   */
  controls?: ControlDefinition[];

  /** Current control values. Supports `bind:values` for two-way binding. */
  values?: TValues;

  /** Fires after any control value changes with the full values map. */
  onValuesChange?: (values: TValues) => void;

  /** Custom code generator. Falls back to auto-generated Svelte tag syntax. */
  codeGenerator?: (values: TValues) => string;

  /**
   * Imports and data declarations the generated snippet needs to be a complete,
   * copyable file.
   *
   * Omit it for components whose props tell the whole story — `<Button
   * variant="ghost">Get started</Button>` needs nothing above it. Supply it for
   * components that are meaningless without data: a `Table` needs `columns` and
   * `items`, an `A2UIView` a `payload`. `consts` takes the very objects the
   * demo renders, so the snippet cannot fall out of step with the preview.
   */
  codeSetup?: CodeSetup;

  /**
   * The playground's own source text, for demos whose content is **markup**
   * rather than data — a Card's header and footer snippets, a SplitPane's two
   * panes, the `<SegmentItem>`s inside a SegmentGroup. `codeSetup` cannot reach
   * those (there is no data form they could take), so their snippets otherwise
   * read `<Card />`: true and useless.
   *
   * Pass it as a raw import, which costs nothing but the file's own text in the
   * chunk that already holds the playground:
   *
   * ```svelte
   * import playgroundSource from './Playground.svelte?raw';
   * <PlaygroundConfigurator source={playgroundSource} …>
   * ```
   *
   * Name it `playgroundSource`, not `self`: `self` is `window.self`, so a
   * missing import type-checks against the global and silently passes the
   * Window object instead of failing.
   *
   * Only the children are taken; the opening tag stays generated from the live
   * control values, so default props keep out of the snippet. Markup that
   * refers to names the snippet does not declare is dropped rather than printed
   * broken — declare them in `codeSetup.consts` to show it.
   */
  source?: string;

  /**
   * Forces the code panel open or closed regardless of the page-wide code
   * switch. Leave it unset: the panel then follows `CodeVisibilityStore` on a
   * docs page, and starts collapsed where there is none (the landing hero).
   */
  defaultCodeExpanded?: boolean;

  /**
   * Component name used in the auto-generated code output.
   * @default 'Component'
   */
  componentName?: string;

  /**
   * Identity this playground's share links are scoped to, emitted as `_pg`.
   * A link only seeds the instance whose key it names, so a page with several
   * playgrounds does not decode one link into all of them.
   *
   * Defaults to `componentName`, which already separates instances documenting
   * different components. Set it only to tell same-named instances on one page
   * apart (`shareKey="Button-sizes"`); the value shows up in the URL, so make
   * it readable.
   */
  shareKey?: string;

  /**
   * Show the title/subtitle header above the playground.
   * @default true
   */
  showHeader?: boolean;

  /** Hand-written prop descriptions (from JSDoc). Shown as tooltip behind an info icon. */
  propDocs?: Record<string, string>;

  /** Prop names originating from tailwind-variants. Shown with a "V" indicator. */
  variantKeys?: string[];

  /**
   * Render snippet receiving the current values map. The argument is typed loosely
   * (`Record<string, any>`) so consumers can spread it onto child components without
   * type-asserting each variant key — the trade-off is that direct property access
   * inside the snippet is also `any`. Use the `values` prop type for typed access.
   *
   * The `any` here is a pragmatic exception to the project-wide ban: it enables
   * docs-page playgrounds (`<Component {...values} />`) to compile without forcing
   * every consumer to mirror the full prop union locally.
   */
  // biome-ignore lint/suspicious/noExplicitAny: consumer-spread escape hatch — children receive arbitrary host-component props (see JSDoc above).
  children: Snippet<[Record<string, any>]>;

  /** Extra CSS classes merged onto the root element. */
  class?: string;

  /**
   * Strip all default tv() styles from internal slots.
   * @default false
   */
  unstyled?: boolean;

  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<Record<PlaygroundConfiguratorSlotName, string>>;
}

export { type CodeSetup, generateDefaultCode, type RawCode, serializeValue } from './code-gen';
export {
  type ControlOverride,
  type DerivableComponentData,
  type DeriveControlsOptions,
  defaultValuesOf,
  deriveControls
} from './deriveControls';
export { default } from './PlaygroundConfigurator.svelte';
export {
  type PlaygroundConfiguratorSlots,
  type PlaygroundConfiguratorVariantProps,
  playgroundConfiguratorVariants
} from './playground-configurator.variants';
