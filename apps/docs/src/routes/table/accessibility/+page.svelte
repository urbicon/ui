<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Note, NoteList } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
</script>

<SeoMeta
  title="Accessibility - Table"
  description="Semantic HTML, keyboard navigation, ARIA attributes, and responsive design for the Table component."
/>

<DocsPageLayout
  title="Accessibility"
  description="Semantic HTML, keyboard navigation, ARIA attributes, and responsive design for the Table component."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <!-- No <Section> wrapper: this page has one unnamed topic, so there is
       nothing to name, no table of contents to feed and no anchor pointing
       here. A Section that renders no heading is a `<div class="relative">`
       plus an unnamed landmark. The pages in this group with more than one
       topic (filtering, selection, sorting-grouping, column-config,
       live-updates, sticky-pinning) do carry titled sections and a nav.

       `headingLevel={2}` on the examples below is load-bearing, not a
       leftover: with no section heading on the page they are the only h2,
       and dropping them to the default h3 puts an h1 -> h3 skip on the
       page (measured, 2026-08). -->
  <NoteList>
    <Note headingLevel={2} title="Semantic Structure">
      <p>
        Renders a native <code class="text-text-primary">&lt;table&gt;</code> with
        <code class="text-text-primary">&lt;thead&gt;</code>,
        <code class="text-text-primary">&lt;tbody&gt;</code> and real
        <code class="text-text-primary">&lt;th&gt;</code> header cells, so rows and columns arrive
        as structure a screen reader already understands. Give the table its name with
        <code class="text-text-primary">ariaLabel</code>: on a page with more than one table, that
        is what tells them apart. Sortable headers carry
        <code class="text-text-primary">aria-sort</code>, so the current direction is read out when
        the reader arrives at the header.
      </p>
    </Note>
    <Note headingLevel={2} title="Keyboard Navigation">
      <p class="text-text-secondary mb-3 text-sm leading-relaxed">
        The table becomes a <code class="text-text-primary">role="grid"</code> with a roving
        tabindex as soon as it is interactive: selection, expandable rows or
        <code class="text-text-primary">onRowClick</code>. Without one of those it stays a plain
        table and the shortcuts below do nothing; the sortable headers and the pager are still tab
        stops.
      </p>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        {#each [{ key: 'Arrow Up/Down', action: 'Navigate between rows' }, { key: 'Home / End', action: 'First / last row on the page' }, { key: 'Space', action: 'Toggle row selection' }, { key: 'Enter', action: 'Expand row, or onRowClick when rows do not expand' }, { key: 'Page Up/Down', action: 'Previous / next page' }, { key: 'Escape', action: 'Clear selection' }, { key: 'Shift+Arrow L/R', action: 'Reorder the focused column header' }] as shortcut (shortcut.key)}
          <div class="flex items-baseline gap-2">
            <Kbd keys={shortcut.key} />
            <span class="text-text-secondary">{shortcut.action}</span>
          </div>
        {/each}
      </div>
    </Note>
    <Note headingLevel={2} title="Responsive Design">
      <p>
        Below <code class="text-text-primary">cardsBelow</code> (default
        <code class="text-text-primary">48rem</code>) the table renders one card per row. The step
        is measured on the table's own container, not on the window, and the table sets that
        container up itself: a table in a narrow sidebar switches while the window stays wide. It
        moves both ways, from <code class="text-text-primary">24rem</code> to
        <code class="text-text-primary">56rem</code>, so a three-column list can stay a grid in the
        sidebar and a wide report can become cards before its columns get cramped.
      </p>
      <p class="mt-3">
        A card is operable from the keyboard: whatever opens it, the headline or the chevron beside
        it, is a real button. Column <code class="text-text-primary">priority</code> decides what a
        card shows (<code class="text-text-primary">3</code> keeps a column out of it); the desktop grid
        always shows every column.
      </p>
    </Note>
  </NoteList>
</DocsPageLayout>
