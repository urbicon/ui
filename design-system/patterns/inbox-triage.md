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
| The item row                | markup — see `zoned-list`    | The same anatomy, usually without the key column: content · one thing on the right             |
| Choosing a destination      | `Select`                     | Up to ~6 destinations; `size="sm"` so the step keeps the list's rhythm                         |
| Choosing among many         | `Combobox`                   | 7+ destinations — typing is faster than scrolling a listbox                                    |
| The one extra field         | `Input`                      | The next step, a due date, a note. Two fields is the ceiling for an inline step                |
| Committing the filing       | `Button` `size="sm"`         | In the step, under the row it belongs to                                                       |
| Letting an item go          | `Button` `variant="text"`    | Ink, no intent colour, no confirmation                                                         |
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
  import { Button, Input, Select } from '@urbicon-ui/blocks';

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
    onDrop
  }: {
    entries: Entry[];
    destinations: { label: string; value: string }[];
    onCapture: (title: string) => Promise<void>;
    onFile: (input: { entry: string; destination: string }) => Promise<void>;
    onDrop: (id: string) => void;
  } = $props();

  const uid = $props.id();
  const labelId = `${uid}-inbox`;

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

  function openFiling(id: string) {
    filing = filing === id ? null : id;
    destination = null;
  }

  async function file(entry: string) {
    if (!destination) return;
    await onFile({ entry, destination });
    filing = null;
    destination = null;
  }
</script>

<section aria-labelledby={labelId}>
  <h2 id={labelId} class="text-text-tertiary text-2xs font-medium tracking-[0.18em] uppercase">
    Inbox
  </h2>

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

  <ul role="list" class="mt-4">
    {#each entries as entry (entry.id)}
      <li class="group">
        <div class="flex min-h-11 items-center">
          <div class="min-w-0 flex-1">
            <p class="text-text-primary m-0 truncate text-sm">{entry.title}</p>
            {#if entry.hint}
              <p class="text-text-tertiary m-0 truncate text-xs">{entry.hint}</p>
            {/if}
          </div>

          <!-- The verb of this place stands at rest, in ink. Letting go appears
               beside it — on hover, on focus, and permanently where there is no
               pointer — never in its place. -->
          <div class="ml-4 flex shrink-0 items-center gap-3">
            <Button
              variant="text"
              intent="neutral"
              size="2xs"
              class="hidden group-focus-within:inline-flex group-hover:inline-flex pointer-coarse:inline-flex"
              onclick={() => onDrop(entry.id)}
            >
              Let go
            </Button>
            {#if filing !== entry.id}
              <Button
                variant="text"
                intent="primary"
                size="2xs"
                aria-expanded={false}
                onclick={() => openFiling(entry.id)}
              >
                File
              </Button>
            {/if}
          </div>
        </div>

        {#if filing === entry.id}
          <!-- The step is a row, not a panel: same rhythm, no frame, no tint. -->
          <div class="flex min-h-11 items-center gap-3 pl-7.5">
            <Select
              options={destinations}
              size="sm"
              class="w-56"
              placeholder="Where does it belong?"
              aria-label="Destination"
              bind:value={destination}
            />
            <Button size="sm" disabled={!destination} onclick={() => file(entry.id)}>File</Button>
            <Button variant="text" intent="neutral" size="2xs" onclick={() => (filing = null)}>
              Cancel
            </Button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</section>
```

## Behavioral Rules

- **One step open at a time.** Opening a second closes the first — two open steps under two rows are two answers to one question. Escape closes the open one and returns focus to its row.
- **After a decision, the focus goes to the next item**, not back to the field. The reader is going down the list; sending them back to the top costs the place they had.
- **Letting go is exactly as cheap as filing** — one click, no confirmation, no reason required. An inbox whose only exit is a decision turns into a debt, and the debt is what stops people opening it.
- **An item can also just be done.** Not everything in the pile needs a destination; keep the complete/finish handle on the row, or the reader has to file something first in order to finish it.
- **The row does not move while its step is open.** Re-sorting the list under an open step moves the target out from under the pointer. Let the row settle in place and re-sort on the next load.
- **The write reports itself in place** — the value appears where it will live, the row leaves the pile. No toast per item; a stream of confirmations is the loudest way to say "nothing happened yet".
- **The list keeps its accessible shape:** `role="list"` with only `role="listitem"` inside, and the filing step lives _in_ the item it belongs to, not beside it.

## Anti-Patterns

- Do not open a `Dialog` or `ConfirmDialog` to file or drop an item. A question the reader has to dismiss makes the right action more expensive than doing nothing, which is how a pile becomes a backlog.
- Do not send the reader to another screen to file one item. They lose the list they were working through, and the way back is never as short as the way out.
- Do not turn the inline step into a form. Two fields is the ceiling; anything longer means the item deserves a page, and the row should link to it.
- Do not make dropping harder than filing — no reason field, no undo dialog, no "are you sure". If dropping needs to be reversible, keep the items somewhere and say so once.
- Do not hide the capture row when the inbox is empty. Empty is the state in which the way in matters most.
- Do not clear the field only after the server answers, and do not block the field while a write is in flight. Capture is the one place on the screen that has to feel instant.
- Do not count the pile at the reader ("14 to sort"). The list shows what is there; a number over it is a verdict on how the week went.
- Do not put filters, sorting or a view switch on this screen. A screen built to become empty does not need a second way to look at it.

## Related

- Pattern: `zoned-list` — the row anatomy and the zone rules this screen is built from
- Pattern: `form-page` — where an item needs a real form, one page away from the row
- Component: `Input`, `Select`, `Combobox`, `Button`, `CommandPalette`, `EmptyState`
