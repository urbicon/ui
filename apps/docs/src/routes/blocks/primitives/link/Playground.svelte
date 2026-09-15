<!--
  Link-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  `href` ist Pflicht-Prop und kein Regler: ein Textfeld für eine Adresse zeigt
  am Ergebnis nichts. Es steht als Konstante im Schnipsel, damit der kopierte
  Code compiliert — und die Bühne bekommt `#` plus `demoNoop`, die Hausform aus
  `breadcrumb/Playground.svelte`: sonst trüge die Demo den Leser fort.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Link } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // Was der Schnipsel zeigt, und was die Bühne rendert: eine echte Adresse im
  // Code, ein totes `#` in der Demo.
  const HREF = '/projects/42';
  const demoNoop = (event: MouseEvent) => event.preventDefault();

  const controls = deriveControls(componentData, {
    pick: ['variant', 'active', 'disabled', 'children'],
    overrides: {
      // Link trägt seinen Text als `children`; als Override statt `extra`, damit
      // der Codegenerator `<Link …>Project settings</Link>` schreibt und keine
      // erfundene `label`-Prop.
      children: { type: 'text', label: 'Label', defaultValue: 'Project settings' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Link"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Link } from '@urbicon-ui/blocks';"],
    consts: { href: HREF },
    bind: ['href']
  }}
>
  {#snippet children(values)}
    {@const { children: label, ...rest } = values}
    <Link href="#" onclick={demoNoop} {...rest}>{label}</Link>
  {/snippet}
</PlaygroundConfigurator>
