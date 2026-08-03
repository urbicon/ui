<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { CompositionBar, Kbd, type CompositionItem } from '@urbicon-ui/blocks';

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
            <span class="text-text-tertiary text-2xs block tabular-nums">
              {formatEur(item.value)} · {Math.round(percent)} %
            </span>
            {#if item.intent === 'warning'}
              <span class="text-warning text-3xs mt-1 block tracking-wide uppercase">
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
  <NoteList>
    <Note title="ARIA Image Role + Summary">
      <p>
        The bar container has <code class="text-text-primary">role="img"</code> with a combined
        <code class="text-text-primary">aria-label</code> summary (total plus each share with value and
        percent), so screen readers can grasp the bar as a whole.
      </p>
    </Note>
    <Note title="Table Fallback">
      <p>
        An sr-only table duplicates the data in tabular form (share / value / percent) for screen
        readers that prefer tables over images.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="Tab" />
        focuses the next segment,
        <Kbd keys="Arrow keys" />
        move between segments,
        <Kbd keys="Home" />
        /<Kbd keys="End" />
        jump to the first/last,
        <Kbd keys="Enter" />/<Kbd keys="Space" /> triggers onItemSelect.
      </p>
    </Note>
    <Note title="Bidirectional Highlight">
      <p>
        Hovering or focusing a bar segment dims all other segments AND highlights the matching
        legend entry (and vice versa) — the link runs through the shared
        <code class="text-text-primary">item.id</code>
        (fallback: index).
      </p>
    </Note>
  </NoteList>
</Section>
