import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { PlaygroundConfiguratorVariantProps } from './playground-configurator.variants';

/**
 * Splits generated component props into hand-written descriptions (for tooltips)
 * and variant-only keys (for a "V" badge). Direct/JSDoc descriptions always win
 * over auto-generated tv() descriptions.
 */
export function extractPlaygroundDocs(
  props: Array<{ name: string; description?: string; source?: { type: string } }>
): { propDocs: Record<string, string>; variantKeys: string[] } {
  const propDocs: Record<string, string> = {};
  const variantNames = new Set<string>();
  const directNames = new Set<string>();

  for (const p of props) {
    if (!p.description) continue;
    if (p.source?.type === 'variant') {
      variantNames.add(p.name);
    } else {
      directNames.add(p.name);
      propDocs[p.name] = p.description;
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
 */
export interface PlaygroundConfiguratorProps<
  TValues extends Record<string, unknown> = Record<string, unknown>
> extends Omit<PlaygroundConfiguratorVariantProps, 'size'>,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Controls the density of the playground layout – padding, grid columns, and text size. */
  size?: 'sm' | 'md' | 'lg';

  /** Heading text above the playground panel. */
  title?: string;

  /** Descriptive text below the title. */
  subtitle?: string;

  /** Control definitions that drive the props panel (dropdown, toggle, text, etc.). */
  controls: ControlDefinition[];

  /** Current control values. Supports `bind:values` for two-way binding. */
  values: TValues;

  /** Fires after any control value changes with the full values map. */
  onValuesChange?: (values: TValues) => void;

  /** Custom code generator. Falls back to auto-generated Svelte tag syntax. */
  codeGenerator?: (values: TValues) => string;

  /** Component name used in the auto-generated code output. */
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

  /** Show the title/subtitle header above the playground. */
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

  /** Strip all default tv() styles from internal slots. */
  unstyled?: boolean;

  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<
    Record<
      | 'root'
      | 'header'
      | 'title'
      | 'subtitle'
      | 'container'
      | 'preview'
      | 'previewContent'
      | 'controlsPanel'
      | 'controlsHeader'
      | 'controlsGrid'
      | 'controlItem'
      | 'controlLabel'
      | 'controlControl'
      | 'controlControlCompact'
      | 'controlHint'
      | 'actionsBar'
      | 'helpToggle'
      | 'codePanel'
      | 'codeToolbar'
      | 'codeDisplay',
      string
    >
  >;
}

export { default } from './PlaygroundConfigurator.svelte';
export {
  type PlaygroundConfiguratorVariantProps,
  playgroundConfiguratorVariants
} from './playground-configurator.variants';
