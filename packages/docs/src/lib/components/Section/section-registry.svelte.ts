import { createOptionalContext } from '@urbicon-ui/blocks';
import { type Snippet, untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import type { TocNavigationItem } from '../TableOfContents/index.js';

/**
 * The sections a page renders, as the page renders them.
 *
 * Every `<Section>` registers itself into the nearest registry, and the table of
 * contents and the section markers are read from it: the TOC lists the sections
 * that carry a heading, in order, and a section's marker is its position among
 * the ones that asked for a number. Nothing on a page restates its outline, so
 * an entry that points nowhere, a section the TOC leaves out, two lists in a
 * different order, a repeated or a skipped number cannot be written.
 *
 * ## Where a registry starts
 *
 * - `DocsLayout` starts the page's.
 * - `CodeExample` and `PlaygroundConfigurator` start one for their stage, so a
 *   `<Section>` shown as a demo is numbered inside its stage and never reaches
 *   the page's table of contents.
 * - Every registered `<Section>` with a heading starts one for its own
 *   subtree: a section nested in it becomes a child entry and takes no number.
 *   A section without a heading starts none, so the sections it wraps belong
 *   to the level above it; it has no entry they could be the children of.
 *
 * A `<Section>` with no registry above it registers nowhere and renders no
 * marker.
 *
 * ## Order
 *
 * On the server, and while the browser hydrates, sections register in render
 * order, which is the order the entries keep. Once a section's element is in the
 * document it sorts by its position there, so one revealed later by an `{#if}`
 * takes its place among its siblings instead of joining the end, and the
 * sections after it renumber.
 *
 * ## Reading it on the server
 *
 * Nothing here is a `$derived`. A derived created during a server render is
 * evaluated once, at its first read, and a registry is read while the sections
 * after the reader have not registered yet: each `<Section>` reads its own number
 * before the next one exists. The getters compute on every read instead, which
 * is reactive in the browser all the same, and a reader that wants a memo keeps
 * one of its own, read only once the sections it needs have rendered.
 */

/** What a `<Section>` reports. Getters, so the registry always reads its live props. */
export interface SectionSource {
  readonly id: string;
  /** The heading's content, or `undefined` while the section renders no heading. */
  readonly heading: Snippet | undefined;
  /** Whether the section asked for a marker. */
  readonly marker: boolean;
}

export class RegisteredSection {
  /**
   * The rendered `<section>`, once it is in the document. Until then (always on
   * the server) the entry keeps its registration order.
   */
  element: Element | undefined = $state();

  /** The registry the section's own subtree registers into. */
  readonly children = new SectionRegistry(false);

  readonly #registry: SectionRegistry;
  readonly #source: SectionSource;

  constructor(registry: SectionRegistry, source: SectionSource) {
    this.#registry = registry;
    this.#source = source;
  }

  get id(): string {
    return this.#source.id;
  }

  get heading(): Snippet | undefined {
    return this.#source.heading;
  }

  /** Counts towards the numbering: asked for a marker, and has a heading to show it in. */
  get numbered(): boolean {
    return this.#source.marker && this.#source.heading !== undefined;
  }

  /** The section's marker number, from 1, or `undefined` when it carries none. */
  get number(): number | undefined {
    return this.#registry.numberOf(this);
  }

  /**
   * Records the rendered `<section>` once it is in the document. Untracked:
   * the caller is an attachment's effect, which must not re-run whenever
   * another section registers.
   */
  place(element: Element): void {
    this.element = element;
    if (import.meta.env?.DEV) untrack(() => this.#registry.warnOnSharedId(this));
  }

  unregister(): void {
    this.#registry.remove(this);
  }
}

/**
 * Whether an outro is taking `element` off the page: Svelte sets `inert` on the
 * element a running outro animates (`transitions.js`, `out()`), and restores it
 * if the outro is reversed.
 */
function leaving(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if ((node as HTMLElement).inert) return true;
  }
  return false;
}

/** `a` before `b` when `a` comes first in the document; entries not yet in it come last. */
function byDocumentPosition(a: RegisteredSection, b: RegisteredSection): number {
  if (a.element && b.element) {
    return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }
  if (a.element) return -1;
  if (b.element) return 1;
  return 0;
}

export class SectionRegistry {
  readonly #entries = new SvelteSet<RegisteredSection>();
  readonly #numbers: boolean;

  /** `numbers`: whether sections registered here take markers (a nested level does not). */
  constructor(numbers: boolean) {
    this.#numbers = numbers;
  }

  register(source: SectionSource): RegisteredSection {
    const entry = new RegisteredSection(this, source);
    this.#entries.add(entry);
    return entry;
  }

  remove(entry: RegisteredSection): void {
    this.#entries.delete(entry);
  }

  /** Every registered section, in render order. The sort is stable, so ties keep registration order. */
  get sections(): RegisteredSection[] {
    return [...this.#entries].sort(byDocumentPosition);
  }

  numberOf(entry: RegisteredSection): number | undefined {
    if (!this.#numbers || !entry.numbered) return undefined;
    const position = this.sections.filter((s) => s.numbered).indexOf(entry);
    return position === -1 ? undefined : position + 1;
  }

  /**
   * The table of contents: every section with a heading, labelled by it, and
   * each id once, the first in document order. The rail and the strip key their
   * entries by id, and a repeated key throws `each_key_duplicate` in the
   * browser, taking the page down. Two sections share an id when a page repeats
   * one, and for as long as an outro plays: an `{#if}` swap or a page
   * transition keeps the leaving section rendered beside the one replacing it.
   */
  get toc(): TocNavigationItem[] {
    const listed = new Set<string>();
    return this.sections.flatMap((section) => {
      if (!section.heading || listed.has(section.id)) return [];
      listed.add(section.id);
      return [
        {
          id: section.id,
          title: section.heading,
          children: section.children.toc.map(({ id, title }) => ({ id, title }))
        }
      ];
    });
  }

  /**
   * Dev only: says so when two sections on screen share an id. Asked when a
   * section is placed, not when it registers: Svelte creates an incoming branch
   * before it outros the outgoing one, so at registration a section on its way
   * out still holds the id. By the time the newcomer is placed, one without an
   * outro is gone, and one under an outro on itself or an ancestor is `leaving`.
   * An outro elsewhere in the leaving branch (`|global`, a sibling) is not seen,
   * so such a swap can warn once; a repeat under a consumer's `inert` is missed.
   */
  warnOnSharedId(entry: RegisteredSection): void {
    if (!entry.element || leaving(entry.element)) return;
    const twin = [...this.#entries].some(
      (other) =>
        other !== entry && other.id === entry.id && other.element && !leaving(other.element)
    );
    if (twin) {
      console.warn(
        `[@urbicon-ui/docs] Two sections share the id "${entry.id}". The table of contents ` +
          `lists the first, and #${entry.id} can reach only one of them.`
      );
    }
  }
}

const [getSectionRegistry, setSectionRegistry] = createOptionalContext<SectionRegistry>();

/** The registry a `<Section>` here registers into, or `undefined` when there is none. */
export { getSectionRegistry, setSectionRegistry };

/**
 * Starts a numbered registry for everything rendered below the caller: a page
 * (`DocsLayout`) or a demo stage that keeps its sections out of the page's.
 */
export function provideSectionRegistry(): SectionRegistry {
  const registry = new SectionRegistry(true);
  setSectionRegistry(registry);
  return registry;
}
