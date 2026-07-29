<!--
  Scroller-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Regler stehen hier von Hand: Der Scroller nimmt seine Achsen aus
  Union-Typen, die `deriveControls` nicht auflösen kann (`ScrollerAlign` &
  Geschwister landen als Alias in der API), und `itemBasis` ist ein freier
  CSS-Wert, für den drei sinnvolle Stufen mehr zeigen als ein Textfeld.
  Der Snippet kommt aus `source` + `codeSetup`, nicht aus einem handgeschriebenen
  `codeGenerator`: die Schleife wird aus dieser Datei selbst gehoben und die
  Karten druckt `consts` mit ab, sodass der abgedruckte Code lauffähig ist und
  keine zweite, driftende Kopie entsteht.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Scroller } from '@urbicon-ui/blocks';
  import { extractPlaygroundDocs, PlaygroundConfigurator } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const label = 'Main features';

  const cards = [
    { id: 'sync', title: 'Sync', body: 'Keeps every device on the same page.' },
    { id: 'audit', title: 'Audit', body: 'Every change, with who and when.' },
    { id: 'reports', title: 'Reports', body: 'Numbers your board actually reads.' },
    { id: 'access', title: 'Access', body: 'Roles, invites and passkeys.' },
    { id: 'api', title: 'API', body: 'Everything the UI does, scriptable.' }
  ];
</script>

<PlaygroundConfigurator
  componentName="Scroller"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  controls={[
    {
      type: 'dropdown',
      key: 'align',
      label: 'Align',
      items: [
        { label: 'start', value: 'start' },
        { label: 'center', value: 'center' }
      ],
      // Default „center": Die Bühne ist der Zustand, den man dem Scroller
      // nicht ansieht, wenn man ihn nur als überlaufende Reihe öffnet — und
      // sie macht den Emphasis-Regler von der ersten Sekunde an sichtbar.
      defaultValue: 'center'
    },
    {
      type: 'dropdown',
      key: 'itemBasis',
      label: 'Item width',
      items: [
        { label: '12rem', value: '12rem' },
        { label: '16rem', value: '16rem' },
        { label: '22rem', value: '22rem' }
      ],
      defaultValue: '16rem'
    },
    {
      type: 'dropdown',
      key: 'snap',
      label: 'Snap',
      // `auto` passes no prop at all, so the contextual default applies
      // (start -> proximity, center -> mandatory). Without this step the
      // playground always overrides it and the default stays invisible.
      items: [
        { label: 'auto', value: 'auto' },
        { label: 'proximity', value: 'proximity' },
        { label: 'mandatory', value: 'mandatory' },
        { label: 'none', value: 'none' }
      ],
      defaultValue: 'auto'
    },
    {
      type: 'dropdown',
      key: 'gap',
      label: 'Gap',
      items: [
        { label: 'xs', value: 'xs' },
        { label: 'sm', value: 'sm' },
        { label: 'md', value: 'md' },
        { label: 'lg', value: 'lg' },
        { label: 'xl', value: 'xl' }
      ],
      defaultValue: 'md'
    },
    {
      type: 'dropdown',
      key: 'controls',
      label: 'Controls',
      items: [
        { label: 'auto', value: 'auto' },
        { label: 'always', value: 'always' },
        { label: 'none', value: 'none' }
      ],
      defaultValue: 'auto'
    },
    {
      type: 'dropdown',
      key: 'indicator',
      label: 'Indicator',
      items: [
        { label: 'none', value: 'none' },
        { label: 'dots', value: 'dots' }
      ],
      defaultValue: 'none'
    },
    {
      type: 'dropdown',
      key: 'emphasis',
      label: 'Emphasis',
      items: [
        { label: 'none', value: 'none' },
        { label: 'subtle', value: 'subtle' },
        { label: 'strong', value: 'strong' }
      ],
      defaultValue: 'subtle',
      // Der Lift markiert die Mitte der Bühne — ohne align="center" ist er ein
      // No-op (die Komponente warnt nur in DEV). Ein Regler, der sichtbar
      // nichts tut, liest sich als kaputt, also erscheint er erst, wenn er
      // etwas tun kann.
      condition: { dependsOn: 'align', equals: 'center' }
    }
  ]}
  values={{
    align: 'center',
    itemBasis: '16rem',
    snap: 'auto',
    gap: 'md',
    controls: 'auto',
    indicator: 'none',
    emphasis: 'subtle'
  }}
  codeSetup={{
    imports: ["import { Scroller } from '@urbicon-ui/blocks';"],
    consts: { label, cards },
    bind: ['label']
  }}
>
  {#snippet children(values)}
    <Scroller
      {label}
      align={values.align as 'start' | 'center'}
      snap={values.snap === 'auto'
        ? undefined
        : (values.snap as 'proximity' | 'mandatory' | 'none')}
      gap={values.gap as 'xs' | 'sm' | 'md' | 'lg' | 'xl'}
      itemBasis={values.itemBasis as string}
      controls={values.controls as 'auto' | 'always' | 'none'}
      indicator={values.indicator as 'none' | 'dots'}
      emphasis={values.align === 'center'
        ? (values.emphasis as 'none' | 'subtle' | 'strong')
        : 'none'}
    >
      {#each cards as card (card.id)}
        <article class="border-border-subtle bg-surface-elevated rounded-contain border p-4">
          <h3 class="text-text-primary text-sm font-semibold">{card.title}</h3>
          <p class="text-text-secondary mt-1 text-sm">{card.body}</p>
        </article>
      {/each}
    </Scroller>
  {/snippet}
</PlaygroundConfigurator>
