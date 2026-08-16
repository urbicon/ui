<script lang="ts">
  import { Badge, Button, Card, Drawer } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  interface TraceNode {
    label: string;
    /** Preformatted, unit included: the engine that calculates knows € from kWh. */
    value: string;
    /** How the children combine into this value. Display text; nothing evaluates it. */
    formula?: string;
    /** The document a leaf cites: a receipt, an invoice, a meter reading. */
    reference?: string;
    children?: TraceNode[];
  }

  // Aggregates carry a formula and children; leaves carry a reference.
  const trace: TraceNode = {
    label: 'Heating costs unit 4',
    value: '€1,855.47',
    formula: 'heating cost pool · WMZ_unit4 / WMZ_total',
    children: [
      {
        label: 'Heating cost pool',
        value: '€3,105.03',
        formula: 'pool · (1 − hot-water share)',
        children: [
          {
            label: 'Heating system pool',
            value: '€3,822.42',
            formula: 'Σ of all fuel and maintenance costs',
            children: [
              {
                label: 'Gas invoice',
                value: '€2,206.09',
                reference: 'Receipt 2024-G-0142'
              },
              {
                label: 'Heat pump electricity',
                value: '€1,127.31',
                reference: 'Receipt 2024-S-0089'
              },
              {
                label: 'Heating system maintenance',
                value: '€361.02',
                reference: 'Invoice Müller GmbH'
              },
              {
                label: 'Chimney sweep',
                value: '€128.00',
                reference: 'Mandatory allocation 2024'
              }
            ]
          },
          {
            label: 'Hot-water share',
            value: '18.77%',
            formula: '2.5 · (V_ww · (60 − 10)) / Q_total'
          }
        ]
      },
      {
        label: 'WMZ share unit 4',
        value: '59.76%',
        formula: 'heat meter consumption / Σ of all units',
        children: [
          { label: 'WMZ unit 4', value: '12,450 kWh', reference: 'Meter reading 2024-12-31' },
          { label: 'WMZ total', value: '20,838 kWh' }
        ]
      }
    ]
  };

  let drawerOpen = $state(false);

  const recipeCode = `<\script lang="ts">
  import { Badge, Button, Card, Drawer } from '@urbicon-ui/blocks';

  interface TraceNode {
    label: string;
    /** Preformatted, unit included: the engine that calculates knows € from kWh. */
    value: string;
    /** How the children combine into this value. Display text; nothing evaluates it. */
    formula?: string;
    /** The document a leaf cites: a receipt, an invoice, a meter reading. */
    reference?: string;
    children?: TraceNode[];
  }

  // Aggregates carry a formula and children; leaves carry a reference.
  const trace: TraceNode = {
    label: 'Heating costs unit 4',
    value: '€1,855.47',
    formula: 'heating cost pool · WMZ_unit4 / WMZ_total',
    children: [
      {
        label: 'Heating cost pool',
        value: '€3,105.03',
        formula: 'pool · (1 − hot-water share)',
        children: [/* … the fuel and maintenance receipts, and the hot-water split … */]
      },
      {
        label: 'WMZ share unit 4',
        value: '59.76%',
        formula: 'heat meter consumption / Σ of all units',
        children: [
          { label: 'WMZ unit 4', value: '12,450 kWh', reference: 'Meter reading 2024-12-31' },
          { label: 'WMZ total', value: '20,838 kWh' }
        ]
      }
    ]
  };

  let drawerOpen = $state(false);
<\/script>

<!-- One snippet for every level: a node renders its row, formula and source,
     then its children through itself. -->
{#snippet traceNode(node: TraceNode, depth: number)}
  <div
    class={[
      'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1',
      depth === 0 ? 'text-base font-semibold' : 'text-sm'
    ]}
  >
    <span class={['text-text-primary', depth > 0 && 'font-medium']}>{node.label}</span>
    <span class={['text-text-primary tabular-nums', depth > 0 && 'font-semibold']}>
      {node.value}
    </span>
  </div>
  {#if node.formula}
    <p class="text-text-tertiary mt-1 font-mono text-xs break-words">{node.formula}</p>
  {/if}
  {#if node.reference}
    <Badge variant="soft" intent="neutral" size="xs" class="mt-2">{node.reference}</Badge>
  {/if}
  {#if node.children?.length}
    <ul class="border-border-subtle mt-3 space-y-3 border-l pl-3">
      {#each node.children as child (child.label)}
        <li>{@render traceNode(child, depth + 1)}</li>
      {/each}
    </ul>
  {/if}
{/snippet}

<!-- The statement tile that carries the trigger; put it wherever the figure
     lives in your page. -->
<div class="w-full max-w-md">
  <Card variant="elevated">
    <h3 class="text-text-primary text-base font-semibold">Heating cost statement unit 4</h3>
    <p class="text-text-tertiary mt-1 text-xs">Billing period 2024</p>
    <div class="mt-4 flex items-baseline justify-between gap-4">
      <span class="text-text-secondary text-sm">Allocated heating costs</span>
      <span class="text-text-primary text-2xl font-bold tabular-nums">{trace.value}</span>
    </div>
    <Button
      intent="primary"
      variant="outlined"
      class="mt-4 w-full"
      onclick={() => (drawerOpen = true)}
    >
      How was this calculated?
    </Button>
  </Card>
</div>

<Drawer
  bind:open={drawerOpen}
  title="How was {trace.value} calculated?"
  placement="right"
  size="lg"
>
  {@render traceNode(trace, 0)}

  {#snippet footer()}
    <div class="flex w-full justify-end gap-2">
      <!-- Stand-in: hand the finished trace to your PDF export. -->
      <Button intent="neutral" variant="outlined">Export as PDF</Button>
      <Button intent="primary" onclick={() => (drawerOpen = false)}>Close</Button>
    </div>
  {/snippet}
</Drawer>`;
</script>

{#snippet traceNode(node: TraceNode, depth: number)}
  <div
    class={[
      'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1',
      depth === 0 ? 'text-base font-semibold' : 'text-sm'
    ]}
  >
    <span class={['text-text-primary', depth > 0 && 'font-medium']}>{node.label}</span>
    <span class={['text-text-primary tabular-nums', depth > 0 && 'font-semibold']}>
      {node.value}
    </span>
  </div>
  {#if node.formula}
    <p class="text-text-tertiary mt-1 font-mono text-xs break-words">{node.formula}</p>
  {/if}
  {#if node.reference}
    <Badge variant="soft" intent="neutral" size="xs" class="mt-2">{node.reference}</Badge>
  {/if}
  {#if node.children?.length}
    <ul class="border-border-subtle mt-3 space-y-3 border-l pl-3">
      {#each node.children as child (child.label)}
        <li>{@render traceNode(child, depth + 1)}</li>
      {/each}
    </ul>
  {/if}
{/snippet}

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="StatementPage.svelte"
      description="Click the question under the figure and follow the value down, formula by formula, to the receipts it came from."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="w-full max-w-md">
        <Card variant="elevated">
          <h3 class="text-text-primary text-base font-semibold">Heating cost statement unit 4</h3>
          <p class="text-text-tertiary mt-1 text-xs">Billing period 2024</p>
          <div class="mt-4 flex items-baseline justify-between gap-4">
            <span class="text-text-secondary text-sm">Allocated heating costs</span>
            <span class="text-text-primary text-2xl font-bold tabular-nums">{trace.value}</span>
          </div>
          <Button
            intent="primary"
            variant="outlined"
            class="mt-4 w-full"
            onclick={() => (drawerOpen = true)}
          >
            How was this calculated?
          </Button>
        </Card>
      </div>

      <Drawer
        bind:open={drawerOpen}
        title="How was {trace.value} calculated?"
        placement="right"
        size="lg"
      >
        {@render traceNode(trace, 0)}

        {#snippet footer()}
          <div class="flex w-full justify-end gap-2">
            <Button intent="neutral" variant="outlined">Export as PDF</Button>
            <Button intent="primary" onclick={() => (drawerOpen = false)}>Close</Button>
          </div>
        {/snippet}
      </Drawer>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="Lines, not boxes">
        <p>
          The obvious rendering is a box per node, and four levels deep it fails: every level spends
          a border and its padding on both sides, so the receipts at the bottom sit in a sliver of
          the drawer. Here the list alone carries the nesting, one
          <code class="text-text-primary">border-l</code> guide line and
          <code class="text-text-primary">pl-3</code> of indent per level. And since no level pads the
          right side, every value keeps the same right edge: the whole trace reads as one column of figures.
        </p>
      </Note>
      <Note title="Values arrive formatted">
        <p>
          <code class="text-text-primary">value</code> is a string because the trace mixes units:
          euros, percentages, kilowatt-hours. Only the calculation that produced a step knows its
          unit and precision, so format where you calculate and hand the drawer a finished trace; it
          never parses a figure. <code class="text-text-primary">formula</code> follows the same rule:
          display text that names what happened, and nothing evaluates it.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
