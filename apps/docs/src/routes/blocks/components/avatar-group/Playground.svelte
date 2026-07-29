<!--
  AvatarGroup-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { AvatarGroup } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // `items` ist `AvatarProps[]` — jeder Eintrag ist ein *vollständiger* Avatar.
  // Das stand vorher nur in der Typzeile: Alle sechs trugen `name` (plus
  // zweimal `randomColor`), also war im Bild nicht zu sehen, dass hier mehr als
  // ein Name hineinpasst. Jetzt zeigen drei Einträge je eine andere Avatar-Prop.
  //
  // Kein `src`: Die Doku-Site bringt keine Portraitbilder mit, und eine externe
  // URL wäre auf der Landing eine Fremdressource — `initials` und `status`
  // beantworten dieselbe Frage ohne beides.
  const team = [
    { name: 'Ada Lovelace', status: 'online' as const },
    { name: 'Alan Turing', initials: 'AT' },
    { name: 'Grace Hopper', randomColor: true, status: 'busy' as const },
    { name: 'Katherine Johnson', randomColor: true },
    { name: 'Edsger Dijkstra' },
    { name: 'Barbara Liskov' }
  ];

  const controls = deriveControls(componentData, {
    pick: ['max', 'spacing', 'size'],
    overrides: {
      size: {
        type: 'dropdown',
        label: 'Size',
        items: [
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' },
          { label: 'xl', value: 'xl' }
        ],
        defaultValue: 'md'
      },
      max: {
        type: 'dropdown',
        items: [
          { label: '3', value: 3 },
          { label: '4', value: 4 },
          { label: '5', value: 5 },
          { label: 'all', value: 'all' }
        ],
        defaultValue: 4
      }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="AvatarGroup"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { AvatarGroup } from '@urbicon-ui/blocks';"],
    consts: { items: team },
    bind: ['items']
  }}
>
  {#snippet children(values)}
    <AvatarGroup
      items={team}
      size={values.size}
      max={typeof values.max === 'number' ? values.max : undefined}
      spacing={values.spacing}
    />
  {/snippet}
</PlaygroundConfigurator>
