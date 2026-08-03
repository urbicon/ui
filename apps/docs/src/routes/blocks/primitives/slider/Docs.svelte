<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, Slider, VolumeIcon, VolumeOffIcon } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

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

    <CodeExample
      title="Volume Control"
      description="Slider in a realistic media player context."
      isolate
      previewClass="flex justify-center max-w-sm w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-4 rounded-2xl border p-5">
        <div class="flex items-center gap-4">
          <VolumeOffIcon size={18} class="text-text-secondary" />
          <div class="flex-1">
            <Slider bind:value={volume} intent="primary" size="sm" />
          </div>
          <VolumeIcon size={18} class="text-text-secondary" />
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

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Slot Overrides"
      description="track, range, and thumb carry the visual weight (wrapper, label, valueText, mark, and message round out the slot set). A slimmer track with a tinted fill and a larger thumb — pointer, keyboard, and range logic stay untouched."
      isolate
      previewClass="flex flex-col gap-3 max-w-sm w-full"
    >
      <Slider
        label="Opacity"
        value={40}
        showValue
        formatValue={(v) => `${v}%`}
        slotClasses={{
          track: 'h-1 bg-primary/15',
          range: 'bg-primary',
          thumb: 'size-5 border-2'
        }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      <code class="text-text-primary">unstyled</code> removes all default classes while
      <code class="text-text-primary">role="slider"</code>, pointer capture, and keyboard stepping
      keep working — rebuild track and thumb through
      <code class="text-text-primary">slotClasses</code>. A control skin shared across sliders (e.g.
      a media-player look) belongs in a
      <code class="text-text-primary">BlocksProvider</code> preset (<code class="text-text-primary"
        >presets.Slider</code
      >) — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA Slider">
      <p>
        Each thumb uses <code class="text-text-primary">role="slider"</code> with
        <code class="text-text-primary">aria-valuemin</code>,
        <code class="text-text-primary">aria-valuemax</code>,
        <code class="text-text-primary">aria-valuenow</code>, and
        <code class="text-text-primary">aria-label</code>. In range mode, thumbs are labelled
        "minimum" and "maximum" for clear identification.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Arrow Right/Up" />
        increases by step,
        <Kbd keys="Arrow Left/Down" />
        decreases.
        <Kbd keys="Page Up/Down" />
        moves by 10x step.
        <Kbd keys="Home/End" />
        jump to min/max.
      </p>
    </Note>
    <Note title="Touch Support">
      <p>
        Uses Pointer Events for unified mouse, touch, and pen support. The
        <code class="text-text-primary">touch-none</code> CSS property prevents browser scroll interference
        during thumb dragging.
      </p>
    </Note>
    <Note title="Focus & Color">
      <p>
        Focus rings use <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
        Intent colors are paired with shape (filled track vs. outlined thumb) so the control remains usable
        without color perception.
      </p>
    </Note>
  </NoteList>
</Section>
