# Detail with Rail

A collapsible rail of sibling records beside one detail view — names only, remembering whether it is open.

## When to Use

Use this pattern when:

- The reader works inside one record at a time and the most frequent next move is _the next record_, not the list they came from
- The siblings fit as a column of names — a handful to a few dozen, no columns, no numbers, no preview
- Every record has its own URL, and picking a sibling navigates

Do NOT use when:

- The screen's question is "what now" rather than "which one" — a list of everything else beside it is exactly the question that screen must not ask
- The reader needs to compare records, or act on several at once — that is `Table` with selection
- The neighbour is a section of the _same_ record — those are `tab-navigation` (a URL per section) or `Tab` (panels in one document)

## Layout

- **Structure:** `SidebarLayout` in `mode="collapsible"` — the rail as the `sidebar` snippet, the detail view as `children`. The mode matters: `responsive` keeps the sidebar permanent from `lg` up and lets `open` drive only the mobile overlay, so above that width there is nothing to collapse.
- **Width:** the rail carries names, so ~200 px (`sidebarWidth="12.5rem"`) is enough; the room belongs to the detail. `contentMaxWidth="none"` drops the layout's own padding along with its max-width (both live on the sized variants), so the padded, capped column becomes yours to write.
- **Below `lg` the rail is an overlay.** The library hides the sidebar backdrop only from `lg` up (1024 px), so on a narrow screen an open rail dims and covers the detail. It therefore starts closed there — see the recipe.
- **One handle, rendered in both states.** It sits in the detail's header, says "Collapse rail" or "Open rail", and binds `aria-expanded` to the state. A handle that exists in only one of the two states cannot be the place focus returns to: a closed panel goes `inert`, and the library hands the focus back to the control that opened it **only while that control is still in the document** — otherwise focus lands on `<body>`.
- **Groups, if the rail has them,** are collapsed by default and open when the current record is inside one — a rail that hides where you are points at a place you are not.

## Component Selection

| UI Need                                               | Component                              | Configuration                                                                      |
| ----------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| Shell + rail                                          | `SidebarLayout`                        | `mode="collapsible"`, `sidebarWidth`, `contentMaxWidth="none"`, `bind:open`        |
| A rail inside an app shell that already has a sidebar | `Sidebar` (standalone)                 | Do not nest two `SidebarLayout`s — the outer one is the shell, this is in-page nav |
| The rail's memory                                     | `createPersistentState`                | `{ key, defaultValue: true }` — a habit of this browser, not a field on the record |
| The width rule                                        | `MediaQuery` (`svelte/reactivity`)     | Instance-local; matches the library's own `lg` breakpoint                          |
| The sibling list                                      | `<nav>` + `<a href>`                   | `aria-current="page"` on the active one; the library ships no anchor primitive yet |
| The one handle                                        | `Button` `variant="text"` `size="2xs"` | `aria-expanded={open}`, a label that switches, rendered in both states             |
| A secondary group (archived, resting)                 | `Collapsible`                          | Or a button plus a list; open it when the current record sits inside               |
| Sections _of_ the record                              | `Tab` / `tab-navigation`               | The rail is siblings; sections are a different axis and belong above the content   |

## Recipe — the rail and its memory

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import {
    Button,
    ChevronLeftIcon,
    ChevronRightIcon,
    createPersistentState,
    SidebarLayout
  } from '@urbicon-ui/blocks';

  let {
    siblings,
    current,
    children
  }: {
    siblings: { slug: string; name: string }[];
    current: string;
    children: Snippet;
  } = $props();

  const uid = $props.id();
  const labelId = `${uid}-rail`;

  /** Where the rail stands beside the content instead of over it — the library
      hides the sidebar backdrop from `lg` up, so this is its breakpoint, not ours. */
  const beside = new MediaQuery('(min-width: 1024px)');

  const remembered = createPersistentState({ key: 'detail-rail', defaultValue: true });

  let open = $state(false);

  // On a narrow screen the rail is a modal overlay: opening one by itself is a
  // question nobody asked, so it starts closed there.
  $effect(() => {
    open = beside.current && remembered.value;
  });

  /** A width is not a decision — only what the reader does beside the content is kept. */
  function remember(next: boolean) {
    if (beside.current) remembered.value = next;
  }

  // `onOpenChange` reports the layout's own closes (Escape, the backdrop); a
  // toggle from here has to write both halves itself.
  function setOpen(next: boolean) {
    open = next;
    remember(next);
  }
</script>

<SidebarLayout
  bind:open
  onOpenChange={remember}
  mode="collapsible"
  sidebarWidth="12.5rem"
  contentMaxWidth="none"
>
  {#snippet sidebar()}
    <nav aria-labelledby={labelId} class="px-6 py-8">
      <h2 id={labelId} class="text-text-tertiary text-xs font-medium tracking-wide uppercase">
        Projects
      </h2>

      <ul role="list" class="mt-4">
        {#each siblings as sibling (sibling.slug)}
          <li>
            <a
              href="/projects/{sibling.slug}"
              aria-current={sibling.slug === current ? 'page' : undefined}
              class={[
                'block truncate py-1.5 text-sm',
                sibling.slug === current
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              ]}
            >
              {sibling.name}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  {/snippet}

  <!-- `contentMaxWidth="none"` takes the layout's padding with its max-width,
       so the reading column is written here. -->
  <div class="mx-auto w-full max-w-3xl px-6 py-8">
    <header class="flex items-center gap-4">
      <!-- One handle for both states: it is what `aria-expanded` sits on, and
           the control the library hands the focus back to when the rail
           closes — which only works while it is still in the document. -->
      <Button
        variant="text"
        intent="neutral"
        size="2xs"
        class="ml-auto min-h-[var(--blocks-touch-target-min)]"
        aria-expanded={open}
        onclick={() => setOpen(!open)}
      >
        {open ? 'Collapse rail' : 'Open rail'}
        {#if open}
          <ChevronLeftIcon size={12} />
        {:else}
          <ChevronRightIcon size={12} />
        {/if}
      </Button>
    </header>

    {@render children()}
  </div>
</SidebarLayout>
```

## Behavioral Rules

- **Picking a sibling navigates.** The rail is a `<nav>` of real links: history, middle-click, copy-link and prefetch come with the anchor, and the URL stays the only state. Swapping the detail in place without changing the URL loses all four.
- **The active sibling is marked with `aria-current="page"`**, not with a selected-item background alone — and it must stay visible when it sits in a collapsed group.
- **The memory is a browser habit, not data.** `createPersistentState` writes under its own namespaced key and swallows a storage it cannot use, so a private window simply gets the default. A column on the record would make one person's window a property of the record for everyone.
- **What the viewport decides is not remembered.** The rail closing because the window is narrow is a consequence, not a choice; storing it would keep it closed on the next wide screen.
- **The rail carries names.** No counts, no badges, no last-changed line, no preview. Everything that turns it into a dashboard makes the column wider and the detail narrower, and the reader came for the detail.
- **The handle reports the state it toggles.** `aria-expanded={open}` on a control that is rendered either way, and a label that says what pressing it will do. A screen reader must be able to tell an absent rail from a rail with nothing in it.
- **Escape closes an overlaying rail** and the focus returns to that handle — `SidebarLayout` closes on Escape and backdrop click by default; leave both on.

## Anti-Patterns

- Do not use `mode="responsive"` for a rail. Above `lg` that mode keeps the sidebar permanent and `open` reaches only the mobile overlay, so the reader cannot put the rail away — which is the one thing a rail is for. `SidebarLayout` renders no handle of its own in either mode; the handle is yours to place.
- Do not render the handle in only one of the two states — neither the one that disappears when the rail opens nor the one inside a rail that goes `inert` when it closes. Such a control cannot report `aria-expanded`, and it is exactly the node the library tries to hand the focus back to when the rail closes.
- Do not nest a second `SidebarLayout` inside an app shell that already has one. The shell owns the layout's width variables; an in-page rail is a standalone `Sidebar` or a grid column.
- Do not use a `Drawer` for the rail. A drawer is modal at every width, and the whole point of the rail is that the detail keeps working beside it.
- Do not persist the rail per record. It is one habit for the whole screen type; keyed per record it becomes a setting the reader has to maintain by hand.
- Do not put the rail on a screen whose question is "what now". A list of every other record beside a decision screen is the distraction that screen exists to keep away.
- Do not fill the rail with metadata to justify its width. If names are not enough, the reader wanted the list view, and that is a different page.

## Related

- Pattern: `zoned-list` — the detail beside the rail is usually one of these
- Pattern: `tab-navigation` — sections _of_ the record, above the content, one URL each
- Pattern: `settings-page` — the same shell where the sidebar is hierarchical navigation, not siblings
- Component: `SidebarLayout`, `Sidebar`, `Collapsible`, `Button`
