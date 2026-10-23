<script lang="ts">
  import { Kbd, Sankey, type SankeyLink, type SankeyNode } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';

  const formatEur = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cents / 100);

  // 5-stage heating cost Sankey: sources → pot → heating/hot water → units
  const heatingNodes: SankeyNode[] = [
    { id: 'gas', label: 'Gas bill', intent: 'primary' },
    { id: 'heatPump', label: 'Heat pump electricity', intent: 'secondary' },
    { id: 'maintenance', label: 'Maintenance', intent: 'success' },
    { id: 'chimney', label: 'Chimney sweep', intent: 'warning' },
    { id: 'pot', label: 'Heating cost pot', intent: 'neutral' },
    { id: 'heating', label: 'Heating', intent: 'primary' },
    { id: 'hotWater', label: 'Hot water', intent: 'secondary' },
    { id: 'unit4', label: 'Unit 4', intent: 'neutral' },
    { id: 'unit4a', label: 'Unit 4A', intent: 'neutral' }
  ];

  const heatingLinks: SankeyLink[] = [
    { source: 'gas', target: 'pot', value: 220609 },
    { source: 'heatPump', target: 'pot', value: 112731 },
    { source: 'maintenance', target: 'pot', value: 36102 },
    { source: 'chimney', target: 'pot', value: 12800 },
    { source: 'pot', target: 'heating', value: 310503 },
    { source: 'pot', target: 'hotWater', value: 71739 },
    { source: 'heating', target: 'unit4', value: 185547 },
    { source: 'heating', target: 'unit4a', value: 124956 },
    { source: 'hotWater', target: 'unit4', value: 39477 },
    { source: 'hotWater', target: 'unit4a', value: 32262 }
  ];

  const salaryNodes: SankeyNode[] = [
    { id: 'gross', label: 'Gross salary', intent: 'primary' },
    { id: 'incomeTax', label: 'Income tax', intent: 'danger' },
    { id: 'social', label: 'Social contributions', intent: 'warning' },
    { id: 'health', label: 'Health insurance', intent: 'warning' },
    { id: 'pension', label: 'Pension insurance', intent: 'warning' },
    { id: 'unemployment', label: 'Unemployment ins.', intent: 'warning' },
    { id: 'care', label: 'Long-term care', intent: 'warning' },
    { id: 'net', label: 'Net pay', intent: 'success' }
  ];
  const salaryLinks: SankeyLink[] = [
    { source: 'gross', target: 'incomeTax', value: 850 },
    { source: 'gross', target: 'social', value: 1080 },
    { source: 'social', target: 'health', value: 360 },
    { source: 'social', target: 'pension', value: 480 },
    { source: 'social', target: 'unemployment', value: 90 },
    { source: 'social', target: 'care', value: 150 },
    { source: 'gross', target: 'net', value: 2570 }
  ];

  const minimalNodes: SankeyNode[] = [
    { id: 'a', label: 'Source', intent: 'primary' },
    { id: 'b', label: 'Target', intent: 'success' }
  ];
  const minimalLinks: SankeyLink[] = [{ source: 'a', target: 'b', value: 100 }];

  // Three-layer example for the alignment demo: sinks end up in different
  // positions depending on alignment
  const alignmentNodes: SankeyNode[] = [
    { id: 'src', label: 'Source', intent: 'primary' },
    { id: 'mid', label: 'Mid', intent: 'neutral' },
    { id: 'a', label: 'A', intent: 'success' },
    { id: 'b', label: 'B (early sink)', intent: 'warning' }
  ];
  // src→mid→a (3 layers); src→b is an "early sink" and moves to different
  // positions depending on alignment
  const alignmentLinks: SankeyLink[] = [
    { source: 'src', target: 'mid', value: 60 },
    { source: 'mid', target: 'a', value: 60 },
    { source: 'src', target: 'b', value: 30 }
  ];
</script>

<!-- ─── Examples ─── -->
<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    A <code class="text-text-primary">SankeyNode</code> has an
    <code class="text-text-primary">id</code>, a <code class="text-text-primary">label</code>, and
    an
    <code class="text-text-primary">intent</code> for its colour (<code class="text-text-primary"
      >primary</code
    >, <code class="text-text-primary">success</code>,
    <code class="text-text-primary">warning</code>,
    <code class="text-text-primary">danger</code>, <code class="text-text-primary">neutral</code>,
    …). A <code class="text-text-primary">SankeyLink</code> joins a
    <code class="text-text-primary">source</code> id to a
    <code class="text-text-primary">target</code>
    id with a <code class="text-text-primary">value</code>. The layout sizes and places every node
    and band from those values, so you pass data, not coordinates.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Heating cost flow"
      description="A multi-source, multi-sink flow: each band's thickness is its share of the pot."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-4xl">
        <Sankey nodes={heatingNodes} links={heatingLinks} formatValue={formatEur} height={500} />
      </div>
    </CodeExample>

    <CodeExample
      title="Salary breakdown"
      description="A node can be both a target and a source: social contributions receive from gross pay, then split again."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-3xl">
        <Sankey
          nodes={salaryNodes}
          links={salaryLinks}
          formatValue={(v) => `€${v.toLocaleString('en-US')}`}
          height={400}
        />
      </div>
    </CodeExample>

    <CodeExample
      title="Node alignments"
      description="Four layer alignments. A node whose links end before the last layer (B here) lands differently: `justify` pushes it to the right edge, `left` keeps it at its source layer."
      isolate
      previewClass="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full p-6"
    >
      {#each ['justify', 'left', 'right', 'center'] as align (align)}
        <div class="border-border-subtle bg-surface-elevated rounded-contain border p-3">
          <h4 class="text-text-secondary mb-2 text-xs font-medium tracking-wide uppercase">
            {align}
          </h4>
          <Sankey
            nodes={alignmentNodes}
            links={alignmentLinks}
            formatValue={(v) => `${v}`}
            height={180}
            nodeAlign={align as 'justify' | 'left' | 'right' | 'center'}
          />
        </div>
      {/each}
    </CodeExample>

    <CodeExample
      title="Compact embedding"
      description="A small height inside a card; the layout adapts to fit."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="border-border-subtle bg-surface-elevated w-full max-w-md rounded-2xl border p-5">
        <header class="mb-3">
          <h3 class="text-text-primary text-sm font-semibold">Cashflow Overview</h3>
          <p class="text-text-tertiary text-xs">Q1 2026</p>
        </header>
        <Sankey
          nodes={minimalNodes}
          links={minimalLinks}
          formatValue={(v) => `${v}%`}
          height={140}
          nodeWidth={16}
          nodePadding={10}
        />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Custom tooltip"
      description="The `tooltip` snippet receives the hovered `datum` and a `kind` of `'node'` or `'link'`."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-3xl">
        <Sankey nodes={heatingNodes} links={heatingLinks} formatValue={formatEur} height={400}>
          {#snippet tooltip(datum, kind)}
            {#if kind === 'node'}
              {@const node = datum as { id: string; value: number }}
              <span class="block font-medium">{node.id}</span>
              <span class="text-text-tertiary text-2xs block tabular-nums">
                {formatEur(node.value)}
              </span>
            {:else}
              {@const link = datum as {
                source: { id: string };
                target: { id: string };
                value: number;
              }}
              <span class="block font-medium">
                {link.source.id} → {link.target.id}
              </span>
              <span class="text-primary text-2xs block font-semibold tabular-nums">
                {formatEur(link.value)}
              </span>
            {/if}
          {/snippet}
        </Sankey>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note>
      {#snippet titleSnippet()}
        SVG with role="group"
      {/snippet}
      <p>
        The SVG is a named <code class="text-text-primary">role="group"</code> whose
        <code class="text-text-primary">aria-label</code> lists every connection ("Source → Target:
        value"). Each node and link inside is a focusable button named by its labels; a group rather
        than <code class="text-text-primary">role="img"</code>, which would hide those buttons from
        assistive technology.
      </p>
    </Note>
    <Note title="Table fallback">
      <p>
        An sr-only table (source / target / value) is rendered in addition — screen readers that
        prefer tables can query the data row by row.
      </p>
    </Note>
    <Note title="Keyboard navigation">
      <p>
        <Kbd keys="Tab" />
        focuses every node and link in sequence. On a focused element,
        <Kbd keys="Enter" />/<Kbd keys="Space" />
        triggers the click handler (onNodeClick / onLinkClick).
      </p>
    </Note>
    <Note title="Hover and focus highlight">
      <p>
        Hovering or focusing a node dims all unconnected paths and nodes and highlights its direct
        connections.
      </p>
    </Note>
  </NoteList>
</Section>
