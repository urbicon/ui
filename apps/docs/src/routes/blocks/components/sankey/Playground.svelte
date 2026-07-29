<!--
  Sankey-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.
-->
<script lang="ts">
  import { SET_FAMILIES, SET_FAMILY_MATURITY, SET_PACKAGE_FAMILY } from '$lib/landing/set-facts';
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Sankey, type SankeyLink, type SankeyNode } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // The demo data is this library: which package a component ships in, which
  // family it belongs to, and how far along it is — real numbers, checked
  // against the generated catalogues by `set-facts.test.ts`. A Sankey earns its
  // keep on a flow that means something, and "Source A → Pot → Sink X" meant
  // nothing.
  //
  // Three stages, not two. The middle one is where the set says something about
  // itself that neither end shows alone: every component tagged `ai` is still
  // experimental, while `form` — the widest family — has almost entirely
  // settled.
  const playgroundNodes: SankeyNode[] = [
    { id: 'blocks', label: 'blocks', intent: 'primary' },
    { id: 'auth', label: 'auth', intent: 'secondary' },
    { id: 'table', label: 'table', intent: 'neutral' },
    // Ohne eigenen Intent: Die Familien sind die Schicht, auf die der
    // `intent`-Regler wirkt — sonst hätte er auf dieser Bühne nichts zu färben.
    ...SET_FAMILIES.map((f) => ({ id: f.family, label: f.family })),
    { id: 'stable', label: 'stable', intent: 'success' },
    { id: 'beta', label: 'beta', intent: 'warning' },
    { id: 'experimental', label: 'experimental', intent: 'neutral' }
  ];
  const playgroundLinks: SankeyLink[] = [...SET_PACKAGE_FAMILY, ...SET_FAMILY_MATURITY].map(
    (edge) => ({ source: edge.source, target: edge.target, value: edge.count })
  );
  const controls = deriveControls(componentData, {
    // `nodeAlign` ist bewusst nicht dabei. Der Regler stand hier über einem
    // Graphen, auf dem alle vier Werte rechnerisch dasselbe Layout ergeben —
    // die Schicht eines Knotens ist sein *längster* Pfad, also sitzt jede Senke
    // ohnehin am rechten Rand. Die dritte Stufe ändert daran nichts (gemessen,
    // siehe `internal/sankey/layout.test.ts` → „nodeAlign"); die Prop bleibt für
    // ungleichmäßige Graphen erhalten, ihre JSDoc sagt jetzt, wann sie greift.
    pick: ['intent', 'height', 'nodeWidth', 'nodePadding'],
    overrides: {
      height: {
        type: 'number',
        label: 'Height (px)',
        // Neun Familien in der Mittelschicht brauchen mehr Platz als die drei
        // Reifegrade davor — bei 320 px standen die Bänder aufeinander.
        defaultValue: 440,
        min: 120,
        max: 800,
        step: 20
      },
      nodeWidth: { defaultValue: 24, min: 4, max: 80, step: 2 },
      nodePadding: { defaultValue: 12, min: 0, max: 40, step: 2 }
    }
  });
</script>

<PlaygroundConfigurator
  {propDocs}
  {variantKeys}
  componentName="Sankey"
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Sankey } from '@urbicon-ui/blocks';"],
    consts: { nodes: playgroundNodes, links: playgroundLinks },
    bind: ['nodes', 'links']
  }}
>
  {#snippet children(values)}
    <div class="w-full">
      <Sankey {...values} nodes={playgroundNodes} links={playgroundLinks} />
    </div>
  {/snippet}
</PlaygroundConfigurator>
