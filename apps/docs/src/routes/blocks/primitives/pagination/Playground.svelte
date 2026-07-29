<!--
  Pagination-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Pagination } from '@urbicon-ui/blocks';
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
    pick: [
      'currentPage',
      'totalPages',
      'layout',
      'variant',
      'intent',
      'size',
      'mint',
      'visiblePages',
      'showNumbers',
      'showPreviousNext',
      'showFirstLast',
      'showInfo',
      'disabled'
    ],
    overrides: {
      // Zahlen ohne Default in der API: Grenzen und Startwert sind eine
      // Playground-Entscheidung, keine Eigenschaft der Komponente.
      currentPage: { label: 'Current Page', min: 1, max: 20, defaultValue: 5 },
      totalPages: { label: 'Total Pages', min: 1, max: 50, defaultValue: 12 },
      visiblePages: { label: 'Visible Pages', min: 3, max: 9, step: 1, defaultValue: 5 },
      // `MintProp` nimmt Strings, Objekte und Arrays — die vier gebräuchlichen
      // Namen sind eine Auswahl, keine ableitbare Menge.
      mint: {
        type: 'dropdown',
        items: [
          { label: 'none', value: 'none' },
          { label: 'scale', value: 'scale' },
          { label: 'ripple', value: 'ripple' },
          { label: 'glow', value: 'glow' }
        ],
        defaultValue: 'none'
      },
      showNumbers: { label: 'Show Numbers', defaultValue: true },
      showPreviousNext: { label: 'Prev/Next', defaultValue: true },
      showFirstLast: { label: 'First/Last' },
      showInfo: { label: 'Show Info' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Pagination"
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
    <Pagination
      currentPage={values.currentPage}
      totalPages={values.totalPages}
      layout={values.layout}
      variant={values.variant}
      intent={values.intent}
      size={values.size}
      mint={values.mint}
      visiblePages={values.visiblePages}
      showNumbers={values.showNumbers}
      showPreviousNext={values.showPreviousNext}
      showFirstLast={values.showFirstLast}
      showInfo={values.showInfo}
      disabled={values.disabled}
      onPageChange={(p: number) => {
        values.currentPage = p;
      }}
    />
  {/snippet}
</PlaygroundConfigurator>
