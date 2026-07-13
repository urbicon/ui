<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Slider } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['intent', 'size', 'showValue', 'disabled'],
        defaults: { intent: 'primary', size: 'md' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Slider Component', showToc: true }
  };

  let volume = $state(65);
  let brightness = $state(80);
  let priceRange = $state<[number, number]>([100, 400]);
  let temperature = $state(22);
  let consumptionShare = $state(70);
  let waterTemperature = $state(60);
  let amortYears = $state(15);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Range Mode"
      description="Two thumbs for selecting a numeric range — bind to a `[min, max]` tuple."
      isolate
      previewClass="flex flex-col gap-3 max-w-sm w-full"
    >
      <Slider
        label="Price range"
        range
        bind:value={priceRange}
        min={0}
        max={500}
        step={10}
        showValue
        formatValue={(v) => {
          if (Array.isArray(v)) return `$${v[0]} – $${v[1]}`;
          return `$${v}`;
        }}
      />
    </CodeExample>

    <CodeExample
      title="With Marks"
      description="Labelled tick marks for key values along the track. `step` snaps the thumb to whole increments."
      isolate
      previewClass="flex flex-col gap-3 max-w-sm w-full pb-6"
    >
      <Slider
        label="Temperature"
        bind:value={temperature}
        min={16}
        max={30}
        step={1}
        showValue
        formatValue={(v) => `${v}°C`}
        marks={[
          { value: 16, label: '16°' },
          { value: 20, label: '20°' },
          { value: 24, label: '24°' },
          { value: 28, label: '28°' },
          { value: 30, label: '30°' }
        ]}
      />
    </CodeExample>

    <CodeExample
      title="Valid & Recommended Range"
      description="Three-zone track for domain-specific constraints. validRange is the hard limit (red on violation), recommendedRange the UX recommendation (green), with a warning zone (yellow) in between."
      isolate
      previewClass="flex flex-col gap-6 max-w-sm w-full"
    >
      <Slider
        label="Consumption-based share of heating costs"
        bind:value={consumptionShare}
        min={0}
        max={100}
        step={5}
        validRange={[50, 100]}
        recommendedRange={[60, 80]}
        showValue
        formatValue={(v) => `${v} %`}
        rangeStatusText={{
          insideRecommended: 'Billing-regulation standard (recommended)',
          insideValidOnly: 'Compliant with the billing regulation, but outside the recommendation',
          outsideValid: 'Billing-regulation violation: at least 50 % must be consumption-based'
        }}
      />
      <Slider
        label="Hot water temperature"
        bind:value={waterTemperature}
        min={40}
        max={80}
        step={1}
        validRange={[60, 80]}
        showValue
        formatValue={(v) => `${v} °C`}
        rangeStatusText={{
          insideRecommended: 'Legionella protection satisfied',
          outsideValid: 'Legionella risk: at least 60 °C recommended'
        }}
      />
      <Slider
        label="Payback period"
        bind:value={amortYears}
        min={0}
        max={30}
        step={1}
        recommendedRange={[10, 20]}
        outOfValidRangeIntent="warning"
        showValue
        formatValue={(v) => `${v} years`}
        rangeStatusText={{
          insideRecommended: 'Economically viable corridor',
          insideValidOnly: 'Outside the typical corridor'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Helper & Error"
      description="Group-level helper and error text follow the same form-field contract as Input — `error` overrides `helper` when both are set."
      isolate
      previewClass="flex flex-col gap-5 max-w-sm w-full"
    >
      <Slider
        label="Brightness"
        bind:value={brightness}
        showValue
        formatValue={(v) => `${v}%`}
        helper="Adjust screen brightness"
      />
      <Slider
        label="Budget"
        value={0}
        showValue
        formatValue={(v) => `$${v}`}
        error="Please set a budget above $0"
      />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Volume Control"
      description="Slider in a realistic media player context."
      isolate
      previewClass="flex justify-center max-w-sm w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-4 rounded-2xl border p-5">
        <div class="flex items-center gap-4">
          <span class="text-text-secondary text-sm">🔈</span>
          <div class="flex-1">
            <Slider bind:value={volume} intent="primary" size="sm" />
          </div>
          <span class="text-text-secondary text-sm">🔊</span>
        </div>
        <p class="text-text-tertiary text-center text-xs">{volume}%</p>
      </div>
    </CodeExample>

    <CodeExample
      title="Price Filter"
      description="Range slider for filtering products by price."
      isolate
      previewClass="flex justify-center max-w-sm w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-3 rounded-2xl border p-5">
        <Slider
          label="Price Range"
          range
          bind:value={priceRange}
          min={0}
          max={1000}
          step={25}
          showValue
          intent="success"
          formatValue={(v) => {
            if (Array.isArray(v)) return `$${v[0]} – $${v[1]}`;
            return `$${v}`;
          }}
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
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA Slider</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Each thumb uses <code class="text-text-primary">role="slider"</code> with
          <code class="text-text-primary">aria-valuemin</code>,
          <code class="text-text-primary">aria-valuemax</code>,
          <code class="text-text-primary">aria-valuenow</code>, and
          <code class="text-text-primary">aria-label</code>. In range mode, thumbs are labelled
          "minimum" and "maximum" for clear identification.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Arrow Right/Up</kbd
          >
          increases by step,
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Arrow Left/Down</kbd
          >
          decreases.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Page Up/Down</kbd
          >
          moves by 10x step.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Home/End</kbd
          >
          jump to min/max.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Touch Support</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Uses Pointer Events for unified mouse, touch, and pen support. The
          <code class="text-text-primary">touch-none</code> CSS property prevents browser scroll interference
          during thumb dragging.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Focus & Color</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Focus rings use <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
          Intent colors are paired with shape (filled track vs. outlined thumb) so the control remains
          usable without color perception.
        </p>
      </div>
    </div>
  </div>
</Section>
