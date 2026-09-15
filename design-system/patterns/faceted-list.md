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

- **Structure:** four blocks in this order — the axis strip (`<nav>`), the bar (`<search>`), the summary row, the list. The summary row carries the count on the left and the sort strip on the right. This pattern owns everything above the list and nothing in it; what the rows look like is `zoned-list`.
- **The bar is a `<search>` landmark**, not a `<div>`. It maps to `role="search"`, so the controls that narrow the list are one landmark jump away instead of a tab run — and the element says what the group is for, which no class can.
- **Sorting is not narrowing, so it is not in the bar.** It is how the list reads, not what it leaves out, and a reader jumping to the search landmark is looking for what to cut — so the sort strip is its own `<nav aria-label="Sort">` in the summary row, beside the count it reorders.
- **The facets wrap; they never scroll sideways.** `flex flex-wrap`, and the row grows a line. A horizontal scroller puts a set facet off-screen, and a filter the reader cannot see is a filter they cannot undo.
- **`size="sm"` across the row, every control.** The bar is a setting for the list, not a form on top of it, and one step under the form default is what says so. Mixing sizes across the row is worse than either choice: the row then has no baseline for its labels and its triggers to align to.
- **Every facet keeps its visible label.** Once a facet is set its trigger says only its value — "Noir 24" names no axis. The reader who cannot see which axis that narrows cannot undo it, and `nullOption`'s "All strands" is gone from the screen exactly when it was needed.
- **Search and "Reset" on the first line, the facets under them.** Below `sm` the facets fold behind one handle; the search field and "Reset" stay. Those two are the controls that need no knowledge of the data — one takes any text, the other undoes everything — so they are the pair worth the width.
- **A fold says how much it is hiding.** A handle labelled only "Filter" conceals exactly what the reader needs to know: that something is set. It carries the number of set facets in its own name ("Filter · 2"), and "Reset" stays outside it, or a narrow screen can hold a filtered list with no visible way out.

## The URL is the only state

Every facet value, the search text, the sort and the page live in `?query`. Nothing mirrors them.

- **Read down, once.** A facet's value is read from the address where the query is built — tolerantly, by `readFacet` — and handed to the control. The bar does not read the address a second time: a control fed straight from `page.url.searchParams.get(param)` shows the library's own "Select…" placeholder for a value the facet no longer knows, while the list beside it is unfiltered. Read in one place and the trigger cannot disagree with the rows.
- **Write up.** A handle whose value is known in advance is a `Link` carrying the address `withSearchParams` builds — sort, reset, the axis. A listbox has no address to give an anchor, so a `Select` or `Combobox` writes through `goto` on `onValueChange`, and that is a push: choosing a facet is somewhere you went, and Back is how you leave it.
- **Every navigation keeps the focus where the reader put it.** SvelteKit resets focus to `<body>` when a navigation settles unless it is told not to, so a facet pick writes `goto(href, { keepFocus: true })` and every handle that is still on screen afterwards carries `data-sveltekit-keepfocus`. Without it each pick drops a keyboard reader at the top of the document, and narrowing a list by three facets means three trips back through the bar.
- **The first write of a typing run pushes; the rest replace.** `replaceState` adds no history entry — it overwrites the one the reader arrived on — so a field that always replaces makes Back leave the page instead of returning to the unfiltered list. Pushing once, when the query goes from empty to non-empty, and replacing on every later keystroke costs the whole run one entry and keeps Back pointing at the list they started from.
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
 *
 * The `load` calls this to build its query and passes the result down to the
 * bar, so the trigger shows what the rows were actually filtered by.
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
 *
 * `defaultSort` is the column the list is ordered by with no `sort` param, and
 * it is load-bearing: without it the first click on the column the list already
 * sorts by re-states the direction it already has, and nothing moves. It takes
 * no direction of its own — the unsorted list must open that column at its
 * `FIRST_DIRECTION` step, or the handle's first click turns away from what the
 * reader is looking at. Keep the `load`'s default ordering reading from this
 * same table rather than naming a direction twice.
 */
export function sortHref(url: URL, column: string, defaultSort: string): string {
  const first = FIRST_DIRECTION[column] ?? 'asc';
  const turned = first === 'asc' ? 'desc' : 'asc';
  const standing = (url.searchParams.get('sort') ?? defaultSort) === column;
  // Standing on a column with no `dir` in the address means it is showing that
  // column's first step, so the click turns it.
  const showing = standing ? (url.searchParams.get('dir') ?? first) : null;
  return withSearchParams(url, {
    sort: column,
    dir: showing === first ? turned : first,
    page: null
  });
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
- **The counts are taken over the corpus, not over the current filter.** The corpus is the set the page is about: the axis, and nothing else. Recounting after every click is the other option and it is what most faceted search does; the cost is that every number on the screen moves at every click, and a number that changes as the reader reaches for it stops being a map of what is there and becomes a readout of what they just did. The price of counting over the corpus is that a combination can promise rows and deliver none — which the summary row and an `EmptyState` carrying the reset address have to answer for.

## The axis you stand on is not a filter

A format switch — features · shorts · all — looks like a facet and is not one. It has no empty value, nothing is narrowed by it, and "Reset" must not touch it: a reset that also resets the axis sends the reader to a list they never asked to see.

So it is not in the bar. It stands above it as its own `<nav>` of `Link`s with `active`, which is the `tab-navigation` form with a search param where that pattern has a path segment. Structure carries the rule: a reset that clears the bar cannot reach a strip that is not in it.

The axis strip's addresses are built from the **current** URL, so every facet travels into the other format. Someone who narrowed to a decade and then switches to shorts is looking at that decade's shorts, not at everything.

## The summary row

Under the bar, one row: on the left how many of how many, whatever else is worth a number, and a handle into each thing the view does not show — "+6 on the watchlist →". On the right, the sort strip.

**What a screen reader hears, and what it costs.** Every client-side navigation — the debounced search write included — makes SvelteKit put the new `document.title` into `#svelte-announcer`, which is `aria-live="assertive"`. That announcement interrupts, and while someone is typing it can fire once per debounce. It fires only while the title actually **changes**, though: the announcer renders `{#if navigated}{title}{/if}`, and a text node that comes back the same is not announced again. Nor does the first render count — the announcer only starts watching after mount, so a page nobody has navigated within announces nothing at all. That is the whole lever. Keep the query and the result count **out of the `<title>`** and a whole typing run costs one announcement, at its first debounced write; put them in, and every pause after that reads the reader's own letters back at them over whatever they were listening to. Then put `aria-live="polite"` on the count itself, so the result arrives without interrupting. The cost the pattern carries is that navigating while someone types is an assertive channel at all — a title that varies with the query turns it into one announcement per pause, and keeping it stable is what buys the addressability back.

## Recipe — the bar

The axis strip, the search field, "Reset" and the facets. The bar knows the addresses it writes and nothing about the rows; the counts and each facet's current value arrive as props from the page that ran the query.

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
    /**
     * What the list was actually filtered by — `readFacet` dropped an unknown
     * value where the query was built. Read there and passed down rather than
     * re-read here, so the trigger cannot disagree with the rows.
     */
    value: string | null;
    /** Counted over the corpus, never over the current filter. */
    values: { value: string; label: string; count: number }[];
  }

  let {
    facets,
    formats,
    defaultFormat
  }: {
    facets: Facet[];
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
  const setFacets = $derived(facets.filter((facet) => facet.value !== null).length);

  // "Is anything set" asks the address, not the read values: a value this
  // deploy no longer knows still sits in the URL, and Reset is what clears it.
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

  /** The address carries the trimmed term, so every comparison against it is trimmed too. */
  const normalize = (term: string) => term.trim();

  /**
   * The field owns what is typed, the URL owns what is searched. A one-way
   * `value` from the URL would clobber the keystrokes that arrived during the
   * wait, so the field is seeded from the address and re-seeded only where the
   * two genuinely disagree — Back, forward, a link from elsewhere.
   *
   * The comparison has to be normalized on BOTH sides, because the write is:
   * after "film " the address holds "film", and a raw comparison reads that as
   * a disagreement and rewrites "film" under the caret — the next word then
   * lands as "filmnoir". `untrack` keeps the effect off its own write.
   */
  let typed = $state(page.url.searchParams.get('q') ?? '');
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const fromUrl = page.url.searchParams.get('q') ?? '';
    if (fromUrl !== normalize(untrack(() => typed))) typed = fromUrl;
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

  /**
   * Choosing is a place you went: a push, so Back leaves it. `keepFocus` is not
   * optional — SvelteKit resets focus to `<body>` when the navigation settles,
   * and without it every pick drops a keyboard reader at the top of the page.
   */
  function apply(patch: Record<string, string | null>) {
    goto(withSearchParams(page.url, { ...patch, page: null }), { keepFocus: true });
  }

  /** One handler shape for both control kinds — `null` is the facet's empty value. */
  const choose = (param: string) => (next: string | null) => apply({ [param]: next });

  function queueSearch(term: string) {
    typed = term;
    clearTimeout(timer);
    timer = setTimeout(() => {
      goto(withSearchParams(page.url, { q: normalize(term) || null, page: null }), {
        // The run's first write pushes so Back returns to the unfiltered list;
        // every later one replaces, so a word costs one entry rather than one
        // per letter. Always replacing would overwrite the entry the reader
        // arrived on, and Back would leave the page.
        replaceState: (page.url.searchParams.get('q') ?? '') !== '',
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
        data-sveltekit-keepfocus
        class="font-medium"
      >
        {format.label}
      </Link>
    {/each}
  </nav>

  <search class="flex flex-col gap-3">
    <div class="flex items-end gap-3">
      <Input
        type="search"
        size="sm"
        label="Search"
        class="flex-1"
        value={typed}
        oninput={(event) => queueSearch(event.currentTarget.value)}
      />
      <!-- Outside the fold: a narrow screen that can hold a filtered list must
           hold the way out of it too. Only while something is set — a control
           that does nothing most of the time teaches the reader to skip it. -->
      {#if isFiltered}
        <Link variant="standalone" href={resetHref} data-sveltekit-keepfocus>Reset</Link>
      {/if}
      <!-- A disclosure, not an address: pressing it changes nothing about what
           the list shows, so it reports `aria-expanded` and Back never undoes
           it. The count is plain text, so it is part of the button's own
           accessible name. A chip here would be `Badge purpose="counter"`,
           which renders no role; a bare `<Badge>` defaults to `role="status"`,
           and a live region inside a control is not what this is. -->
      <Button
        variant="text"
        size="sm"
        class="sm:hidden"
        aria-expanded={unfolded}
        aria-controls={facetsId}
        onclick={() => (unfolded = !unfolded)}
      >
        Filter{setFacets > 0 ? ` · ${setFacets}` : ''}
      </Button>
    </div>

    <!-- One class per state: which of two competing display utilities wins is
         decided by where they sit in Tailwind's sheet, not by the order they
         are written here, so the row names its display once instead of resting
         on that order. -->
    <div id={facetsId} class={['flex-wrap items-end gap-3', unfolded ? 'flex' : 'hidden sm:flex']}>
      {#each facets as facet (facet.param)}
        {#if facet.kind === 'search'}
          <Combobox
            size="sm"
            class="w-48"
            label={facet.label}
            options={optionsOf(facet)}
            clearable
            placeholder={facet.allLabel}
            noResultsText="No name like that here"
            value={facet.value}
            onValueChange={choose(facet.param)}
          />
        {:else}
          <!-- `nullOption` is the facet's empty value AND the axis's name, which
               is why no `clearable` sits beside it: one way to say "all". A
               value this deploy no longer knows arrived here as `null`, so the
               trigger reads "All strands" rather than the library's own
               placeholder. -->
          <Select
            size="sm"
            class="w-40"
            label={facet.label}
            options={optionsOf(facet)}
            nullOption={facet.allLabel}
            value={facet.value}
            onValueChange={choose(facet.param)}
          />
        {/if}
      {/each}
    </div>
  </search>
</div>
```

## Recipe — the summary row

It reports what the query answered, so it belongs to the page and not to the bar: the bar writes addresses and never sees a row. The sort strip rides along on the right — sorting reorders what this line counts, and it is not something the reader left out.

```svelte
<script lang="ts">
  import { Link } from '@urbicon-ui/blocks';

  let {
    shown,
    total,
    unit,
    detail,
    sorts,
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
    /** Addresses built by `sortHref` — the handle knows where it points, not how. */
    sorts: { key: string; label: string; href: string; current: boolean }[];
    /** What the view does not show, each with the address that would show it. */
    elsewhere?: { label: string; href: string }[];
  } = $props();
</script>

<div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
  <!-- Polite, and after SvelteKit's assertive title announcement: the result
       arrives without interrupting whatever the reader is still hearing. -->
  <p class="text-text-tertiary text-sm" aria-live="polite">
    <span class="tabular-nums">{shown}</span> of <span class="tabular-nums">{total}</span>
    {unit}{#if detail}<span aria-hidden="true" class="text-text-quaternary px-1.5">·</span
      >{detail}{/if}{#each elsewhere as place (place.href)}<span
        aria-hidden="true"
        class="text-text-quaternary px-1.5">·</span
      ><Link href={place.href}>{place.label}<span aria-hidden="true"> →</span></Link>{/each}
  </p>

  <!-- Keyed by the column, not the href: an href changes on every navigation,
       so keying on it rebuilds the whole strip each time. `font-medium` sits on
       every handle, not only the current one, so the strip does not reflow
       under the pointer when the sort changes. -->
  <nav aria-label="Sort" class="flex gap-4 text-sm">
    {#each sorts as sort (sort.key)}
      <Link
        variant="standalone"
        href={sort.href}
        active={sort.current}
        data-sveltekit-keepfocus
        class="font-medium"
      >
        {sort.label}
      </Link>
    {/each}
  </nav>
</div>
```

## Component Selection

| UI Need                            | Component                                   | Configuration                                                                                                                |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| The bar around the controls        | native `<search>`                           | `role="search"` for free — one landmark instead of a tab run through the row                                                 |
| Free-text narrowing                | `Input` `type="search"` `size="sm"`         | Debounced; the run's first write pushes, the rest replace; `keepFocus` throughout                                            |
| A facet that fits an open listbox  | `Select` `size="sm"`                        | `nullOption` is the empty value and names the axis; no `clearable` beside it                                                 |
| A facet you would scroll to read   | `Combobox` `size="sm"` `clearable`          | 7+ values or needs search (`principles.md`); `clearable` is its empty value, `noResultsText` says what was not found         |
| The count beside a value           | `SelectOption.hint` / `ComboboxOption.hint` | A string — `String(count)` or an `Intl.NumberFormat` result. Part of the row's accessible name, so "Noir 24" is what is read |
| The axis the page stands on        | `<nav>` + `Link` `active`                   | The `tab-navigation` form, above the bar, with a search param instead of a path segment                                      |
| The sort strip                     | `<nav aria-label="Sort">` + `Link`          | In the summary row, not the bar — sorting is not narrowing. `font-medium` on every handle so the strip does not reflow       |
| Reset                              | `Link` `variant="standalone"`               | Beside the search field, outside the fold; rendered only while a filter is set; it leaves the axis and the sort alone        |
| Unfolding the facets on a phone    | `Button` `variant="text"` `size="sm"`       | A disclosure — `aria-expanded` + `aria-controls`, and the number of set facets in its own name                               |
| What the view does not show        | `Link`                                      | One handle per omission, each the address that would show it                                                                 |
| A set facet echoed as a chip       | `Badge` — **no**                            | A badge is not an anchor; see Anti-Patterns                                                                                  |
| Nothing matched                    | `EmptyState`                                | With the reset address as its action — the reader has filtered themselves into a corner and needs the way out                |
| The rows under the summary row     | see `zoned-list`                            | This pattern ends where that one starts                                                                                      |
| Operators, column menus, selection | `Table`                                     | `SmartFilterBar` filters by operator on a column; this bar picks values out of a known set                                   |

## Behavioral Rules

- **Choosing pushes; a typing run pushes once and then replaces.** A facet, a sort and the axis are places the reader went. Typing is one thought, so the first write that turns an empty query into a non-empty one pushes and every later keystroke replaces — the run costs one history entry and Back returns to the unfiltered list. A field that only ever replaces overwrites the entry the reader arrived on, and Back leaves the page.
- **Every write keeps the focus.** `goto(href, { keepFocus: true })` for the listbox facets and the search field, `data-sveltekit-keepfocus` on the handles that are still on screen after the navigation. SvelteKit resets focus to `<body>` when a navigation settles otherwise, and a bar that loses focus on every pick makes narrowing by three facets three trips back through the tab order.
- **The field is seeded from the address, not driven by it — and the comparison is normalized on both sides.** The debounce writes the trimmed term, so comparing the address against the raw field makes the field's own write look like a disagreement and rewrites the trimmed value under the caret. Compare what was written to what would be written.
- **The value the control shows is the value the query used.** Read the facet once, tolerantly, where the query is built; hand the result to the control. A control fed from the address directly shows its own placeholder for a value the facet no longer knows, beside rows that were never filtered by it.
- **Counts are taken over the corpus, not the filter.** Numbers that move at every click cannot be read as "how much is there"; they can only be read as "what did I just do". Where a combination can come back empty, the `EmptyState` carries the reset address.
- **Reset clears the filters and the page. Nothing else.** The axis is where the reader stands and the sort is how they read — neither is something they left out.
- **A facet has one empty value.** `nullOption` on a `Select`, `clearable` on a `Combobox`. Both on one field is two controls for one intent, in the same place.
- **An unreadable value is dropped, not rejected.** A renamed facet, an older deploy's address and a mistyped share link all open the list with that axis wide. An error page for an unknown query param punishes the reader for a change they did not make.
- **Keep the query and the count out of the `<title>`.** SvelteKit writes the title into an assertive live region on every navigation, and it is spoken whenever that text changes — so a title carrying what the reader typed reads it back at them on every pause, while a stable one costs the whole typing run a single announcement, at its first write. Landing on the page announces nothing either way — the announcer only starts watching after mount. The polite count in the summary row is where the result belongs.
- **The fold is not in the address, and it says how much it hides.** Whether the facet row is unfolded is a consequence of a narrow viewport — in the URL it would travel to a wide screen and mean nothing there. But a handle that hides set facets has to name how many, and "Reset" belongs outside it.
- **Every handle whose destination is known in advance is an anchor.** Sort, reset, the axis and the "elsewhere" handles have addresses, so they get history, middle-click, copy-link, prefetch and a status bar for free. The listbox facets and the search field go through `goto`, because a listbox row and a text field have nothing to hang an `href` on.

## Anti-Patterns

- Do not hold the facet values in `$state` and mirror them into the URL. Two copies of one answer drift within a release, and the one the reader shares is the one that is wrong.
- Do not hand `page.url.searchParams.get(param)` straight to the control either. That is the same drift from the other side: the address can hold a value the facet no longer knows, and the control then shows "Select…" beside rows nothing filtered. Read it once with `readFacet` where the query is built.
- Do not navigate on every keystroke. Every letter costs a load, and — wherever the title varies with the query — an assertive announcement at a reader who is still typing.
- Do not let the numbers move under the pointer. Recounting the facets over the current filter changes every count on the screen at every click; the count is worth having because it says what is there, and a figure that only reports the last click says nothing the list does not already show.
- Do not let "Reset" reset the axis. Clearing the filters is "show me everything here"; clearing the axis is "take me somewhere else", and the reader asked for the first.
- Do not build the format switch out of `SegmentGroup`. It is a `radiogroup` announcing a chosen value, not a location — and a button that navigates gives up history, middle-click, copy-link and prefetch, which the anchor has for free.
- Do not render the set facets as a row of `Badge`s. A badge is not an anchor: with `onclick` it becomes a `role="button"` tab stop announcing nothing about where it goes, and without one the reader cannot remove the facet at all. A chip that removes a facet is a `Link` to the address without it.
- Do not write the count into the label (`"Noir (24)"`). It is announced as "Noir bracket twenty-four", it is set in the label's own type rather than beside it, and it cannot be aligned across the rows. `hint` is the field for it, on both option types.
- Do not put the sort strip in the `<search>` landmark. A reader jumping to that landmark is looking for what to cut from the list, and sorting cuts nothing.
- Do not label the fold "Filter" alone, and do not fold "Reset" away with the facets. A narrow screen then holds a filtered list whose filters and whose way out are both behind a handle that admits to neither.
- Do not key the sort handles on their `href`. Every navigation rewrites every sort address, so an href key rebuilds the whole strip on every click.
- Do not let `active` be the only thing that sets a handle's weight. The strip reflows under the pointer as the current handle gains `font-medium`; put the weight on every handle and let colour carry the current one.
- Do not scroll the facet row sideways to keep it on one line. The facet that goes off-screen is the one the reader forgot they set.

## Related

- Pattern: `zoned-list` — the list under the summary row; this pattern says nothing about the rows
- Pattern: `tab-navigation` — the axis strip is that pattern with a search param where it has a path segment
- Pattern: `inbox-triage` — the screen with no bar at all, because its job is to become empty
- Component: `Input`, `Select`, `Combobox` — the controls; `Link` and `Button` — the handles; `Badge` — the thing a facet chip is not
- Utility: `bindViewToUrl` in `@urbicon-ui/sveltekit-utils` — the URL home of a _table_ view: fixed axes, defaults elided from the address, applied synchronously at init so SSR and Back agree. It is where a list engine would take the facets over; until a view has freely named axes, a facet row builds its own addresses with `withSearchParams`
