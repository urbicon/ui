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
        <code class="text-text-primary">&lt;tbody&gt;</code>, and
        <code class="text-text-primary">&lt;th scope="col"&gt;</code> elements. The table container
        uses <code class="text-text-primary">role="region"</code> with an
        <code class="text-text-primary">aria-label</code> for screen reader context.
      </p>
    </Note>
    <Note headingLevel={2} title="Keyboard Navigation">
      <p class="text-text-secondary mb-3 text-sm leading-relaxed">
        Uses the <strong>Roving Tabindex</strong> pattern (WAI-ARIA Grid). When selection,
        expansion, or row click is enabled, the table uses
        <code class="text-text-primary">role="grid"</code>
        with full keyboard support.
      </p>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        {#each [{ key: 'Arrow Up/Down', action: 'Navigate between rows' }, { key: 'Home / End', action: 'Jump to first / last row' }, { key: 'Space', action: 'Toggle row selection' }, { key: 'Enter', action: 'Expand row or trigger onRowClick' }, { key: 'Page Up/Down', action: 'Previous / next page' }, { key: 'Escape', action: 'Clear selection' }, { key: 'Shift+Arrow L/R', action: 'Reorder column (on header)' }] as shortcut (shortcut.key)}
          <div class="flex items-baseline gap-2">
            <Kbd keys={shortcut.key} />
            <span class="text-text-secondary">{shortcut.action}</span>
          </div>
        {/each}
      </div>
    </Note>
    <Note headingLevel={2} title="Sort Announcements">
      <p>
        Sortable column headers include
        <code class="text-text-primary">aria-sort</code> attributes (<code class="text-text-primary"
          >ascending</code
        >
        /
        <code class="text-text-primary">descending</code> /
        <code class="text-text-primary">none</code>). Direction changes are announced to screen
        readers.
      </p>
    </Note>
    <Note headingLevel={2} title="Responsive Design">
      <p>
        Below <code class="text-text-primary">768px</code>, the table switches to a card-based
        mobile layout automatically. Column
        <code class="text-text-primary">priority</code> levels control which fields remain visible at
        each breakpoint. Both layouts are fully operable with assistive technology.
      </p>
    </Note>
  </NoteList>
</DocsPageLayout>
