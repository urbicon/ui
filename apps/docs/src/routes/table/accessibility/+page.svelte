<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
</script>

<SeoMeta title="Accessibility - Table" />

<DocsPageLayout
  title="Accessibility"
  description="Semantic HTML, keyboard navigation, ARIA attributes, and responsive design for the Table component."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="accessibility">
    <NoteList>
      <Note title="Semantic Structure">
        <p>
          Renders a native <code class="text-text-primary">&lt;table&gt;</code> with
          <code class="text-text-primary">&lt;thead&gt;</code>,
          <code class="text-text-primary">&lt;tbody&gt;</code>, and
          <code class="text-text-primary">&lt;th scope="col"&gt;</code> elements. The table
          container uses <code class="text-text-primary">role="region"</code> with an
          <code class="text-text-primary">aria-label</code> for screen reader context.
        </p>
      </Note>
      <Note title="Keyboard Navigation">
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
      <Note title="Sort Announcements">
        <p>
          Sortable column headers include
          <code class="text-text-primary">aria-sort</code> attributes (<code
            class="text-text-primary">ascending</code
          >
          /
          <code class="text-text-primary">descending</code> /
          <code class="text-text-primary">none</code>). Direction changes are announced to screen
          readers.
        </p>
      </Note>
      <Note title="Responsive Design">
        <p>
          Below <code class="text-text-primary">768px</code>, the table switches to a card-based
          mobile layout automatically. Column
          <code class="text-text-primary">priority</code> levels control which fields remain visible at
          each breakpoint. Both layouts are fully operable with assistive technology.
        </p>
      </Note>
    </NoteList>
  </Section>
</DocsPageLayout>
