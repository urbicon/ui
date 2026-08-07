<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, Sankey, type SankeyLink, type SankeyNode } from '@urbicon-ui/blocks';

  const formatEur = (cents: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cents / 100);

  // 5-stage heating cost Sankey: sources → pot → heating/hot water → units
  const heatingNodes: SankeyNode[] = [
    { id: 'gas', label: 'Gas bill', intent: 'primary' },
    { id: 'wp', label: 'Heat pump electricity', intent: 'secondary' },
    { id: 'wartung', label: 'Maintenance', intent: 'success' },
    { id: 'schorn', label: 'Chimney sweep', intent: 'warning' },
    { id: 'topf', label: 'Heating cost pot', intent: 'neutral' },
    { id: 'heiz', label: 'Heating', intent: 'primary' },
    { id: 'ww', label: 'Hot water', intent: 'secondary' },
    { id: 'we4', label: 'Unit 4', intent: 'neutral' },
    { id: 'we4a', label: 'Unit 4A', intent: 'neutral' }
  ];

  const heatingLinks: SankeyLink[] = [
    { source: 'gas', target: 'topf', value: 220609 },
    { source: 'wp', target: 'topf', value: 112731 },
    { source: 'wartung', target: 'topf', value: 36102 },
    { source: 'schorn', target: 'topf', value: 12800 },
    { source: 'topf', target: 'heiz', value: 310503 },
    { source: 'topf', target: 'ww', value: 71739 },
    { source: 'heiz', target: 'we4', value: 185547 },
    { source: 'heiz', target: 'we4a', value: 124956 },
    { source: 'ww', target: 'we4', value: 39477 },
    { source: 'ww', target: 'we4a', value: 32262 }
  ];

  const salaryNodes: SankeyNode[] = [
    { id: 'brutto', label: 'Gross salary', intent: 'primary' },
    { id: 'lst', label: 'Income tax', intent: 'danger' },
    { id: 'sv', label: 'Social contributions', intent: 'warning' },
    { id: 'kv', label: 'Health insurance', intent: 'warning' },
    { id: 'rv', label: 'Pension insurance', intent: 'warning' },
    { id: 'av', label: 'Unemployment ins.', intent: 'warning' },
    { id: 'pv', label: 'Long-term care', intent: 'warning' },
    { id: 'netto', label: 'Net pay', intent: 'success' }
  ];
  const salaryLinks: SankeyLink[] = [
    { source: 'brutto', target: 'lst', value: 850 },
    { source: 'brutto', target: 'sv', value: 1080 },
    { source: 'sv', target: 'kv', value: 360 },
    { source: 'sv', target: 'rv', value: 480 },
    { source: 'sv', target: 'av', value: 90 },
    { source: 'sv', target: 'pv', value: 150 },
    { source: 'brutto', target: 'netto', value: 2570 }
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
  <div class="space-y-8">
    <CodeExample
      title="5-Stage Heating Cost Flow"
      description="Complete service-charge example: sources (gas, heat pump, maintenance, chimney sweep) → heating cost pot → heating/hot water → residential units."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-4xl">
        <Sankey nodes={heatingNodes} links={heatingLinks} formatValue={formatEur} height={500} />
      </div>
    </CodeExample>

    <CodeExample
      title="Salary Breakdown"
      description="Gross salary → income tax / social contributions / net pay. Social contributions branch further into health, pension, unemployment, and care insurance."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-3xl">
        <Sankey
          nodes={salaryNodes}
          links={salaryLinks}
          formatValue={(v) => `${v.toLocaleString('de-DE')} €`}
          height={400}
        />
      </div>
    </CodeExample>

    <CodeExample
      title="Node Alignments"
      description="Four layer alignments. The early sink (B) lands in different positions depending on alignment — justify pushes it all the way right, left keeps it at its source layer."
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
      title="Compact Embedding"
      description="A small height embedded in a card — the layout adapts automatically."
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
          formatValue={(v) => `${v} %`}
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
      title="Custom Tooltip"
      description="Custom tooltip content with a conditionally formatted detail field."
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
        SVG with role="img"
      {/snippet}
      <p>
        The SVG has <code class="text-text-primary">role="img"</code> with an
        <code class="text-text-primary">aria-label</code> that lists every connection ("Source → Target:
        value"). A screen reader announces the diagram in a single block.
      </p>
    </Note>
    <Note title="Table Fallback">
      <p>
        An sr-only table (source / target / value) is rendered in addition — screen readers that
        prefer tables can query the data row by row.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="Tab" />
        focuses every node and link in sequence. On a focused element,
        <Kbd keys="Enter" />/<Kbd keys="Space" />
        triggers the click handler (onNodeClick / onLinkClick).
      </p>
    </Note>
    <Note title="Hover + Focus Highlight">
      <p>
        Hovering or focusing a node dims all unconnected paths and nodes and highlights its direct
        connections.
      </p>
    </Note>
  </NoteList>
</Section>
