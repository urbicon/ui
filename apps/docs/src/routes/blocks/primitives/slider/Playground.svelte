<!--
  Slider-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Slider } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // Werte und Defaults kommen aus der generierten API — was die Komponente
  // kann, steht damit auch im Playground. Hand angelegt wird nur, was sich
  // nicht ableiten lässt.
  const controls = deriveControls(componentData, {
    pick: ['variant', 'intent', 'size', 'step', 'range', 'showValue', 'disabled', 'error'],
    overrides: {
      // `step` ist ein freies `number`-Prop; als Zahlenfeld wäre es im
      // Playground unhandlich, darum eine kuratierte Auswahl.
      step: {
        type: 'dropdown',
        items: [1, 5, 10, 25].map((v) => ({ label: String(v), value: v })),
        defaultValue: 1
      },
      // Playground-Konvenienz: Die Komponente steht auf `false`, hier ist der
      // Wert sichtbar interessanter.
      showValue: { defaultValue: true }
    },
    extra: [
      // Kein Prop, sondern ein Demo-Schalter: Er reicht `marks={[…]}` durch.
      { type: 'checkbox', key: 'showMarks', label: 'Show marks', defaultValue: false, at: 6 }
    ]
  });

  // Live demo state — two separate slots so `bind:value` keeps a stable
  // shape (number vs tuple) when the range toggle flips. Svelte's
  // `bind:value` does not accept ternary expressions, so we render two
  // sibling sliders in the snippet and pick one based on `range`.
  let singleValue = $state(65);
  let rangeValue = $state<[number, number]>([20, 80]);

  const demoMarks = [
    { value: 0, label: '0' },
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 75, label: '75' },
    { value: 100, label: '100' }
  ];

  // The playground exposes `showMarks` as a boolean knob for ergonomics,
  // but the real prop is `marks={[…]}`. Rewrite the generated snippet so
  // copy-paste yields actual API calls, not playground state names.
  // We filter against the Slider component defaults (NOT the playground
  // defaults — `showValue=true` is a playground convenience, the
  // component itself defaults to `false`).
  const componentDefaults: Record<string, unknown> = {
    variant: 'default',
    intent: 'primary',
    size: 'md',
    step: 1,
    range: false,
    showValue: false,
    disabled: false
  };

  function formatProp(key: string, value: unknown): string {
    if (typeof value === 'boolean') return value ? key : `${key}={false}`;
    if (typeof value === 'string') return `${key}="${value}"`;
    return `${key}={${JSON.stringify(value)}}`;
  }

  function generateSliderCode(values: Record<string, unknown>): string {
    const props: string[] = [];

    for (const [key, value] of Object.entries(values)) {
      if (key === 'showMarks') continue; // handled separately
      if (key in componentDefaults && componentDefaults[key] === value) continue;
      if (value === null || value === undefined) continue;
      props.push(formatProp(key, value));
    }

    if (values.showMarks === true) {
      const inline = demoMarks.map((m) => `{ value: ${m.value}, label: '${m.label}' }`).join(', ');
      props.push(`marks={[${inline}]}`);
    }

    props.sort();

    if (!props.length) return `<Slider label="Volume" />`;
    const indent = props.map((p) => `  ${p}`).join('\n');
    return `<Slider\n  label="Volume"\n${indent}\n/>`;
  }
</script>

<PlaygroundConfigurator
  componentName="Slider"
  codeGenerator={generateSliderCode}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Slider } from '@urbicon-ui/blocks';"],
    state: { value: rangeValue },
    bind: ['value'],
    twoWay: ['value']
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-md">
      {#if values.range}
        <Slider
          label="Volume"
          bind:value={rangeValue}
          variant={values.variant}
          intent={values.intent}
          size={values.size}
          step={values.step}
          showValue={values.showValue}
          marks={values.showMarks ? demoMarks : undefined}
          disabled={values.disabled}
          error={values.error || undefined}
          range
        />
      {:else}
        <Slider
          label="Volume"
          bind:value={singleValue}
          variant={values.variant}
          intent={values.intent}
          size={values.size}
          step={values.step}
          showValue={values.showValue}
          marks={values.showMarks ? demoMarks : undefined}
          disabled={values.disabled}
          error={values.error || undefined}
        />
      {/if}
    </div>
  {/snippet}
</PlaygroundConfigurator>
