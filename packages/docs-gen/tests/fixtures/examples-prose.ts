import type { Snippet } from 'svelte';

/**
 * Free-text lead paragraph that names the @example tag in prose but ships no
 * fenced code block anywhere. The extractor must not slice the trailing prose
 * into a "code sample".
 * @tag display
 */
export interface ProseLeadProps {
  /** Flag. */
  flag?: boolean;
  children?: Snippet;
}

/**
 * @description A well-formed description that happens to reference the
 * `@example` tag by name in its prose, with no real fenced example anywhere in
 * the block. The head-scan must not attribute the trailing prose to it.
 * @tag display
 */
export interface ProseDescProps {
  /** Flag. */
  flag?: boolean;
}

/**
 * @description A component that carries a genuine fenced example — this one
 * must still be extracted after the prose fallbacks are removed.
 * @tag display
 *
 * @example
 * ```svelte
 * <ProseReal open />
 * ```
 */
export interface ProseRealProps {
  /** Open. */
  open?: boolean;
}

export { default as ProseDesc } from './ProseDesc.svelte';
export { default as ProseLead } from './ProseLead.svelte';
export { default as ProseReal } from './ProseReal.svelte';
