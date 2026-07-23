<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import { DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
</script>

<SeoMeta title="Accessibility - Table" />

<DocsPageLayout
  title="Accessibility"
  description="Semantic HTML, keyboard navigation, ARIA attributes, and responsive design for the Table component."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="accessibility">
    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <div class="divide-border-subtle divide-y">
        <div class="pb-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Semantic Structure</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            Renders a native <code class="text-text-primary">&lt;table&gt;</code> with
            <code class="text-text-primary">&lt;thead&gt;</code>,
            <code class="text-text-primary">&lt;tbody&gt;</code>, and
            <code class="text-text-primary">&lt;th scope="col"&gt;</code> elements. The table
            container uses <code class="text-text-primary">role="region"</code> with an
            <code class="text-text-primary">aria-label</code> for screen reader context.
          </p>
        </div>
        <div class="py-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard Navigation</h4>
          <p class="text-text-secondary mb-3 text-sm leading-relaxed">
            Uses the <strong>Roving Tabindex</strong> pattern (WAI-ARIA Grid). When selection,
            expansion, or row click is enabled, the table uses
            <code class="text-text-primary">role="grid"</code>
            with full keyboard support.
          </p>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {#each [{ key: 'Arrow Up/Down', action: 'Navigate between rows' }, { key: 'Home / End', action: 'Jump to first / last row' }, { key: 'Space', action: 'Toggle row selection' }, { key: 'Enter', action: 'Expand row or trigger onRowClick' }, { key: 'Page Up/Down', action: 'Previous / next page' }, { key: 'Escape', action: 'Clear selection' }, { key: 'Shift+Arrow L/R', action: 'Reorder column (on header)' }] as shortcut (shortcut.key)}
              <div class="flex items-baseline gap-2">
                <kbd
                  class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 font-medium whitespace-nowrap"
                  >{shortcut.key}</kbd
                >
                <span class="text-text-secondary">{shortcut.action}</span>
              </div>
            {/each}
          </div>
        </div>
        <div class="py-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Sort Announcements</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            Sortable column headers include
            <code class="text-text-primary">aria-sort</code> attributes (<code
              class="text-text-primary">ascending</code
            >
            /
            <code class="text-text-primary">descending</code> /
            <code class="text-text-primary">none</code>). Direction changes are announced to screen
            readers.
          </p>
        </div>
        <div class="pt-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Responsive Design</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            Below <code class="text-text-primary">768px</code>, the table switches to a card-based
            mobile layout automatically. Column
            <code class="text-text-primary">priority</code> levels control which fields remain visible
            at each breakpoint. Both layouts are fully operable with assistive technology.
          </p>
        </div>
      </div>
    </div>
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
