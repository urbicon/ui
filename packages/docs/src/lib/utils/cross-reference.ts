/**
 * Shared in-page cross-referencing between the API and Types tables.
 *
 * Both directions resolve to the same thing — a row in a `@urbicon-ui/table`
 * `<Table>` — so both use this helper and get identical scroll/expand/highlight
 * semantics. `<Table>` renders each row as `<tr id={item.id}>`; when the row is
 * expandable it also carries `aria-expanded` and toggles on click.
 */

/** Pending highlight removal per element, so repeated clicks don't stack timers. */
const pendingHighlights = new WeakMap<Element, ReturnType<typeof setTimeout>>();

const HIGHLIGHT_MS = 1200;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

/**
 * Finds a table row by exact id, falling back to the `{id}-{index}` form that
 * `TypesReference` uses to keep row ids unique.
 *
 * Matching is done in JS rather than via an attribute selector so that ids
 * containing CSS-significant characters (`prop-...restProps`) need no escaping,
 * and so `type-Foo-` can never match `type-FooBar-2`.
 */
function findRow(rowId: string): HTMLElement | null {
  const exact = document.getElementById(rowId);
  if (exact) return exact;

  const prefix = `${rowId}-`;
  for (const row of document.querySelectorAll<HTMLElement>('tr[id]')) {
    if (row.id.startsWith(prefix)) return row;
  }
  return null;
}

export interface RevealRowOptions {
  /** Row id to reveal, e.g. `prop-options` or `type-ComboboxOption`. */
  rowId: string;
  /** Space-separated classes applied briefly to mark the row on arrival. */
  highlightClasses: string;
  /** Id of the section to scroll to when the row itself cannot be found. */
  fallbackSectionId?: string;
  /** Expand the row when it is collapsed (rows whose detail lives behind a disclosure). */
  expand?: boolean;
}

/**
 * Scrolls a table row into view, optionally expanding it, and flashes a highlight
 * so the reader can see where they landed.
 *
 * @returns `true` when the row was found and revealed, `false` when it was not
 * (filtered out, on another page of the table, or not rendered at all) — in which
 * case the fallback section is scrolled to instead, if given.
 */
export function revealTableRow(options: RevealRowOptions): boolean {
  const { rowId, highlightClasses, fallbackSectionId, expand = false } = options;
  if (typeof document === 'undefined') return false;

  const row = findRow(rowId);

  if (!row) {
    if (fallbackSectionId) {
      document
        .getElementById(fallbackSectionId)
        ?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
    return false;
  }

  // Only expand when collapsed — clicking an already-expanded row would close it.
  if (expand && row.getAttribute('aria-expanded') === 'false') {
    row.click();
  }

  row.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });

  const classes = highlightClasses.split(' ').filter(Boolean);
  if (classes.length > 0) {
    // Expanding flips the row's reactive `class`, and Svelte rewrites the whole
    // attribute on its next flush — classes added before that are silently wiped.
    // rAF runs after the microtask flush, so the highlight survives.
    requestAnimationFrame(() => {
      const pending = pendingHighlights.get(row);
      if (pending) clearTimeout(pending);

      row.classList.add(...classes);
      pendingHighlights.set(
        row,
        setTimeout(() => {
          row.classList.remove(...classes);
          pendingHighlights.delete(row);
        }, HIGHLIGHT_MS)
      );
    });
  }

  return true;
}
