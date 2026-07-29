<!--
  Breadcrumb-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Breadcrumb } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const demoNoop = (event: MouseEvent) => event.preventDefault();

  // Sechs Stufen, nicht vier: `maxItems` kollabiert erst, wenn es etwas zu
  // kollabieren gibt, und `wrap` zeigt sich erst an einem Trail, das die Zeile
  // wirklich füllt. Mit dem alten Vier-Stufen-Trail wären beide Regler
  // folgenlos gewesen — die Klasse Fehler, die dieser Durchgang neunmal fand.
  const playgroundItems = [
    { label: 'Home', href: '#', onclick: demoNoop },
    { label: 'Store', href: '#', onclick: demoNoop },
    { label: 'Audio', href: '#', onclick: demoNoop },
    { label: 'Products', href: '#', onclick: demoNoop },
    { label: 'Headphones', href: '#', onclick: demoNoop },
    { label: 'AirPods Max' }
  ];

  const controls = deriveControls(componentData, {
    // `separator` fehlt bewusst: Es ist ein Snippet, und dafür hat das
    // Regler-Modell keine Form — das gehört als Beispiel auf die Doku-Seite.
    pick: ['size', 'maxItems', 'expandLabel', 'wrap'],
    overrides: {
      maxItems: {
        type: 'dropdown',
        label: 'Max Items',
        items: [
          { label: 'off', value: undefined },
          { label: '3', value: 3 },
          { label: '4', value: 4 },
          { label: '5', value: 5 }
        ]
      },
      // Der Regler wirkt, aber nur für Screenreader: Er setzt das `aria-label`
      // des Expand-Knopfes, dessen sichtbarer Text „…" bleibt. Ohne den Zusatz
      // liest er sich wie ein toter Regler (derselbe Fall wie Spinner `label`).
      expandLabel: { label: 'Expand Label (screen reader)' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Breadcrumb"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Breadcrumb } from '@urbicon-ui/blocks';"],
    // Ohne `onclick: demoNoop`: Das ist der Klick-Blocker der Doku-Seite, kein
    // Teil der API. Der Schnipsel zeigt die Daten, die ein Konsument schreibt.
    consts: { items: playgroundItems.map(({ onclick: _drop, ...item }) => item) },
    bind: ['items']
  }}
>
  {#snippet children(values)}
    <Breadcrumb
      items={playgroundItems}
      size={values.size}
      maxItems={values.maxItems}
      expandLabel={values.expandLabel}
      wrap={values.wrap}
    />
  {/snippet}
</PlaygroundConfigurator>
