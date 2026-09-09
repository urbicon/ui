# Inbox Triage

A capture row on top, unsorted items below, and every sorting decision made inline on the row — no dialog, no second screen.

## When to Use

Use this pattern when:

- Things arrive faster than they can be filed, and the screen's whole job is to empty the pile
- Each item needs one small decision — where it belongs, or that it does not belong anywhere
- The reader works down the list in one sitting and wants to stay in it

Do NOT use when:

- Filing needs more than about two fields, or a document has to be read first — that is a detail page (`form-page`), reached from the row
- Nothing arrives unsorted: if every item comes in with its place already known, there is nothing to triage
- The queue is an approval workflow with states, assignees and history — that is a dataset (`Table`) with a detail view

## Layout

- **Structure:** `<main>` holding the capture row, then one or two zones of items, and nothing else. No filters, no toolbar, no view switch — a screen whose job is to become empty does not need a way to look at it differently.
- **The capture row sits first and outside the list.** It is not an entry, it makes them, so it stands before the `<ul role="list">` rather than inside it. It stays when the inbox is empty: the way in must always be there.
- **It carries the screen's only rule.** A single hairline under the field reads as an affordance; the rows below separate by rhythm alone (see `zoned-list`).
- **Zones, if any, are by origin** — what I captured, what arrived from elsewhere — and they follow the zoned-list rules: fixed order, an eyebrow label each, an empty one disappears.
- **The rows are the zoned-list anatomy, usually without the key column.** The inbox is precisely the place where things have no key yet; 80 px of empty column pushes every title to the right for nothing. Where an item does bring one, it goes on the second line.
- **What opens under a row is more rows.** The filing step is a row's worth of controls in the list's own rhythm, not a card, a panel or a frame.

## Component Selection

| UI Need                     | Component                    | Configuration                                                                                  |
| --------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| The capture field           | `Input`                      | One field, Enter commits; `variant="ghost"` or `"underline"` so it reads as a line, not a form |
| The item row                | markup — see `zoned-list`    | The same anatomy, usually without the key column: marker · content · one thing on the right    |
| Choosing a destination      | `Select`                     | Up to ~6 destinations; `size="sm"` so the step keeps the list's rhythm                         |
| Choosing among many         | `Combobox`                   | 7+ destinations — typing is faster than scrolling a listbox                                    |
| The one extra field         | `Input`                      | The next step, a due date, a note. Two fields is the ceiling for an inline step                |
| Opening the filing step     | `Button` `variant="text"`    | A disclosure: it stays rendered while the step is open, carries `aria-expanded` and toggles    |
| Committing the filing       | `Button` `size="sm"`         | In the step, under the row it belongs to                                                       |
| Letting an item go          | `Button` `variant="text"`    | Ink, no intent colour, no confirmation — see the reversibility rule below                      |
| Reaching the inbox anywhere | `CommandPalette`             | The inbox is a destination, not a mode                                                         |
| The pile is empty           | `EmptyState` or one sentence | A sentence, where the capture row already offers the action                                    |
| Blocking decision           | `Dialog` — **no**            | Everyday triage never opens a modal; see Anti-Patterns                                         |

## The capture row

- **It reads, it does not demand.** One field, plain text. Whatever the app's parser recognises — a project shorthand, a size, a date word — it lifts out of the title and shows back in the row's second line, so the reader sees what was understood without being asked to fill a form.
- **Enter commits and the field empties immediately**; the new row appearing in the list is the receipt. Waiting for the server before clearing makes the fastest path on the screen feel like the slowest.
- **No modes.** There is no "quick add" versus "full add" — the same field takes a bare title and a fully annotated one.
- **One parser.** If a command palette captures too, both call the same function; two answers to the same question drift apart within a release.

## Recipe — capture, then file in place

```svelte
<script lang="ts">
  import { tick } from 'svelte';
  import { Button, CircleIcon, Input, Select } from '@urbicon-ui/blocks';

  interface Entry {
    id: string;
    title: string;
    /** What the parser understood, or where the item came from. */
    hint?: string;
  }

  let {
    entries,
    destinations,
    onCapture,
    onFile,
    onComplete,
    onDrop
  }: {
    entries: Entry[];
    destinations: { label: string; value: string }[];
    onCapture: (title: string) => Promise<void>;
    onFile: (input: { entry: string; destination: string }) => Promise<void>;
    onComplete: (id: string) => Promise<void>;
    onDrop: (id: string) => Promise<void>;
  } = $props();

  const uid = $props.id();
  const labelId = `${uid}-inbox`;

  let list: HTMLElement | undefined = $state();
  let draft = $state('');
  /** The entry whose filing step is open — never two, so the list keeps one shape. */
  let filing = $state<string | null>(null);
  let destination = $state<string | null>(null);

  async function capture() {
    const title = draft.trim();
    if (!title) return;
    // The field empties before the write returns: the row that appears is the receipt.
    draft = '';
    await onCapture(title);
  }

  function focusIn(selector: string) {
    list?.querySelector<HTMLElement>(selector)?.focus();
  }

  // Opening hands the focus to the step's first control — the decision is the
  // next thing the reader makes, and it is one keystroke away, not two.
  async function toggleFiling(id: string) {
    filing = filing === id ? null : id;
    destination = null;
    if (filing === null) return;
    await tick();
    focusIn(`[data-step="${id}"] button`);
  }

  /** The row that keeps the reader's place once this one leaves the pile. */
  function neighbourOf(id: string): string | undefined {
    const index = entries.findIndex((entry) => entry.id === id);
    return entries[index + 1]?.id ?? entries[index - 1]?.id;
  }

  /** A decision moves the reader on: the next row takes the focus, once it exists. */
  async function decided(next: string | undefined) {
    filing = null;
    destination = null;
    await tick();
    if (next) focusIn(`[data-row="${next}"]`);
  }

  async function file(entry: string) {
    if (!destination) return;
    const next = neighbourOf(entry);
    await onFile({ entry, destination });
    await decided(next);
  }

  async function drop(entry: string) {
    const next = neighbourOf(entry);
    await onDrop(entry);
    await decided(next);
  }

  // Not everything in the pile needs a destination: the marker finishes an item
  // where it stands, so nobody has to file something in order to be done with it.
  async function complete(entry: string) {
    const next = neighbourOf(entry);
    await onComplete(entry);
    await decided(next);
  }

  // Escape belongs to the row, not to the field inside the step: it closes the
  // step and hands the focus back to the control that opened it.
  function onRowKey(event: KeyboardEvent, id: string) {
    if (event.key !== 'Escape' || filing !== id) return;
    event.preventDefault();
    filing = null;
    focusIn(`[data-file="${id}"]`);
  }
</script>

<section aria-labelledby={labelId}>
  <h2 id={labelId} class="text-text-tertiary text-xs font-medium tracking-wide uppercase">Inbox</h2>

  <div class="border-border-subtle mt-3 flex min-h-11 items-center border-b">
    <Input
      variant="ghost"
      size="sm"
      class="flex-1"
      placeholder="Capture a thought"
      aria-label="Capture a thought"
      bind:value={draft}
      onkeydown={(event: KeyboardEvent) => {
        if (event.key === 'Enter') capture();
      }}
    />
  </div>

  <ul bind:this={list} role="list" class="mt-4">
    {#each entries as entry (entry.id)}
      <!-- The row is the focus waypoint and the place Escape is heard; every
           click target inside it is a named button. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <li
        data-row={entry.id}
        tabindex="0"
        class="group focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none"
        onkeydown={(event) => onRowKey(event, entry.id)}
      >
        <div class="flex min-h-11 items-center">
          <button
            type="button"
            class="text-text-quaternary hover:text-text-primary focus-visible:ring-primary/50 flex min-h-[var(--blocks-touch-target-min)] w-4 min-w-[var(--blocks-touch-target-min)] shrink-0 items-center justify-center focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Complete {entry.title}"
            onclick={() => complete(entry.id)}
          >
            <CircleIcon size={13} />
          </button>

          <div class="ml-3.5 min-w-0 flex-1">
            <p class="text-text-primary m-0 text-sm">{entry.title}</p>
            {#if entry.hint}
              <p class="text-text-tertiary m-0 truncate text-xs">{entry.hint}</p>
            {/if}
          </div>

          <!-- The verb of this place stands at rest, in ink. Letting go appears
               beside it — on hover, on focus, and permanently where there is no
               pointer — never in its place. `--blocks-touch-target-min` is 44 px
               on a coarse pointer and 0 on a fine one. -->
          <div class="ml-4 flex shrink-0 items-center gap-3">
            <Button
              variant="text"
              intent="neutral"
              size="2xs"
              class="hidden min-h-[var(--blocks-touch-target-min)] min-w-[var(--blocks-touch-target-min)] group-focus-within:inline-flex group-hover:inline-flex pointer-coarse:inline-flex"
              onclick={() => drop(entry.id)}
            >
              Let go
            </Button>
            <!-- The disclosure stays rendered while its step is open: a control
                 that disappears cannot report `aria-expanded`, and Escape has
                 nowhere to hand the focus back to. -->
            <Button
              variant="text"
              intent="primary"
              size="2xs"
              class="min-h-[var(--blocks-touch-target-min)] min-w-[var(--blocks-touch-target-min)]"
              data-file={entry.id}
              aria-expanded={filing === entry.id}
              aria-controls="{uid}-step-{entry.id}"
              onclick={() => toggleFiling(entry.id)}
            >
              File
            </Button>
          </div>
        </div>

        {#if filing === entry.id}
          <!-- The step is a row, not a panel: same rhythm, no frame, no tint. -->
          <div
            id="{uid}-step-{entry.id}"
            data-step={entry.id}
            class="flex min-h-11 items-center gap-3 pl-7.5"
          >
            <Select
              options={destinations}
              size="sm"
              class="w-56"
              placeholder="Where does it belong?"
              aria-label="Destination"
              bind:value={destination}
            />
            <Button size="sm" disabled={!destination} onclick={() => file(entry.id)}>
              File here
            </Button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</section>
```

## Behavioral Rules

- **One step open at a time.** Opening a second closes the first — two open steps under two rows are two answers to one question. The control that opened a step stays rendered and toggles it shut, so `aria-expanded` has something to sit on and Escape has somewhere to return the focus.
- **The focus follows the decision.** Opening the step moves the focus to its first control, Escape puts it back on the control that opened it, and a made decision moves it on to the next row. A reader who has to hunt for the field after every press is doing the screen's work by hand.
- **After a decision, the focus goes to the next item**, not back to the field. The reader is going down the list; sending them back to the top costs the place they had.
- **Letting go is exactly as cheap as filing** — one click, no confirmation, no reason required. That is not an exception to the principles' rule that destructive actions need a `ConfirmDialog`: dropping here is **not destructive**, because the item stays findable and can be brought back. If dropping is irreversible in your product, the confirmation rule from the principles applies and this row is the wrong place for it.
- **An item can also just be done.** Not everything in the pile needs a destination, so the marker keeps its usual job: it finishes the item where it stands. Without it the reader has to file something first in order to be done with it.
- **The row does not move while its step is open.** Re-sorting the list under an open step moves the target out from under the pointer. Let the row settle in place and re-sort on the next load.
- **The write reports itself in place** — the value appears where it will live, the row leaves the pile. No toast per item; a stream of confirmations is the loudest way to say "nothing happened yet".
- **The list keeps its accessible shape:** `role="list"` with only `role="listitem"` inside, and the filing step lives _in_ the item it belongs to, not beside it.

## Anti-Patterns

- Do not open a `Dialog` or `ConfirmDialog` to file or drop a reversible item. A question the reader has to dismiss makes the right action more expensive than doing nothing, which is how a pile becomes a backlog.
- Do not send the reader to another screen to file one item. They lose the list they were working through, and the way back is never as short as the way out.
- Do not turn the inline step into a form. Two fields is the ceiling; anything longer means the item deserves a page, and the row should link to it.
- Do not make dropping harder than filing — no reason field, no undo dialog, no "are you sure". If dropping needs to be reversible, keep the items somewhere and say so once.
- Do not remove the control that opened a step. It is the disclosure: it reports the state, it closes the step, and it is where Escape puts the focus back.
- Do not hide the capture row when the inbox is empty. Empty is the state in which the way in matters most.
- Do not clear the field only after the server answers, and do not block the field while a write is in flight. Capture is the one place on the screen that has to feel instant.
- Do not count the pile at the reader ("14 to sort"). The list shows what is there; a number over it is a verdict on how the week went.
- Do not put filters, sorting or a view switch on this screen. A screen built to become empty does not need a second way to look at it.

## Related

- Pattern: `zoned-list` — the row anatomy and the zone rules this screen is built from
- Pattern: `form-page` — where an item needs a real form, one page away from the row
- Component: `Input`, `Select`, `Combobox`, `Button`, `CommandPalette`, `EmptyState`
