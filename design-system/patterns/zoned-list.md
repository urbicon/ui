# Zoned List

A screen of labelled zones, each a short list whose rows share one anatomy — marker · key column · content · exactly one thing on the right.

## When to Use

Use this pattern when:

- The screen groups items into a few fixed zones — what I act on, what waits for me, what moved — and each zone is a short list rather than a dataset
- Every row carries the same kind of thing to read and the same kind of thing to do, so the eye learns the columns once and reads every zone with them
- Rows act in place or lead somewhere; nobody sorts, filters, pages or selects across them

Do NOT use when:

- The list is a dataset someone sorts, filters, groups, pages or selects across — that is `Table`, and its header row is the point
- The items belong to dates — that is `Planner` and the `planning-board` pattern
- The zones are places to navigate to rather than parts of one screen — those are `tab-navigation` (a URL per section) or `Sidebar`

## Layout

- **Structure:** `<main>` with one `<section>` per zone, each labelled by its own eyebrow heading (`aria-labelledby`), each holding one `<ul role="list">`.
- **The zone order is a decision, not a setting.** It is the dramaturgy of the screen: what I act on, then what waits, then what moved. Zones that can be reordered leave nothing to read in the order.
- **An empty zone disappears; it never shows "0".** A zone that stays behind as a counter is a scoreboard. Two exceptions earn their place: a zone that carries the way in (the capture row) and a zone that answers in a sentence ("Nothing since yesterday.") — a zero says only that the number is small.
- **Air goes between zones, not between rows.** Rows sit flush against each other and carry their own height; `gap-8`–`gap-10` between sections, one small step between an eyebrow and its first row. Two vertical rhythms — one between rows, one between zones — read as two lists.
- **The height lives in `min-h-*` on the row, never in padding — and it is a floor, not a cap.** Three steps carry most screens: ~44 px for a zone you work in, ~32 px for a long list you still act on, ~28 px for one you only skim. A row whose title runs long grows past its floor and the rest keep the rhythm; a padding-driven height comes apart the moment a row gains its second line.
- **A child row is one indent step, and the indent is an edge.** The step is the marker plus its gap — 16 px + 14 px = 30 px, `pl-7.5` — so the child's marker lands on the parent's key column, or on its content where the screen has no key column. That is what makes the grouping read without a line, a box or a tint.
- **Lines only where the heights differ.** A list of near-equal rows separates by rhythm alone; a flowing list (anatomy B) needs the `border-border-hairline` divider, because its rows are genuinely different heights.

## The row anatomy

One anatomy per screen, four slots, always in this order:

| Slot                       | What it carries                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marker**                 | one glyph or mark saying what state the row is in — as a control (~16 px, it carries the row's primary action) or as a display (~72 px, a rating, a priority) |
| **Key column** (~80 px)    | the coarsest key the eye files the row under: its parent record, its date, its source. Optional — drop it (and only it) where every row would repeat one word |
| **Content** (flexible)     | the thing itself, plus an optional second line: origin, next step, time                                                                                       |
| **One thing on the right** | one fact **or** one action. Two side by side are a question the reader did not ask                                                                            |

A variant changes **one measure or one column** — density, indent, the key column, whether the second line wraps. It never moves a slot or changes the side the one thing sits on. A screen that needs a second row layout has two lists on it, and the eye pays for both.

## Two anatomies, six axes

Both anatomies are the same sentence; they take the opposite decision on six axes, and the six come as a set — pick a column, not one cell from each.

| Axis                       | **A — the fixed row**                                                            | **B — the flowing row**                                               |
| -------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Marker                     | a control — ~16 px, centred, carrying the row's primary action                   | a display — ~72 px, top-aligned (a rating, a priority, a state)       |
| Height                     | a fixed _minimum_ (`min-h-*`); a row grows only when its title wraps             | variable by nature, up to about four lines                            |
| Alignment                  | `items-center` — the key column sits between both lines                          | `items-start` — every column hangs from the first line                |
| Activation                 | `tabindex` + a keydown handler; every click target is a named control in the row | the title is a link whose `::after` covers the row                    |
| The one thing on the right | an action, revealed on hover/focus                                               | a fact, always visible, wrapping under the content on a narrow screen |
| Key column                 | present — every row is filed under something                                     | absent — the title is the key                                         |

**A is a workbench:** the reader stays on the screen and acts row by row, so the row is worth a focus stop and the right-hand slot is worth an action. **B is a catalogue:** every row leads to a page and the row's own parts lead further, so the row is a link and the right-hand slot is a fact you read in the list.

**What A costs.** A focusable `<li>` announces no role, so it is a _waypoint_ for the list's keyboard path, not a control: **do not hang the click on the row**. Every action is a named control inside it — the title is the handle that opens the item — and the row's Enter is a shortcut for the same action. Space stays with whatever holds the focus, so a button inside the row still activates the way a button does. The row is also not a link: no middle-click, no copy-link, no prefetch, no URL in the status bar. And it is one more tab stop per row on top of its controls — a list you page through with `j`/`k` can take the inner handles out of the tab order (`tabindex={-1}`) and keep the row as the single stop.

**What B costs.** The title's overlay lies over the row's text, so a mouse drag across it starts a link drag instead of a selection, and every inner handle has to come after the title in the tree (see the recipe).

### Recipe A — the fixed row

```svelte
<script lang="ts">
  import { Button, CircleIcon } from '@urbicon-ui/blocks';

  interface Item {
    id: string;
    title: string;
    /** The coarsest key: parent record, date, source. */
    key: string;
    /** The second line — origin, next step, time. One line; it truncates. */
    meta?: string;
    /** The fact at rest on the right. */
    size?: string;
    child?: boolean;
  }

  let {
    items,
    onOpen,
    onComplete,
    onDrop
  }: {
    items: Item[];
    onOpen: (id: string) => void;
    onComplete: (id: string) => void;
    onDrop: (id: string) => void;
  } = $props();

  const uid = $props.id();
  const labelId = `${uid}-zone`;

  // Enter on the row is a shortcut for the title's own control. The target
  // check is what keeps it a shortcut: an Enter meant for a button inside the
  // row must reach that button, not be swallowed here.
  function onRowKey(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' || event.target !== event.currentTarget) return;
    event.preventDefault();
    onOpen(id);
  }
</script>

<section aria-labelledby={labelId}>
  <h2 id={labelId} class="text-text-tertiary pl-7.5 text-xs font-medium tracking-wide uppercase">
    Today
  </h2>

  <!-- Removing the bullets removes the list semantics in Safari; `role="list"`
       puts them back. -->
  <ul role="list" class="mt-3">
    {#each items as item (item.id)}
      <!-- The row is a focus waypoint for the list's keyboard path, not a
           control: it carries no click handler, and everything clickable in it
           is a named button. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <li
        tabindex="0"
        class={[
          'group flex min-h-11 items-center',
          'focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none',
          item.child && 'pl-7.5'
        ]}
        onkeydown={(event) => onRowKey(event, item.id)}
      >
        <!-- `--blocks-touch-target-min` is 44 px on a coarse pointer and 0 on a
             fine one, so the floor costs the desktop layout nothing. -->
        <button
          type="button"
          class="text-text-quaternary hover:text-text-primary focus-visible:ring-primary/50 flex min-h-[var(--blocks-touch-target-min)] w-4 min-w-[var(--blocks-touch-target-min)] shrink-0 items-center justify-center focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Complete {item.title}"
          onclick={() => onComplete(item.id)}
        >
          <CircleIcon size={13} />
        </button>

        <span class="text-text-tertiary ml-3.5 w-20 shrink-0 truncate text-xs">{item.key}</span>

        <div class="ml-3.5 min-w-0 flex-1">
          <!-- The title is the named control that opens the item, and it wraps:
               the row's minimum height gives way before the title does. -->
          <button
            type="button"
            class="text-text-primary focus-visible:ring-primary/50 block w-full text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
            onclick={() => onOpen(item.id)}
          >
            {item.title}
          </button>
          {#if item.meta}
            <p class="text-text-tertiary m-0 truncate text-xs">{item.meta}</p>
          {/if}
        </div>

        <!-- One slot, two states: the fact at rest, the action once the row is
             hovered or focused — and permanently where there is no pointer to
             hover with. -->
        <div class="ml-4 shrink-0 text-xs">
          <span
            class="text-text-tertiary group-focus-within:hidden group-hover:hidden pointer-coarse:hidden"
          >
            {item.size}
          </span>
          <Button
            variant="text"
            intent="neutral"
            size="2xs"
            class="hidden min-h-[var(--blocks-touch-target-min)] group-focus-within:inline-flex group-hover:inline-flex pointer-coarse:inline-flex"
            onclick={() => onDrop(item.id)}
          >
            Let go
          </Button>
        </div>
      </li>
    {/each}
  </ul>
</section>
```

### Recipe B — the row as a link

The whole row leads to the item, and the things inside it lead somewhere else. That cannot be one big `<a>`: a link inside a link is invalid HTML and unusable in every browser. The title is the link, its `::after` covers the row, and each inner handle is `relative` — three utilities, no CSS class, because a class would carry only the middle third of the trick.

Positioned elements without a `z-index` paint in **tree order**, so the handles have to stand _after_ the title in the tree. Move the title below them and the overlay covers them: they stay focusable, and stop being clickable.

```svelte
<script lang="ts">
  interface Row {
    id: string;
    title: string;
    /** The display marker — a rating, a priority, a state. Not a control. */
    mark: string;
    year: number;
    author: string;
    /** The always-visible fact on the right. */
    seenAt: string;
  }

  let { rows, authorHref }: { rows: Row[]; authorHref: (author: string) => string } = $props();
</script>

<ul role="list">
  {#each rows as row (row.id)}
    <!-- `relative` makes the row the containing block for the title's overlay.
         `items-start`: every column hangs from the first line, because the
         content column is the only one that grows. Two columns on a phone,
         three from `sm` up — the right-hand fact wraps under the content
         instead of squeezing the title into four lines. -->
    <li
      class="group border-border-hairline hover:bg-surface-hover focus-within:bg-surface-hover relative grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-4 border-b px-3 py-3.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_8rem]"
    >
      <!-- The marker is a display here, not a handle: it says which list you
           are in, and it is read, not pressed. -->
      <span class="text-text-tertiary pt-1 text-xs tabular-nums">{row.mark}</span>

      <div class="min-w-0">
        <h3 class="m-0 text-base leading-tight font-medium">
          <a
            href="/items/{row.id}"
            class="text-text-primary focus-visible:ring-primary/50 rounded-xs after:absolute after:inset-0 focus-visible:ring-2 focus-visible:outline-none"
          >
            {row.title}
          </a>
        </h3>

        <!-- Flowing text, not a flex chain: a separator that is its own flex
             child lands at the start of the next line when the row wraps. -->
        <p class="text-text-tertiary m-0 text-xs">
          <span class="tabular-nums">{row.year}</span><span
            aria-hidden="true"
            class="text-text-quaternary px-1.5">·</span
          ><a
            href={authorHref(row.author)}
            class="hover:text-text-secondary focus-visible:ring-primary/50 relative rounded-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >{row.author}</a
          >
        </p>
      </div>

      <span
        class="text-text-tertiary col-start-2 mt-1 text-xs tabular-nums sm:col-start-3 sm:row-start-1 sm:mt-0 sm:text-right"
      >
        {row.seenAt}
      </span>
    </li>
  {/each}
</ul>
```

## The eyebrow label

The zone heading is a typographic decision, not a component — the library ships no semantic type layer, so it is one string, written once and reused. It is the same string the `page-header` recipe uses, and that is the point: one label look for the whole product.

```
text-text-tertiary text-xs font-medium tracking-wide uppercase
```

Three things are load-bearing in it. `text-text-tertiary` is the quietest ink the token contract still holds to AA for text; `text-text-quaternary` is held only to the 3:1 UI floor and promises nothing across themes — it is for marks, not for labels. `text-xs` is the smallest step of Tailwind's scale that carries a paired line-height, so the label's box follows its size; the library's own sub-xs steps (`--text-2xs`, `--text-3xs`) are deliberately size-only, and a label set in one of them keeps whatever leading it inherits from the cascade. And the tracking is what makes a small uppercase word legible at all.

Indent it onto the column it heads (the key column, not the marker), and give the `<section>` `aria-labelledby` pointing at it. Where the rows below have no marker column, drop the indent — the label aligns to what stands under it, or it is decoration.

## Component Selection

| UI Need                             | Component                              | Configuration                                                                                          |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| The zone heading                    | native `h2`                            | The eyebrow string above; `aria-labelledby` on the `<section>`                                         |
| The row                             | markup — `<li>` plus flex or grid      | The library ships no `ListRow`: the six axes are a screen decision, not a prop                         |
| The marker as a control             | an icon in a `<button>`                | Direct import (`CircleIcon`, `CheckCircleIcon`); `aria-label` naming the row it acts on                |
| The marker as a display             | plain text or an icon                  | No handle, no title attribute — it is read, not pressed                                                |
| The one thing on the right (action) | `Button` `variant="text"` `size="2xs"` | Ink, not a filled control — it sits in a row, not on a toolbar                                         |
| The one thing on the right (fact)   | plain text                             | `text-text-tertiary`, `tabular-nums` for numbers so the column does not jitter                         |
| A category or state on the row      | `Badge`                                | One, and only where the second line cannot say it in words                                             |
| The whole screen is empty           | `EmptyState`                           | For the screen, never per zone — an empty zone disappears                                              |
| Loading                             | `Skeleton`                             | Rows at the zone's own height, so nothing reflows when data lands                                      |
| It is a dataset after all           | `Table`                                | Sorting, filtering, grouping, selection — the moment one of those is needed, this is the wrong pattern |

## Behavioral Rules

- **What opens under a row is more rows, not a panel.** An inline editor, a set of choices, a detail line — same anatomy, no card, no frame, no extra gap. A card or a panel that opens inside a list is a second language on the screen.
- **One thing open at a time**, and Escape closes it, putting focus back on the control that opened it. A control that is removed while its panel is open cannot take that focus back — keep it rendered and let it toggle.
- **A hover-only action does not exist on a phone.** Every `group-hover:` reveal needs `group-focus-within:` beside it for the keyboard and a `pointer-coarse:` rule for touch — where there is no pointer, the action stays put and the fact beside it gives way. A row's controls are small by design, so give them the library's floor: `min-h-[var(--blocks-touch-target-min)]` is 44 px on a coarse pointer and 0 on a fine one.
- **The row is a waypoint, its controls are the controls.** In anatomy A no click handler goes on the row itself; the row's keydown handles Enter and ignores an Enter meant for a control inside it (`event.target === event.currentTarget`), and Space is left to whatever holds the focus.
- **Truncate the second line, never the title.** The title is the thing; the second line is the note beside it. A long title wraps, and the row grows past its minimum height while every other row keeps it — one tall row reads as an exception, a `…` reads as a defect.
- **Writes report themselves in place.** The new value appears where it stood, optionally with a brief settle tint; a toast per row edit turns a list you work in into a stream of notifications.
- **Keep the accessible list intact.** A zone is `role="list"` and only `role="listitem"` may sit directly inside it; what belongs to a row (its inline editor, its detail line) belongs _in_ that row's item, not next to it.

## Anti-Patterns

- Do not give one zone its own row layout. The whole value of the screen is that the columns are learned once; a second anatomy costs the reader more than the zone can pay back.
- Do not hang the row's action on the row element. A `<div>` with an `onclick` is a control no screen reader announces and no keyboard reaches — put the action on the title or the marker, and let the row's Enter call the same function.
- Do not put two actions in the right-hand slot. Pick the one this place is for, and let the second appear on hover, on focus and on touch _beside_ it — never in its place.
- Do not put a counter in the eyebrow ("3 cards"). The zone shows what is there; how much it is, the reader can see.
- Do not build the row out of `Card`. A card is a conceptual unit with its own boundary; a list of cards is a list of boxes, and the eye stops at every edge.
- Do not put the row height in padding, or let a variant change the slot order. Both turn "one anatomy" into a family of near-identical layouts nobody can hold in mind.
- Do not nest an `<a>` inside the row's title link. Use the `::after` overlay recipe and give every inner handle `relative`, in tree order after the title.
- Do not drop `role="list"` when you remove the bullets, and do not put a bare `<div>` between the list and its items.
- Do not reach for a `Table` because the list grew. Reach for it because someone needs to sort, filter or select — length alone is a density question.

## Related

- Pattern: `inbox-triage` — the same rows where the screen's job is to sort them
- Pattern: `detail-with-rail` — a zoned list beside a rail of its siblings
- Pattern: `planning-board` — when the items belong to dates
- Component: `Table` — the dataset case; `EmptyState`, `Skeleton`, `Badge`, `Button` — the parts a row uses
