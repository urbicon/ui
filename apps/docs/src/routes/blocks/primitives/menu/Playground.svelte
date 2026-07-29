<!--
  Menu-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Menu, type MenuObjectOption } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let lastAction = $state('—');

  const playgroundItems: MenuObjectOption[] = [
    { label: 'Dashboard', onSelect: () => (lastAction = 'Dashboard') },
    { label: 'User Settings', onSelect: () => (lastAction = 'User Settings') },
    { label: 'Notifications', onSelect: () => (lastAction = 'Notifications') },
    { label: 'Billing', onSelect: () => (lastAction = 'Billing') },
    { label: 'Help', onSelect: () => (lastAction = 'Help') }
  ];

  const controls = deriveControls(componentData, {
    pick: [
      'tier',
      'itemSize',
      'placement',
      'chevronAnimation',
      'placeholder',
      'syncWidth',
      'disabled',
      'loading',
      'variant',
      'intent',
      'size'
    ],
    overrides: {
      variant: {
        type: 'dropdown',
        label: 'Trigger Variant',
        items: [
          { label: 'outlined', value: 'outlined' },
          { label: 'filled', value: 'filled' },
          { label: 'ghost', value: 'ghost' },
          { label: 'text', value: 'text' }
        ],
        defaultValue: 'outlined'
      },
      intent: {
        type: 'dropdown',
        label: 'Trigger Intent',
        items: [
          { label: 'neutral', value: 'neutral' },
          { label: 'primary', value: 'primary' },
          { label: 'secondary', value: 'secondary' },
          { label: 'success', value: 'success' },
          { label: 'warning', value: 'warning' },
          { label: 'danger', value: 'danger' }
        ],
        defaultValue: 'neutral'
      },
      size: {
        type: 'dropdown',
        label: 'Trigger Size',
        items: [
          { label: '2xs', value: '2xs' },
          { label: 'xs', value: 'xs' },
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' },
          { label: 'xl', value: 'xl' }
        ],
        defaultValue: 'md'
      },
      itemSize: {
        label: 'Item Size',
        items: [
          { label: '(inherit)', value: '' },
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' }
        ],
        defaultValue: ''
      },
      chevronAnimation: { label: 'Chevron Animation' },
      placeholder: { defaultValue: 'Actions' },
      syncWidth: { type: 'checkbox', label: 'Sync Width', defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Menu"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Menu } from '@urbicon-ui/blocks';"],
    // `{ raw }` statt der echten Objekte: Die `onSelect`-Handler der Demo
    // schreiben in lokalen Zustand dieser Seite; wörtlich gedruckt liefe der
    // Schnipsel ins Leere. Hier steht deshalb die Form, die ein Konsument
    // schreibt — die Labels sind dieselben.
    consts: {
      items: {
        raw: `[\n${playgroundItems
          .map((i) => `  { label: '${i.label}', onSelect: () => console.log('${i.label}') }`)
          .join(',\n')}\n]`
      }
    },
    bind: ['items']
  }}
>
  {#snippet children(values)}
    {@const menuProps = {
      ...values,
      itemSize: values.itemSize || undefined,
      chevronAnimation: values.chevronAnimation || undefined
    }}
    <div class="flex items-center gap-4">
      <Menu {...menuProps} items={playgroundItems} />
      <span class="text-text-tertiary text-sm">
        Last action: <code>{lastAction}</code>
      </span>
    </div>
  {/snippet}
</PlaygroundConfigurator>
