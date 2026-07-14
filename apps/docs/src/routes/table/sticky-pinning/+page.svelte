<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { SegmentGroup, SegmentItem, Slider } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { employees, basicColumns } from '../_data';

  let stickyMode = $state<'false' | 'toolbar' | 'header' | 'both'>('both');
  let stickyOffset = $state(48);

  const stickyProp = $derived(stickyMode === 'false' ? false : stickyMode);

  // Generate enough rows so the user has something to scroll through
  const manyEmployees = $derived([
    ...employees,
    ...employees.map((e) => ({ ...e, id: e.id + 100 })),
    ...employees.map((e) => ({ ...e, id: e.id + 200 })),
    ...employees.map((e) => ({ ...e, id: e.id + 300 }))
  ]);
</script>

<SeoMeta title="Sticky Pinning - Table" />

<DocsPageLayout
  title="Sticky Pinning"
  description="Pin the toolbar, column header, and group header to the top of the scroll ancestor on long lists. Keeps context visible while scrolling through hundreds of rows."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="overview">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The <code class="text-text-primary">sticky</code> prop pins one or more of the table's three
        contextual layers — <strong>toolbar</strong> (L1), <strong>column header</strong> (L2), and
        <strong>group header</strong> (L3 when grouping is active). The pin position is offset by the
        height of each preceding layer using CSS custom properties, so the layers stack naturally below
        your app shell's top bar.
      </p>
      <p class="text-text-secondary text-sm">
        For tables wider than the viewport, reach for <code class="text-text-primary"
          >fit="viewport"</code
        >
        (see below) — it contains both axes of scroll inside the table, so the page never scrolls sideways.
      </p>
    </div>
  </Section>

  <Section id="playground">
    <div class="space-y-6">
      <div
        class="bg-surface-base border-border-default rounded-contain flex flex-wrap items-end gap-6 border p-4"
      >
        <div class="min-w-[280px] flex-1">
          <div class="text-text-secondary mb-2 block text-xs font-medium tracking-wide uppercase">
            sticky
          </div>
          <SegmentGroup bind:value={stickyMode} size="sm" ariaLabel="sticky mode">
            <SegmentItem value="false">none</SegmentItem>
            <SegmentItem value="toolbar">toolbar</SegmentItem>
            <SegmentItem value="header">header</SegmentItem>
            <SegmentItem value="both">both</SegmentItem>
          </SegmentGroup>
        </div>

        <div class="min-w-[240px] flex-1">
          <div class="text-text-secondary mb-2 block text-xs font-medium tracking-wide uppercase">
            stickyOffset: {stickyOffset}px
          </div>
          <Slider bind:value={stickyOffset} min={0} max={120} step={4} aria-label="sticky offset" />
        </div>
      </div>

      <p class="text-text-secondary text-xs">
        Scroll the page to see the pinned layer(s). Adjust <code class="text-text-primary"
          >stickyOffset</code
        > to simulate a fixed app-shell top bar.
      </p>

      <Table
        items={manyEmployees}
        columns={basicColumns}
        enableSmartFilter={true}
        searchPlaceholder="Search employees..."
        itemsPerPage={50}
        sticky={stickyProp}
        {stickyOffset}
        initialGroupBy="department"
      />
    </div>
  </Section>

  <Section id="modes">
    <div class="space-y-8">
      <CodeExample
        title="sticky (defaults to both)"
        description="Pin toolbar + header + group header. The visual stack mirrors the DOM order."
        code={`<Table
  {items}
  {columns}
  sticky
/>`}
      >
        <Table items={employees.slice(0, 6)} columns={basicColumns} sticky />
      </CodeExample>

      <CodeExample
        title="Toolbar only"
        description="Pin only the toolbar; the column header scrolls with the rest of the table."
        code={`<Table
  {items}
  {columns}
  sticky="toolbar"
/>`}
      >
        <Table items={employees.slice(0, 6)} columns={basicColumns} sticky="toolbar" />
      </CodeExample>

      <CodeExample
        title="Header only"
        description="Pin only the column header (plus group header when grouping is active). The toolbar scrolls with the page."
        code={`<Table
  {items}
  {columns}
  sticky="header"
/>`}
      >
        <Table items={employees.slice(0, 6)} columns={basicColumns} sticky="header" />
      </CodeExample>

      <CodeExample
        title="With stickyOffset for app-shell top bar"
        description="If your layout has a fixed top bar, pass its height in pixels so the pin lands just below it."
        code={`<Table
  {items}
  {columns}
  sticky
  stickyOffset={64}
/>`}
      >
        <Table items={employees.slice(0, 6)} columns={basicColumns} sticky stickyOffset={64} />
      </CodeExample>
    </div>
  </Section>

  <Section id="custom-toolbar">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The default toolbar is the <code class="text-text-primary">SmartFilterBar</code>. Override
        it with the <code class="text-text-primary">toolbar</code> snippet — the custom content inherits
        the same sticky wrapper.
      </p>
      <CodeExample
        title="Custom toolbar snippet"
        description="Replace SmartFilterBar entirely while keeping the sticky behavior."
        code={`<Table {items} {columns} sticky enableSmartFilter={false}>
  {#snippet toolbar()}
    <div class="flex items-center justify-between p-3">
      <h3 class="text-base font-semibold">Active employees</h3>
      <button class="...">Export CSV</button>
    </div>
  {/snippet}
</Table>`}
      />
    </div>
  </Section>

  <Section id="contained-scroll">
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Contained scroll — <code>fit="viewport"</code></h2>
      <p class="text-text-secondary text-sm">
        Page-relative <code class="text-text-primary">sticky</code> pinning and in-table horizontal
        scroll are mutually exclusive: a single element cannot be both a sticky-pin host and a
        scroll ancestor. So with <code class="text-text-primary">sticky="header"</code>, a table
        wider than the viewport pushes its horizontal overflow onto the <em>page</em> — the whole layout
        scrolls sideways.
      </p>
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">fit="viewport"</code> resolves this by making the table its
        own scroll container. It is height-capped to the viewport (measured automatically — no magic
        <code class="text-text-primary">max-height</code>), the column and group headers pin to the
        top of the <em>box</em>, and the toolbar + pagination stay fixed outside the scrolling area.
        Only the rows scroll, horizontally and vertically.
      </p>
      <CodeExample
        title="Full-height list page"
        description="The table fills the available viewport height. Header pinned, toolbar + pagination fixed, rows scroll in both directions. Supersedes the sticky prop; desktop-only (mobile keeps document scroll)."
        code={`<Table
  {items}
  {columns}
  fit="viewport"
/>`}
      />
      <p class="text-text-secondary text-xs">
        <code class="text-text-primary">fit="viewport"</code> supersedes
        <code class="text-text-primary">sticky</code>
        and <code class="text-text-primary">stickyOffset</code> (the measured top absorbs app-shell
        offsets). It is mutually exclusive with
        <code class="text-text-primary">virtualized</code>, which keeps its own
        <code class="text-text-primary">virtualHeight</code> scroll box.
      </p>
    </div>
  </Section>

  <Section id="caveats">
    <h2 class="mb-2 text-lg font-semibold">Caveats</h2>
    <ul class="text-text-secondary list-disc space-y-2 pl-5 text-sm">
      <li>
        Sticky pinning anchors to the nearest scrollable ancestor. If you wrap the table in a
        container with <code class="text-text-primary">overflow: auto/hidden</code>, the pin will
        bind to that container — usually what you want inside a Drawer body, less so inside an
        unintentional <code class="text-text-primary">overflow</code> wrapper.
      </li>
      <li>
        Enabling <code class="text-text-primary">sticky="header"</code> or
        <code class="text-text-primary">"both"</code>
        disables the table's internal horizontal scrolling (the scroll area can't be both a sticky pin
        host AND a scroll ancestor at the same time). Very wide tables fall back to page-level horizontal
        scrolling — switch to <code class="text-text-primary">fit="viewport"</code> to contain it instead.
      </li>
      <li>
        <code class="text-text-primary">unstyled</code> mode strips the sticky classes — pinning is
        a layout function, not pure styling. Apply your own via
        <code class="text-text-primary">slotClasses.toolbar</code>
        /
        <code class="text-text-primary">slotClasses.thead</code> when running unstyled.
      </li>
    </ul>
  </Section>
</DocsPageLayout>
