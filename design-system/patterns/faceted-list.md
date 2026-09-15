# Faceted List

A search field and a row of facets over a list, where every setting is an address — the controls read down from the URL and write back up to it.

## When to Use

Use this pattern when:

- The screen is a catalogue someone narrows: a few axes with a known set of values, and one list underneath that the narrowing changes
- Each state of the list is worth an address — shared in a message, kept as a bookmark, reached again with Back
- The reader wants to know what a choice is worth before making it, which is what the count beside each value says

Do NOT use when:

- Narrowing means an operator on a column — contains, greater than, between — rather than picking a value out of a known set. That is a dataset: `Table` with `SmartFilterBar`
- There is one axis. A single set of values is a strip of links over the list (`tab-navigation`), and a bar around it is chrome with nothing in it
- The screen groups items into fixed zones nobody narrows across — that is `zoned-list`, and its whole point is that there is nothing to set
- The result must not be addressable. Everything here rests on the address being the state; without that the bar is six controls over a `$state` object, which is a smaller thing than this pattern and should not pretend to be it

## Layout

- **Structure:** four blocks in this order — the axis strip (`<nav>`), the bar (`<search>`), the summary line, the list. This pattern owns everything above the list and nothing in it; what the rows look like is `zoned-list`.
- **The bar is a `<search>` landmark**, not a `<div>`. It maps to `role="search"`, so the controls that narrow the list are one landmark jump away instead of a tab run — and the element says what the group is for, which no class can.
- **The facets wrap; they never scroll sideways.** `flex flex-wrap`, and the row grows a line. A horizontal scroller puts a set facet off-screen, and a filter the reader cannot see is a filter they cannot undo.
- **`size="sm"` across the row, every control.** The bar is a setting for the list, not a form on top of it, and one step under the form default is what says so. Mixing sizes across the row is worse than either choice: the row then has no baseline for its labels and its triggers to align to.
- **Every facet keeps its visible label.** Once a facet is set its trigger says only its value — "Noir 24" names no axis. The reader who cannot see which axis that narrows cannot undo it, and `nullOption`'s "All strands" is gone from the screen exactly when it was needed.
- **Below `sm` the facets fold behind one handle and the search field stays.** The search field is the only control that needs no knowledge of the data, so it is the one worth the width; the facets are a disclosure under a "Filter" handle.
- **Search first, facets in a fixed order, reset last.** The order is a decision, like a zone order: a row whose controls move between visits has to be re-read every time.

## The URL is the only state

Every facet value, the search text, the sort and the page live in `?query`. Nothing mirrors them.

- **Read down.** A control's value is `page.url.searchParams.get(param)`, evaluated where it is rendered. There is no second copy to keep in step, so there is nothing that can drift.
- **Write up.** A handle whose value is known in advance is a `Link` carrying the address `withSearchParams` builds — sort, reset, the axis. A listbox has no address to give an anchor, so a `Select` or `Combobox` writes through `goto(withSearchParams(page.url, patch))` on `onValueChange`, and that is a push: choosing a facet is somewhere you went, and Back is how you leave it.
- **Typing is the exception.** The search field writes `{ replaceState: true, keepFocus: true, noScroll: true }` after a debounce, so seven keystrokes leave one entry in the history instead of seven — otherwise Back undoes a letter at a time and the reader presses it until the page gives up. `keepFocus` is what lets them keep typing through the navigation.
- **Every write resets the page.** A reader on page 4 of one selection is on no page at all of the next.
- **Tolerant reading.** A value the page does not know is dropped, not rejected: an address from an older deploy, a typo in a shared link and a bookmark from before a facet was renamed all still open the list.

The reading and the address arithmetic are pure functions of a `URL`. Keeping them in a module of their own — importing `withSearchParams` from `@urbicon-ui/sveltekit-utils/search-params`, the entry that touches no runes and no `$app` — means the same functions serve the `load`, the component and a unit test with no SvelteKit around it. `@urbicon-ui/sveltekit-utils/url.svelte` is the other entry, and it is the one to reach for when a field genuinely wants a two-way binding (`createUrlParam`) rather than an address.

```typescript
import { withSearchParams } from '@urbicon-ui/sveltekit-utils/search-params';

/**
 * A facet's value, or null for "all". A value the facet does not know is
 * dropped rather than rejected, so an address that has outlived a rename still
 * opens the list — with that one axis wide, which is what an unreadable filter
 * should mean.
 */
export function readFacet(url: URL, param: string, known: readonly string[]): string | null {
  const value = url.searchParams.get(param);
  return value && known.includes(value) ? value : null;
}

/**
 * The axis the page stands on. Same tolerance, but it always answers: the axis
 * has no empty value, so an unknown one falls back rather than leaving the page
 * with no list to show.
 */
export function readAxis<T extends string>(
  url: URL,
  param: string,
  known: readonly T[],
  fallback: T
): T {
  const value = url.searchParams.get(param) as T | null;
  return value && known.includes(value) ? value : fallback;
}

/**
 * Which way a column opens on its first click. A date and a rating open at their
 * interesting end; a name reads from the top. A single global default sends
 * every reader who wants the newest thing through two clicks to reach it.
 */
const FIRST_DIRECTION: Record<string, 'asc' | 'desc' | undefined> = {
  seen: 'desc',
  rating: 'desc'
};

/**
 * The address a sort handle points at: the handle you already stand on turns
 * its direction, any other opens at its own first step. Sorting is how the list
 * reads, not what it leaves out, so a reset does not touch it — but it does go
 * back to the first page.
 */
export function sortHref(url: URL, column: string): string {
  const first = FIRST_DIRECTION[column] ?? 'asc';
  const standing = url.searchParams.get('sort') === column;
  const turned = first === 'asc' ? 'desc' : 'asc';
  const dir = standing && url.searchParams.get('dir') === first ? turned : first;
  return withSearchParams(url, { sort: column, dir, page: null });
}

/**
 * Prev/next, built in the `load` from the same function the handles use — the
 * address arithmetic reads the URL and nothing else, so it needs no component
 * around it. Page 1 is elided: the address of the first page is the address of
 * the list.
 */
export function pageHref(url: URL, page: number): string {
  return withSearchParams(url, { page: page > 1 ? String(page) : null });
}
```

## The facets and their counts

- **A facet whose values fit an open listbox is a `Select`; one you would have to scroll to read is a `Combobox`** — `principles.md` draws the line at 7+ options or needing search, and a hundred directors is on the far side of it by a wide margin.
- **The empty value is a value, not a button.** `nullOption` puts "All strands" at the top of the listbox, which is both the empty value and the name of the axis; that is why a facet `Select` needs no `clearable`. A `Combobox` has no `nullOption`, so there `clearable` is the empty value — and `noResultsText` says what was not found.
- **Every option carries its count, as `hint`.** `hint` renders beside the label rather than inside it, and it is part of the row's accessible name, so the row reads "Noir 24". The field is typed as a string on purpose: `String(count)` or an `Intl.NumberFormat` result — which one, and in which locale, is the caller's.
- **The counts are taken over the corpus, not over the current filter.** The corpus is the set the page is about: the axis, and nothing else. Recounting after every click is the other option and it is what most faceted search does; the cost is that every number on the screen moves at every click, and a number that changes as the reader reaches for it stops being a map of what is there and becomes a readout of what they just did. The price of counting over the corpus is that a combination can promise rows and deliver none — which the summary line and an `EmptyState` carrying the reset address have to answer for.

## The axis you stand on is not a filter

A format switch — features · shorts · all — looks like a facet and is not one. It has no empty value, nothing is narrowed by it, and "Reset" must not touch it: a reset that also resets the axis sends the reader to a list they never asked to see.

So it is not in the bar. It stands above it as its own `<nav>` of `Link`s with `active`, which is the `tab-navigation` form with a search param where that pattern has a path segment. Structure carries the rule: a reset that clears the bar cannot reach a strip that is not in it.

The axis strip's addresses are built from the **current** URL, so every facet travels into the other format. Someone who narrowed to a decade and then switches to shorts is looking at that decade's shorts, not at everything.

## The summary line

Under the bar, one line: how many of how many, whatever else is worth a number, and a handle into each thing the view does not show — "+6 on the watchlist →".

It is not decoration. The search field navigates with `keepFocus`, so the reader stays in the field and nothing re-announces; `aria-live="polite"` on this line is the only thing that tells a screen-reader user their typing changed the list. And the handles are the honest answer to a bounded view: the reader asked a question, the page answers it and then says what it left out, as an address they can follow rather than a number they have to interpret.

## Recipe — the bar

The axis strip, the search field, the facets and reset. The bar knows the addresses it writes and nothing about the rows; the counts, the values and the sort addresses arrive as props from the page that ran the query.

```svelte
<script lang="ts">
  import { untrack } from 'svelte';
  import { Button, Combobox, Input, Link, Select } from '@urbicon-ui/blocks';
  import { withSearchParams } from '@urbicon-ui/sveltekit-utils/search-params';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  interface Facet {
    /** The search param this facet owns. */
    param: string;
    /** The axis name. Visible, because a set facet's trigger says only its value. */
    label: string;
    /** The empty value's label — it names the axis too: "All strands". */
    allLabel: string;
    /**
     * `list` fits an open listbox and is a Select; `search` is the facet you
     * would have to scroll to read, and is a Combobox (principles.md: 7+
     * options or needs search).
     */
    kind: 'list' | 'search';
    /** Counted over the corpus, never over the current filter. */
    values: { value: string; label: string; count: number }[];
  }

  let {
    facets,
    sorts,
    formats,
    defaultFormat
  }: {
    facets: Facet[];
    /** Addresses built by `sortHref` — the handle knows where it points, not how. */
    sorts: { label: string; href: string; current: boolean }[];
    /** The axis: features · shorts · all. No empty value, and reset leaves it alone. */
    formats: { label: string; value: string }[];
    /** What the page shows with no format param — elided from the address. */
    defaultFormat: string;
  } = $props();

  /** The step `Combobox` waits before its own server search (`debounceMs` default). */
  const SEARCH_DEBOUNCE_MS = 250;

  const uid = $props.id();
  const facetsId = `${uid}-facets`;

  const currentFormat = $derived(page.url.searchParams.get('format') ?? defaultFormat);
  const filterParams = $derived(['q', ...facets.map((facet) => facet.param)]);
  const isFiltered = $derived(filterParams.some((param) => page.url.searchParams.get(param)));
  const resetHref = $derived(
    withSearchParams(
      page.url,
      Object.fromEntries([...filterParams, 'page'].map((param) => [param, null] as const))
    )
  );

  /** Whether the row is unfolded is a consequence of the viewport, not a setting. */
  let unfolded = $state(false);

  /**
   * The field owns what is typed, the URL owns what is searched. A one-way
   * `value` from the URL would clobber the keystrokes that arrived during the
   * wait: the address lands "noi" while the field already reads "noir", and
   * Svelte writes the shorter string back in. So the field is seeded from the
   * address and re-seeded only where the two genuinely disagree — Back, forward,
   * a link from elsewhere. `untrack` keeps the effect off its own write.
   */
  let typed = $state(page.url.searchParams.get('q') ?? '');
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const fromUrl = page.url.searchParams.get('q') ?? '';
    if (fromUrl !== untrack(() => typed)) typed = fromUrl;
  });

  // An unfired timer outlives the component and navigates from a screen the
  // reader has already left.
  $effect(() => () => clearTimeout(timer));

  const optionsOf = (facet: Facet) =>
    facet.values.map(({ value, label, count }) => ({
      value,
      label,
      // A string, not a number: the locale and the format are the caller's.
      hint: String(count)
    }));

  /** Choosing is a place you went: a push, so Back leaves it. */
  function apply(patch: Record<string, string | null>) {
    goto(withSearchParams(page.url, { ...patch, page: null }));
  }

  /** One handler shape for both control kinds — `null` is the facet's empty value. */
  const choose = (param: string) => (next: string | null) => apply({ [param]: next });

  /** Typing is not: one entry in the history for the whole word. */
  function queueSearch(term: string) {
    typed = term;
    clearTimeout(timer);
    timer = setTimeout(() => {
      goto(withSearchParams(page.url, { q: term.trim() || null, page: null }), {
        replaceState: true,
        keepFocus: true,
        noScroll: true
      });
    }, SEARCH_DEBOUNCE_MS);
  }
</script>

<div class="flex flex-col gap-3">
  <!-- The axis is navigation, not narrowing, so it stands outside the bar: a
       reset that clears the bar cannot reach what is not in it. Each address is
       built from the current URL, so every facet travels into the other format. -->
  <nav aria-label="Format" class="flex gap-4">
    {#each formats as format (format.value)}
      <Link
        variant="standalone"
        href={withSearchParams(page.url, {
          format: format.value === defaultFormat ? null : format.value,
          page: null
        })}
        active={currentFormat === format.value}
        class="font-medium"
      >
        {format.label}
      </Link>
    {/each}
  </nav>

  <search class="flex flex-col gap-3">
    <div class="flex items-end gap-2">
      <Input
        type="search"
        size="sm"
        label="Search"
        class="flex-1"
        value={typed}
        oninput={(event) => queueSearch(event.currentTarget.value)}
      />
      <!-- A disclosure, not an address: pressing it changes nothing about what
           the list shows, so it reports `aria-expanded` and Back never undoes
           it. It is rendered at every width and hidden by CSS, so the handle
           the focus belongs to never disappears out from under it. -->
      <Button
        variant="text"
        size="sm"
        class="sm:hidden"
        aria-expanded={unfolded}
        aria-controls={facetsId}
        onclick={() => (unfolded = !unfolded)}
      >
        Filter
      </Button>
    </div>

    <!-- One class per state rather than `hidden sm:flex` beside `flex`: two
         display utilities on one element are decided by their order in
         Tailwind's sheet, not by the order they are written in here. -->
    <div id={facetsId} class={['flex-wrap items-end gap-3', unfolded ? 'flex' : 'hidden sm:flex']}>
      {#each facets as facet (facet.param)}
        {@const value = page.url.searchParams.get(facet.param)}
        {#if facet.kind === 'search'}
          <Combobox
            size="sm"
            class="w-48"
            label={facet.label}
            options={optionsOf(facet)}
            clearable
            placeholder={facet.allLabel}
            noResultsText="No name like that here"
            {value}
            onValueChange={choose(facet.param)}
          />
        {:else}
          <!-- `nullOption` is the facet's empty value AND the axis's name, which
               is why no `clearable` sits beside it: one way to say "all". -->
          <Select
            size="sm"
            class="w-40"
            label={facet.label}
            options={optionsOf(facet)}
            nullOption={facet.allLabel}
            {value}
            onValueChange={choose(facet.param)}
          />
        {/if}
      {/each}

      <div class="flex items-center gap-4 pb-1.5">
        {#each sorts as sort (sort.href)}
          <Link variant="standalone" href={sort.href} active={sort.current}>{sort.label}</Link>
        {/each}
        <!-- Only while something is set: a permanent "Reset" is a control that
             does nothing most of the time, and the reader learns to skip it. -->
        {#if isFiltered}
          <Link variant="standalone" href={resetHref}>Reset</Link>
        {/if}
      </div>
    </div>
  </search>
</div>
```

## Recipe — the summary line

It reports what the query answered, so it belongs to the page and not to the bar: the bar writes addresses and never sees a row.

```svelte
<script lang="ts">
  import { Link } from '@urbicon-ui/blocks';

  let {
    shown,
    total,
    unit,
    detail,
    elsewhere = []
  }: {
    /** Rows this address selects. */
    shown: number;
    /** Rows the corpus holds — the set the facet counts were taken over. */
    total: number;
    /** The noun the two numbers count: "films", "invoices". */
    unit: string;
    /** Already composed, already localized: "average 3.8 · 32 in cinemas". */
    detail?: string;
    /** What the view does not show, each with the address that would show it. */
    elsewhere?: { label: string; href: string }[];
  } = $props();
</script>

<!-- The search field navigates with `keepFocus`, so nothing re-announces and the
     reader stays where they were typing. This line is the only report they get
     that the list changed underneath them. -->
<p class="text-text-tertiary text-sm" aria-live="polite">
  <span class="tabular-nums">{shown}</span> of <span class="tabular-nums">{total}</span>
  {unit}{#if detail}<span aria-hidden="true" class="text-text-quaternary px-1.5">·</span
    >{detail}{/if}{#each elsewhere as place (place.href)}<span
      aria-hidden="true"
      class="text-text-quaternary px-1.5">·</span
    ><Link href={place.href}>{place.label}<span aria-hidden="true"> →</span></Link>{/each}
</p>
```

## Component Selection

| UI Need                            | Component                                   | Configuration                                                                                                                |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| The bar around the controls        | native `<search>`                           | `role="search"` for free — one landmark instead of a tab run through the row                                                 |
| Free-text narrowing                | `Input` `type="search"` `size="sm"`         | Debounced, `replaceState` — never one address per keystroke                                                                  |
| A facet that fits an open listbox  | `Select` `size="sm"`                        | `nullOption` is the empty value and names the axis; no `clearable` beside it                                                 |
| A facet you would scroll to read   | `Combobox` `size="sm"` `clearable`          | 7+ values or needs search (`principles.md`); `clearable` is its empty value, `noResultsText` says what was not found         |
| The count beside a value           | `SelectOption.hint` / `ComboboxOption.hint` | A string — `String(count)` or an `Intl.NumberFormat` result. Part of the row's accessible name, so "Noir 24" is what is read |
| The axis the page stands on        | `<nav>` + `Link` `active`                   | The `tab-navigation` form, above the bar, with a search param instead of a path segment                                      |
| A sort handle                      | `Link` `variant="standalone"`               | An address: the handle you stand on turns its direction, another opens at its own first step                                 |
| Reset                              | `Link` `variant="standalone"`               | Rendered only while a filter is set; it leaves the axis and the sort alone                                                   |
| Unfolding the facets on a phone    | `Button` `variant="text"` `size="sm"`       | A disclosure — `aria-expanded` + `aria-controls`, rendered at every width and hidden by CSS                                  |
| What the view does not show        | `Link`                                      | One handle per omission, each the address that would show it                                                                 |
| A set facet echoed as a chip       | `Badge` — **no**                            | A badge is not an anchor; see Anti-Patterns                                                                                  |
| Nothing matched                    | `EmptyState`                                | With the reset address as its action — the reader has filtered themselves into a corner and needs the way out                |
| The rows under the summary line    | see `zoned-list`                            | This pattern ends where that one starts                                                                                      |
| Operators, column menus, selection | `Table`                                     | `SmartFilterBar` filters by operator on a column; this bar picks values out of a known set                                   |

## Behavioral Rules

- **Choosing pushes, typing replaces.** A facet, a sort and the axis are places the reader went, so Back is how they leave them. Seven keystrokes are one thought, so the search field writes `replaceState` after a debounce — the same step `Combobox` waits before its own server search (`debounceMs` default) — with `keepFocus` so the field does not lose the cursor mid-word.
- **The field is seeded from the address, not driven by it.** A search input rendered straight from `page.url` loses the letters typed during the debounce, because the address lands one word behind and the value written back is the shorter one. Seed a local value and re-seed it only where the address and the field disagree.
- **Counts are taken over the corpus, not the filter.** Numbers that move at every click cannot be read as "how much is there"; they can only be read as "what did I just do". Where a combination can come back empty, the `EmptyState` carries the reset address.
- **Reset clears the filters and the page. Nothing else.** The axis is where the reader stands and the sort is how they read — neither is something they left out.
- **A facet has one empty value.** `nullOption` on a `Select`, `clearable` on a `Combobox`. Both on one field is two controls for one intent, in the same place.
- **An unreadable value is dropped, not rejected.** A renamed facet, an older deploy's address and a mistyped share link all open the list with that axis wide. An error page for an unknown query param punishes the reader for a change they did not make.
- **The summary line announces.** `keepFocus` means no navigation announcement reaches the reader mid-word; `aria-live="polite"` on the count line is the whole feedback path for a screen-reader user typing in the search field.
- **The fold is not in the address.** Whether the facet row is unfolded is a consequence of a narrow viewport, not a choice about what the list shows — in the URL it would travel to a wide screen and mean nothing there, and Back would undo an unfolding instead of a filter.
- **Every handle whose destination is known in advance is an anchor.** Sort, reset, the axis and the "elsewhere" handles have addresses, so they get history, middle-click, copy-link, prefetch and a status bar for free. Only the listbox facets go through `goto`, and only because a listbox row has nothing to put an `href` on.

## Anti-Patterns

- Do not hold the facet values in `$state` and mirror them into the URL. Two copies of one answer drift within a release, and the one the reader shares is the one that is wrong. Read down from `page.url` where the control renders; there is then nothing to synchronise.
- Do not navigate on every keystroke. Seven history entries for one word means Back stops working as an undo for anything else, and every letter costs a load.
- Do not let the numbers move under the pointer. Recounting the facets over the current filter changes every count on the screen at every click; the count is worth having because it says what is there, and a figure that only reports the last click says nothing the list does not already show.
- Do not let "Reset" reset the axis. Clearing the filters is "show me everything here"; clearing the axis is "take me somewhere else", and the reader asked for the first.
- Do not build the format switch out of `SegmentGroup`. It is a `radiogroup` announcing a chosen value, not a location — and a button that navigates gives up history, middle-click, copy-link and prefetch, which the anchor has for free.
- Do not render the set facets as a row of `Badge`s. A badge is not an anchor: with `onclick` it becomes a `role="button"` tab stop announcing nothing about where it goes, and without one the reader cannot remove the facet at all. A chip that removes a facet is a `Link` to the address without it.
- Do not write the count into the label (`"Noir (24)"`). It is announced as "Noir bracket twenty-four", it is set in the label's own type rather than beside it, and it cannot be aligned across the rows. `hint` is the field for it, on both option types.
- Do not put a permanent "Reset" in the row. A control that does nothing most of the time teaches the reader to skip the place it stands in — including the times it would have helped.
- Do not scroll the facet row sideways to keep it on one line. The facet that goes off-screen is the one the reader forgot they set.
- Do not keep the fold open state in the URL, and do not close the fold on every navigation. The first makes a viewport accident shareable; the second closes the row under the hand that is still using it.

## Related

- Pattern: `zoned-list` — the list under the summary line; this pattern says nothing about the rows
- Pattern: `tab-navigation` — the axis strip is that pattern with a search param where it has a path segment
- Pattern: `inbox-triage` — the screen with no bar at all, because its job is to become empty
- Component: `Input`, `Select`, `Combobox` — the controls; `Link` and `Button` — the handles; `Badge` — the thing a facet chip is not
- Utility: `bindViewToUrl` in `@urbicon-ui/sveltekit-utils` — the URL home of a _table_ view: fixed axes, defaults elided from the address, applied synchronously at init so SSR and Back agree. It is where a list engine would take the facets over; until a view has freely named axes, a facet row builds its own addresses with `withSearchParams`
