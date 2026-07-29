<!--
  Kbd-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.

  Der Regler ist ein Textfeld, die Prop nimmt aber `string | string[]` — und die
  Bühne rendert das Array. Ohne `codeSetup` druckte der Schnipsel den Rohtext
  (`keys="⌘, K"`), also **eine** Taste namens „⌘, K" statt der zwei, die oben
  stehen: derselbe Aufruf, anderes Ergebnis. `demoOnly` nimmt den Regler-Wert
  aus dem Tag, `consts` legt das umgewandelte Array daneben.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Kbd } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const controls = deriveControls(componentData, {
    pick: ['keys', 'separator', 'size'],
    overrides: {
      // `keys` ist `string | string[]` — daraus lässt sich kein Control-Typ
      // ableiten. Als Textfeld mit Komma-Trennung deckt es beide Formen ab und
      // macht `separator` überhaupt erst sichtbar.
      keys: { type: 'text', label: 'Keys (comma-separated)', defaultValue: '⌘, K' }
    }
  });

  function toKeys(raw: unknown): string | string[] {
    const text = String(raw ?? '');
    return text.includes(',')
      ? text
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : text;
  }

  let values = $state<Record<string, unknown>>(defaultValuesOf(controls));

  const keys = $derived(toKeys(values.keys));
</script>

<PlaygroundConfigurator
  componentName="Kbd"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  bind:values
  codeSetup={{
    imports: ["import { Kbd } from '@urbicon-ui/blocks';"],
    consts: { keys },
    bind: ['keys'],
    demoOnly: ['keys']
  }}
>
  {#snippet children(values)}
    <Kbd {keys} separator={String(values.separator ?? '+')} size={values.size} />
  {/snippet}
</PlaygroundConfigurator>
