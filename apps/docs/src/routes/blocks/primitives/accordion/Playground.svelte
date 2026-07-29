<!--
  Accordion-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Accordion, AccordionItem } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  function accordionCodeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      variant: 'default',
      size: 'md',
      type: 'single',
      collapsible: true,
      disabled: false
    };

    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false) return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'boolean') return value ? key : '';
        if (typeof value === 'string') return `${key}="${value}"`;
        return `${key}={${JSON.stringify(value)}}`;
      })
      .filter(Boolean);

    const propsStr = props.length > 0 ? ` ${props.join(' ')}` : '';

    return `<Accordion${propsStr}>
  <AccordionItem value="item-1" title="Section One">
    Content for the first section.
  </AccordionItem>
  <AccordionItem value="item-2" title="Section Two">
    Content for the second section.
  </AccordionItem>
  <AccordionItem value="item-3" title="Section Three">
    Content for the third section.
  </AccordionItem>
</Accordion>`;
  }

  const controls = deriveControls(componentData, {
    pick: ['variant', 'size', 'type', 'collapsible', 'disabled'],
    overrides: {
      collapsible: { defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Accordion"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeGenerator={accordionCodeGenerator}
>
  {#snippet children(values)}
    <div class="w-full max-w-lg">
      <Accordion
        variant={values.variant}
        size={values.size}
        type={values.type}
        collapsible={values.collapsible}
        disabled={values.disabled}
        defaultValue="item-1"
      >
        <AccordionItem value="item-1" title="What are design tokens?">
          <p class="text-text-secondary text-sm">
            Design tokens are named values — colors, spacing, radii — that form the single source of
            truth for your design system.
          </p>
        </AccordionItem>
        <AccordionItem value="item-2" title="How does theming work?">
          <p class="text-text-secondary text-sm">
            Semantic tokens map to foundation tokens. Swap the foundation layer and the entire UI
            updates automatically.
          </p>
        </AccordionItem>
        <AccordionItem value="item-3" title="Is dark mode automatic?">
          <p class="text-text-secondary text-sm">
            Yes — semantic tokens handle dark mode via the CSS light-dark() function. No manual
            dark: classes needed.
          </p>
        </AccordionItem>
      </Accordion>
    </div>
  {/snippet}
</PlaygroundConfigurator>
