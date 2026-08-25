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

  const navigation = [
    { id: 'overview', title: 'Overview' },
    { id: 'playground', title: 'Playground' },
    { id: 'modes', title: 'Modes' },
    { id: 'custom-toolbar', title: 'Custom toolbar' },
    { id: 'contained-scroll', title: 'Contained scroll' },
    { id: 'caveats', title: 'Caveats' }
  ];

  // Generate enough rows so the user has something to scroll through
  const manyEmployees = $derived([
    ...employees,
    ...employees.map((e) => ({ ...e, id: e.id + 100 })),
    ...employees.map((e) => ({ ...e, id: e.id + 200 })),
    ...employees.map((e) => ({ ...e, id: e.id + 300 }))
  ]);
</script>

<SeoMeta
  title="Sticky Pinning - Table"
  description="Pin the toolbar, column header, and group header to the top of the scroll ancestor on long lists. Keeps context visible while scrolling through hundreds of rows."
/>

<DocsPageLayout
  title="Sticky Pinning"
  description="Pin the toolbar, column header, and group header to the top of the scroll ancestor on long lists. Keeps context visible while scrolling through hundreds of rows."
  {navigation}
  showToc={true}
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="overview" title="Overview">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The <code class="text-text-primary">sticky</code> prop keeps the table's three contextual
        layers in view while the rows scroll past them: the <strong>toolbar</strong> (L1), the
        <strong>column header</strong>
        (L2), and the <strong>group header</strong> (L3, when grouping is active). Each pinned layer
        sits below the one above it, so they stack instead of overlapping. If your app shell has a
        fixed top bar, <code class="text-text-primary">stickyOffset</code> moves the whole stack down
        by its height.
      </p>
      <p class="text-text-secondary text-sm">
        Columns scroll with their rows; nothing pins to the left or right edge. For a table wider
        than the viewport, reach for <code class="text-text-primary">fit="viewport"</code> (see below):
        it contains both axes of scroll inside the table, so the page never scrolls sideways.
      </p>
    </div>
  </Section>

  <Section id="playground" title="Playground" intent="primary">
    <div class="space-y-6">
      <div
        class="bg-surface-base border-border-default rounded-contain flex flex-wrap items-end gap-6 border p-4"
      >
        <div class="min-w-70 flex-1">
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

        <div class="min-w-60 flex-1">
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
        cardsBelow="32rem"
        items={manyEmployees}
        columns={basicColumns}
        enableSmartFilter={true}
        searchPlaceholder="Search employees..."
        viewDefaults={{ pageSize: 50, groupBy: 'department' }}
        sticky={stickyProp}
        {stickyOffset}
      />
    </div>
  </Section>

  <Section id="modes" title="Modes">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">sticky</code> takes
        <code class="text-text-primary">boolean | 'toolbar' | 'header' | 'both'</code>. Which layers
        that pins:
      </p>

      <div class="border-border-hairline overflow-x-auto border-y">
        <table class="w-full text-left text-sm">
          <thead class="text-text-primary border-border-hairline border-b">
            <tr>
              <th class="py-2 pr-4 font-semibold">Value</th>
              <th class="py-2 pr-4 font-semibold">Toolbar</th>
              <th class="py-2 pr-4 font-semibold">Column header</th>
              <th class="py-2 font-semibold">Group header</th>
            </tr>
          </thead>
          <tbody class="text-text-secondary divide-border-hairline divide-y">
            <tr>
              <td class="py-2 pr-4"><code>false</code> (default)</td>
              <td class="py-2 pr-4">scrolls</td>
              <td class="py-2 pr-4">scrolls</td>
              <td class="py-2">scrolls</td>
            </tr>
            <tr>
              <td class="py-2 pr-4"><code>sticky</code> / <code>"both"</code></td>
              <td class="py-2 pr-4">pins</td>
              <td class="py-2 pr-4">pins</td>
              <td class="py-2">pins</td>
            </tr>
            <tr>
              <td class="py-2 pr-4"><code>"toolbar"</code></td>
              <td class="py-2 pr-4">pins</td>
              <td class="py-2 pr-4">scrolls</td>
              <td class="py-2">scrolls</td>
            </tr>
            <tr>
              <td class="py-2 pr-4"><code>"header"</code></td>
              <td class="py-2 pr-4">scrolls</td>
              <td class="py-2 pr-4">pins</td>
              <td class="py-2">pins</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">"header"</code> takes the group header with it: it is the section
        marker of the same header, and a group whose name scrolls away tells the reader nothing.
      </p>

      <CodeExample
        title="sticky on its own"
        description="The bare prop is the same as both. Scroll the demo's parent page to see all three layers hold."
        code={`<Table
  {items}
  {columns}
  sticky
/>`}
      >
        <Table cardsBelow="32rem" items={employees.slice(0, 6)} columns={basicColumns} sticky />
      </CodeExample>

      <CodeExample
        title="With stickyOffset for app-shell top bar"
        description="Pass the height of your fixed top bar in pixels. It shifts whichever layer pins first, so it works with every value above."
        code={`<Table
  {items}
  {columns}
  sticky="header"
  stickyOffset={64}
/>`}
      >
        <Table
          cardsBelow="32rem"
          items={employees.slice(0, 6)}
          columns={basicColumns}
          sticky="header"
          stickyOffset={64}
        />
      </CodeExample>
    </div>
  </Section>

  <Section id="custom-toolbar" title="Custom toolbar">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The default toolbar is the <code class="text-text-primary">SmartFilterBar</code>. Override
        it with the <code class="text-text-primary">toolbar</code> snippet; the custom content inherits
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

  <Section id="contained-scroll" title={'Contained scroll — fit="viewport"'}>
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        Page-relative <code class="text-text-primary">sticky</code> pinning and in-table horizontal
        scroll are mutually exclusive: a single element cannot be both a sticky-pin host and a
        scroll ancestor. So with <code class="text-text-primary">sticky="header"</code>, a table
        wider than the viewport pushes its horizontal overflow onto the <em>page</em>, and the whole
        layout scrolls sideways.
      </p>
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">fit</code> picks between the two models.
        <code class="text-text-primary">"content"</code>, the default, is the page-relative one
        above. <code class="text-text-primary">"viewport"</code> makes the table its own scroll
        container: it is height-capped to the viewport (measured for you, with no
        <code class="text-text-primary">max-height</code> of your own), the column and group headers
        pin to the top of the <em>box</em>, and the toolbar and pagination stay fixed outside the
        scrolling area. Only the rows scroll, horizontally and vertically.
      </p>
      <CodeExample
        title="Full-height list page"
        description="The table fills the available viewport height. Column and group headers pinned to the top of the box, toolbar fixed above it, rows scrolling in both directions — at every width."
        code={`<Table
  {items}
  {columns}
  fit="viewport"
/>`}
      >
        <div class="space-y-2">
          <!-- The demo runs in a frame because the model assumes the table IS
               the page: the box is `100dvh` minus how much viewport sits above
               it, and that offset is deliberately never re-measured on page
               scroll (it drives the container's own height, so re-measuring on
               scroll would close the loop).

               Measured inline in this very section: the first reading is
               discarded as being below the viewport bottom, so the box renders
               at the full window height (800px) inside a 624px reading column,
               and after a resize it caps to whatever room was left at that
               scroll position (480px at scrollY 6100) and keeps that number.
               The frame gives the demo a document of its own, where the
               assumption holds — and the frame's size is that document's
               viewport, which is what makes the cap inside it a real one. -->
          <iframe
            src={resolve('/table/sticky-pinning/contained')}
            title="Contained scroll demo: a full-height list page"
            loading="lazy"
            class="border-border-default rounded-contain bg-surface-base block h-[26rem] w-full border"
          ></iframe>
          <p class="text-text-tertiary text-xs">
            Scroll the rows inside the frame — the toolbar, the column header and the group header
            stay put, and the page around the frame never moves. Switch the frame to
            <code class="text-text-primary">fit="content"</code> to feel the difference, or
            <a
              href={resolve('/table/sticky-pinning/contained')}
              class="text-primary-text underline underline-offset-2">open the demo full-screen</a
            >.
          </p>
        </div>
      </CodeExample>
      <p class="text-text-secondary text-xs">
        <code class="text-text-primary">fit="viewport"</code> supersedes
        <code class="text-text-primary">sticky</code>
        and <code class="text-text-primary">stickyOffset</code> (the measured top absorbs app-shell
        offsets), and it has no effect on a
        <code class="text-text-primary">virtualized</code> table, which keeps its own
        <code class="text-text-primary">virtualHeight</code> scroll box.
      </p>
    </div>
  </Section>

  <Section id="caveats" title="Caveats">
    <ul class="text-text-secondary list-disc space-y-2 pl-5 text-sm">
      <li>
        Sticky pinning anchors to the nearest scrollable ancestor, so wrapping the table in a
        container with <code class="text-text-primary">overflow: auto/hidden</code> binds the pin to
        that container. Inside a Drawer body that is what you want. Inside an accidental
        <code class="text-text-primary">overflow</code> wrapper it is why the header stops pinning to
        the page.
      </li>
      <li>
        Enabling <code class="text-text-primary">sticky="header"</code> or
        <code class="text-text-primary">"both"</code>
        disables the table's internal horizontal scrolling, since the scroll area cannot be both a sticky
        pin host and a scroll ancestor. Very wide tables fall back to page-level horizontal scrolling.
        Switch to <code class="text-text-primary">fit="viewport"</code> to contain it instead.
      </li>
      <li>
        <code class="text-text-primary">unstyled</code> mode strips the sticky classes, because
        pinning is a layout function rather than pure styling. Put them back on
        <code class="text-text-primary">slotClasses.toolbar</code>,
        <code class="text-text-primary">slotClasses.thead</code> and
        <code class="text-text-primary">slotClasses.groupHeader</code>, using the offsets the table
        publishes on its container:
        <code class="text-text-primary">--blocks-table-sticky-top</code> (your
        <code class="text-text-primary">stickyOffset</code>),
        <code class="text-text-primary">--blocks-table-toolbar-h</code> and
        <code class="text-text-primary">--blocks-table-thead-h</code>. Each layer's
        <code class="text-text-primary">top</code> is the sum of the ones above it. Keep the
        <code class="text-text-primary">sticky</code> prop set while you do it:
        <code class="text-text-primary">unstyled</code> takes away the classes, not the behaviour, and
        the prop is what attaches the two height measurements. Drop it and both custom properties stay
        unwritten, so every layer pins at the same offset and the group header lands on top of the column
        header.
      </li>
      <li>
        A <code class="text-text-primary">fit="viewport"</code> box reaches the bottom of the
        viewport, so it assumes nothing sits below it. Bottom padding on an ancestor, or a following
        sibling, pushes the page past
        <code class="text-text-primary">100dvh</code> and you get a second scrollbar next to the
        table's own. The container reports its resolved mode as
        <code class="text-text-primary">data-fit="viewport"</code> or
        <code class="text-text-primary">data-fit="content"</code>, so a layout can drop that inset
        wherever the cap applies — which is every width:
        <code class="text-text-primary"
          >{"main:has([data-fit='viewport']) { padding-block-end: 0 }"}</code
        >.
      </li>
    </ul>
  </Section>
</DocsPageLayout>
