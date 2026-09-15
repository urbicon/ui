<!--
  Link-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  `href` ist Pflicht-Prop und kein Regler: die Bühne navigiert nicht, und ein
  Textfeld für eine Adresse zeigt am Ergebnis nichts. Es steht als Konstante im
  Schnipsel, damit der kopierte Code compiliert.
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

  const HREF = '/projects/42';

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
    <Link href={HREF} {...rest}>{label}</Link>
  {/snippet}
</PlaygroundConfigurator>
