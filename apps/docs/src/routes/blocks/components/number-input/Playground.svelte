<!--
  NumberInput-Playground — neu. `NumberInput` steht im Katalog, hatte aber
  bislang keine Doku-Seite (nur eine e2e-Fixture), also auch kein Beispiel, das
  sich teilen ließe. Zwei Konsumenten: die Doku-Seite und der Landing-Hero.
  Siehe `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { NumberInput } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let value = $state<number | null>(3);

  const controls = deriveControls(componentData, {
    pick: [
      'label',
      'min',
      'max',
      'step',
      'precision',
      'helper',
      'hideStepper',
      'required',
      'readonly',
      'disabled'
    ],
    overrides: {
      // `min`/`max`/`precision` haben in der Komponente keinen Default — die
      // Startwerte hier sind eine Beispiel-Entscheidung.
      label: { defaultValue: 'Quantity' },
      min: { defaultValue: 0 },
      max: { defaultValue: 10 },
      precision: { defaultValue: 0 },
      helper: { defaultValue: 'Use the steppers or the arrow keys.' },
      hideStepper: { label: 'Hide Stepper' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="NumberInput"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
>
  {#snippet children(values)}
    <div class="mx-auto w-full max-w-xs">
      <NumberInput
        bind:value
        label={String(values.label ?? '')}
        min={values.min as number}
        max={values.max as number}
        step={values.step as number}
        precision={values.precision as number}
        helper={String(values.helper ?? '')}
        hideStepper={values.hideStepper as boolean}
        required={values.required as boolean}
        readonly={values.readonly as boolean}
        disabled={values.disabled as boolean}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
