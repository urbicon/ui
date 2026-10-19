import type { ApiProp } from '../ApiReference/index.js';
import type { LocalTypeDef } from '../TypesReference/index.js';

/**
 * The part of a generated `componentData` the reference sections read — the
 * shape `docs:gen` writes into every page's `api.ts`.
 */
export interface ReferenceSectionsData {
  /** Every prop of the component, one entry per source it is declared in. */
  props?: ApiProp[];
  /** Every type extracted for the component. */
  types?: LocalTypeDef[];
}

/**
 * Props interface for ReferenceSections component
 *
 * @summary The API Reference and Types sections of a component page, both rendered from one componentData.
 * @description Renders the two reference sections of a component page from its generated
 * `componentData`: the numbered API Reference section (`id="api"`, the prop count beside the
 * heading) holding an `ApiReference`, and below it the numbered Types section (`id="types"`)
 * holding a `TypesReference`. Both tables read the one `componentData` passed here, so every
 * type name the API table turns into a link has its row in the Types table underneath.
 *
 * Wiring the two tables by hand means writing the same `types` array twice, and each copy
 * fails silently without the other: without `types` on `ApiReference` the Type column renders
 * every type name as plain text, and without a `TypesReference` its links point at a section
 * that does not exist.
 *
 * The section ids are fixed, so a page renders one instance and lists `api` and `types` in its
 * table of contents. A page documenting several components at once (one Types section under
 * several prop tables) composes `ApiReference` and `TypesReference` itself.
 *
 * @tag display
 * @tag documentation
 * @related ApiReference
 * @related TypesReference
 * @related Section
 *
 * @example
 * ```svelte
 * <ReferenceSections {componentData} />
 * ```
 */
export interface ReferenceSectionsProps {
  /**
   * The page's own generated `componentData` (`import { componentData } from './api'`).
   * `props` feeds the API Reference table, `types` both the links in it and the Types table.
   */
  componentData: ReferenceSectionsData;

  /**
   * A sentence under the Types heading, for a component whose types need an introduction
   * the table cannot give (which one a caller constructs, which ones only describe a
   * result). Without it the heading stands alone, like the API Reference heading above it.
   */
  typesDescription?: string;
}

export { default as ReferenceSections } from './ReferenceSections.svelte';
