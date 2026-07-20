<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { CompositionBar, type CompositionItem } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: true, order: 1 },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: { include: true },
    meta: { title: 'CompositionBar Component', showToc: true }
  };

  const formatEur = (cents: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cents / 100);

  const heatingItems: CompositionItem[] = [
    { label: 'Gas bill', value: 220609, intent: 'primary' },
    { label: 'Heat pump electricity', value: 112731, intent: 'secondary' },
    { label: 'Heating system maintenance', value: 36102, intent: 'success' },
    { label: 'Chimney sweep levy', value: 12800, intent: 'warning' }
  ];

  const budgetItems: CompositionItem[] = [
    { label: 'Rent', value: 145000, intent: 'primary' },
    { label: 'Groceries', value: 48000, intent: 'success' },
    { label: 'Electricity & gas', value: 22000, intent: 'warning' },
    { label: 'Mobility', value: 18000, intent: 'secondary' },
    { label: 'Savings', value: 32000, intent: 'neutral' }
  ];

  const tinyItems: CompositionItem[] = [
    { label: 'Main share', value: 950, intent: 'primary' },
    { label: 'Mini A', value: 8, intent: 'success' },
    { label: 'Mini B', value: 3, intent: 'warning' },
    { label: 'Mini C', value: 5, intent: 'danger' }
  ];

  const tokenItems: CompositionItem[] = [
    { label: 'Treasury', value: 40, color: '#6366f1' },
    { label: 'Liquidity', value: 30, color: '#8b5cf6' },
    { label: 'Team', value: 15, color: '#f59e0b' },
    { label: 'Community', value: 15, color: '#10b981' }
  ];
</script>

<!-- ─── Examples ─── -->
<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Heating Cost Pot"
      description="Stacked bar as a cost-pot composition: gas + heat pump electricity + maintenance + chimney sweep add up to the heating cost pot of a service charge statement."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-xl">
        <CompositionBar
          items={heatingItems}
          formatValue={formatEur}
          size="lg"
          legendPlacement="bottom"
          showTotal
          totalLabel="Heating cost pot 2024"
        />
      </div>
    </CodeExample>

    <CodeExample
      title="Sizes"
      description="Three height steps for different levels of hierarchy."
      isolate
      previewClass="flex flex-col gap-6 w-full p-6"
    >
      <div class="w-full max-w-xl space-y-6">
        <CompositionBar items={budgetItems} formatValue={formatEur} size="sm" />
        <CompositionBar items={budgetItems} formatValue={formatEur} size="md" />
        <CompositionBar items={budgetItems} formatValue={formatEur} size="lg" />
      </div>
    </CodeExample>

    <CodeExample
      title="Legend Placement"
      description="Four anchor positions for the legend (top, right, bottom, left)."
      isolate
      previewClass="flex flex-col gap-6 w-full p-6"
    >
      <div class="w-full max-w-xl space-y-6">
        <CompositionBar
          items={budgetItems}
          formatValue={formatEur}
          legendPlacement="top"
          showTotal
          totalLabel="Top"
        />
        <CompositionBar
          items={budgetItems}
          formatValue={formatEur}
          legendPlacement="right"
          showTotal
          totalLabel="Right"
        />
        <CompositionBar
          items={budgetItems}
          formatValue={formatEur}
          legendPlacement="bottom"
          showTotal
          totalLabel="Bottom"
        />
        <CompositionBar
          items={budgetItems}
          formatValue={formatEur}
          legendPlacement="left"
          showTotal
          totalLabel="Left"
        />
      </div>
    </CodeExample>

    <CodeExample
      title="Vertical Orientation"
      description="Stacked column for vertical layouts (e.g. sidebar visualizations)."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="flex h-64 w-full max-w-md items-stretch justify-center">
        <CompositionBar
          items={heatingItems}
          formatValue={formatEur}
          orientation="vertical"
          size="lg"
          legendPlacement="right"
        />
      </div>
    </CodeExample>

    <CodeExample
      title="Tiny Segments"
      description="Very small segments are raised to a minimum width so hover and tooltip still work on them."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-xl">
        <CompositionBar items={tinyItems} formatValue={(v) => `${v}`} size="lg" />
      </div>
    </CodeExample>

    <CodeExample
      title="Total Override (Remainder)"
      description="If the explicit total exceeds Σ items.value, the unaccounted share is rendered as a dashed remainder area."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-xl">
        <CompositionBar
          items={heatingItems}
          total={500000}
          formatValue={formatEur}
          size="lg"
          showTotal
          totalLabel="Expected 5.000,00 €"
        />
      </div>
    </CodeExample>

    <CodeExample
      title="Raw Color Overrides"
      description="Per-item color prop for brand-specific palettes (e.g. token allocations)."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-xl">
        <CompositionBar
          items={tokenItems}
          formatValue={(v) => `${v} %`}
          formatPercent={(p) => `${Math.round(p)} %`}
          size="lg"
          legendPlacement="bottom"
        />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Custom Tooltip Snippet"
      description="Custom tooltip content with additional metadata via the tooltip snippet."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="w-full max-w-xl">
        <CompositionBar items={heatingItems} formatValue={formatEur} size="lg">
          {#snippet tooltip(item, percent)}
            <span class="block font-medium">{item.label}</span>
            <span class="text-text-tertiary block text-2xs tabular-nums">
              {formatEur(item.value)} · {Math.round(percent)} %
            </span>
            {#if item.intent === 'warning'}
              <span class="text-warning mt-1 block text-3xs tracking-wide uppercase">
                statutory levy
              </span>
            {/if}
          {/snippet}
        </CompositionBar>
      </div>
    </CodeExample>

    <CodeExample
      title="Compact Card Embedding"
      description="Embedded in a card with a header at the sm size."
      isolate
      previewClass="flex justify-center w-full p-6"
    >
      <div class="border-border-subtle bg-surface-elevated w-full max-w-md rounded-2xl border p-5">
        <header class="mb-3 flex items-baseline justify-between">
          <h3 class="text-text-primary text-sm font-semibold">Treasury Allocation</h3>
          <span class="text-text-tertiary text-xs">Q1 2026</span>
        </header>
        <CompositionBar
          items={tokenItems}
          formatValue={(v) => `${v} %`}
          formatPercent={(p) => `${Math.round(p)} %`}
          size="sm"
          legendPlacement="bottom"
        />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA Image Role + Summary</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The bar container has <code class="text-text-primary">role="img"</code> with a combined
          <code class="text-text-primary">aria-label</code> summary (total plus each share with value
          and percent), so screen readers can grasp the bar as a whole.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Table Fallback</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          An sr-only table duplicates the data in tabular form (share / value / percent) for screen
          readers that prefer tables over images.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard Navigation</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs"
            >Tab</kbd
          >
          focuses the next segment,
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs"
            >Arrow keys</kbd
          >
          move between segments,
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs"
            >Home</kbd
          >
          /<kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs"
            >End</kbd
          >
          jump to the first/last,
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs"
            >Enter</kbd
          >/<kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs"
            >Space</kbd
          > triggers onItemSelect.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Bidirectional Highlight</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Hovering or focusing a bar segment dims all other segments AND highlights the matching
          legend entry (and vice versa) — the link runs through the shared
          <code class="text-text-primary">item.id</code>
          (fallback: index).
        </p>
      </div>
    </div>
  </div>
</Section>
