<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { Drawer, Card, Button, Badge } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const { features } = recipeMeta;

  interface TraceNode {
    label: string;
    value: string;
    formula?: string;
    children?: TraceNode[];
    reference?: string;
  }

  // Example trace: "How is heating costs unit 4 = €1,855.47 derived?"
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
</script>

<SeoMeta
  title="Trace Drawer Recipe"
  description="Hierarchical drawer for transparent calculation pipelines."
/>

<div class="mx-auto max-w-5xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <Section id="preview" title="Live Preview">
    <Card variant="outlined">
      <div class="p-8">
        <div
          class="border-border-subtle bg-surface-elevated mx-auto max-w-md rounded-2xl border p-6"
        >
          <h3 class="text-text-primary text-base font-semibold">Heating cost statement unit 4</h3>
          <p class="text-text-tertiary mt-1 text-xs">Billing period 2024</p>
          <div class="mt-4 flex items-baseline justify-between">
            <span class="text-text-secondary text-sm">Allocated heating costs</span>
            <span class="text-text-primary text-2xl font-bold tabular-nums">{trace.value}</span>
          </div>
          <Button
            intent="primary"
            variant="outlined"
            class="mt-4 w-full"
            onclick={() => (drawerOpen = true)}
          >
            Show calculation
          </Button>
        </div>
      </div>
    </Card>
  </Section>

  <Drawer bind:open={drawerOpen} title="How is {trace.value} derived?" placement="right" size="lg">
    <div class="space-y-3">
      {@render TraceNodeRender(trace, 0)}
    </div>

    {#snippet footer()}
      <div class="flex w-full justify-end gap-2">
        <Button intent="neutral" variant="outlined">Export as PDF</Button>
        <Button intent="primary" onclick={() => (drawerOpen = false)}>Close</Button>
      </div>
    {/snippet}
  </Drawer>

  {#snippet TraceNodeRender(node: TraceNode, depth: number)}
    {@const stacked = depth >= 2}
    <Card variant="outlined" padding="sm">
      <div
        class={stacked
          ? 'flex flex-col items-start gap-1'
          : 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'}
      >
        <span class="text-text-primary min-w-0 text-sm font-medium">{node.label}</span>
        <span class="text-text-primary font-semibold tabular-nums">{node.value}</span>
      </div>
      {#if node.formula}
        <p class="text-text-tertiary mt-1 font-mono text-xs break-words">{node.formula}</p>
      {/if}
      {#if node.reference}
        <Badge variant="soft" intent="neutral" size="xs" class="mt-2">
          {node.reference}
        </Badge>
      {/if}
      {#if node.children && node.children.length > 0}
        <ul class="border-border-subtle mt-3 ml-1 space-y-2 border-l pl-3">
          {#each node.children as child (child.label)}
            <li>{@render TraceNodeRender(child, depth + 1)}</li>
          {/each}
        </ul>
      {/if}
    </Card>
  {/snippet}

  <Section id="features" title="Features">
    <RecipeFeatures {features} />
  </Section>

  <Section id="code" title="Code">
    <CodeExample
      title="TraceDrawer.svelte"
      preview={false}
      language="svelte"
      code={`<script lang="ts">
  import { Drawer, Card, Button, Badge } from '@urbicon-ui/blocks';

  interface TraceNode {
    label: string;
    value: string;
    formula?: string;
    children?: TraceNode[];
    reference?: string;
  }

  let { trace, open = $bindable() }: { trace: TraceNode; open: boolean } = $props();
</scr` +
        `ipt>

<Drawer bind:open title={\`How is \${trace.value} derived?\`} placement="right" size="lg">
  {@render TraceNodeRender(trace, 0)}

  {#snippet footer()}
    <Button intent="neutral" variant="outlined">Export as PDF</Button>
    <Button intent="primary" onclick={() => (open = false)}>Close</Button>
  {/snippet}
</Drawer>

{#snippet TraceNodeRender(node, depth)}
  {@const stacked = depth >= 2}
  <Card variant="outlined" padding="sm">
    <div class={stacked
      ? 'flex flex-col items-start gap-1'
      : 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'}>
      <span class="text-text-primary min-w-0 text-sm font-medium">{node.label}</span>
      <span class="text-text-primary tabular-nums font-semibold">{node.value}</span>
    </div>
    {#if node.formula}
      <p class="text-text-tertiary text-xs font-mono mt-1 break-words">{node.formula}</p>
    {/if}
    {#if node.reference}
      <Badge variant="soft" size="xs" class="mt-2">{node.reference}</Badge>
    {/if}
    {#if node.children}
      <ul class="ml-1 mt-3 space-y-2 border-l border-border-subtle pl-3">
        {#each node.children as child (child.label)}
          <li>{@render TraceNodeRender(child, depth + 1)}</li>
        {/each}
      </ul>
    {/if}
  </Card>
{/snippet}`}
    />
  </Section>
</div>
