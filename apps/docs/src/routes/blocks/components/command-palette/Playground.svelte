<!--
  CommandPalette-Playground — aus dem statischen Beispiel der Doku-Seite
  entstanden, damit ihn zwei Seiten zeigen können: die Doku-Seite und der
  Landing-Hero. Siehe `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import {
    Button,
    CommandPalette,
    FilePlusIcon,
    Kbd,
    LogOutIcon,
    SaveIcon,
    SearchIcon,
    SettingsIcon,
    type CommandPaletteItem
  } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let playgroundOpen = $state(false);

  // The icon identifier lives here as a string and is resolved to the component
  // below. A component has no printable form — `serializeValue` throws on
  // functions by design — so the snippet's `items` has to be text. Deriving
  // both from one list keeps label/shortcut/category from drifting apart;
  // only the mapping name↦component is written twice, and TypeScript gates it.
  const ICONS = { FilePlusIcon, SaveIcon, SearchIcon, SettingsIcon, LogOutIcon };

  type ItemSpec = Omit<CommandPaletteItem, 'icon'> & { icon: keyof typeof ICONS };

  const itemSpecs: ItemSpec[] = [
    { label: 'New File', shortcut: 'Ctrl+N', category: 'File', icon: 'FilePlusIcon' },
    { label: 'Save', shortcut: 'Ctrl+S', category: 'File', icon: 'SaveIcon' },
    { label: 'Search', shortcut: 'Ctrl+F', category: 'Edit', icon: 'SearchIcon' },
    { label: 'Settings', category: 'Navigation', icon: 'SettingsIcon' },
    { label: 'Sign Out', category: 'Account', icon: 'LogOutIcon' }
  ];

  const playgroundItems: CommandPaletteItem[] = itemSpecs.map((spec) => ({
    ...spec,
    icon: ICONS[spec.icon]
  }));

  const itemsSource = `[\n${itemSpecs
    .map(({ label, shortcut, category, icon }) =>
      [
        `  { label: '${label}'`,
        shortcut ? `shortcut: '${shortcut}'` : undefined,
        `category: '${category}'`,
        `icon: ${icon} }`
      ]
        .filter(Boolean)
        .join(', ')
    )
    .join(',\n')}\n]`;

  const controls = deriveControls(componentData, {
    pick: ['size', 'placeholder', 'emptyText', 'showFooter'],
    overrides: {
      placeholder: { defaultValue: 'Type a command or search…' },
      emptyText: { label: 'Empty Text' },
      showFooter: { label: 'Show Footer' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="CommandPalette"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: [
      `import { CommandPalette, ${Object.keys(ICONS).join(', ')} } from '@urbicon-ui/blocks';`
    ],
    consts: { items: { raw: itemsSource } },
    state: { open: playgroundOpen },
    bind: ['open', 'items'],
    twoWay: ['open']
  }}
>
  {#snippet children(values)}
    <div class="flex flex-col items-center gap-3">
      <Button variant="outlined" intent="neutral" size="lg" onclick={() => (playgroundOpen = true)}>
        Open Command Palette
      </Button>
      <p class="text-text-tertiary text-sm">
        The global hotkey (<Kbd keys={['Ctrl', 'K']} />
        by default) is off here — this page already owns that key.
      </p>
    </div>
    <!--
      `shortcut={false}`: Die Komponente registriert ihren Hotkey global über
      `<svelte:window onkeydown>`. Die Doku-App hat ihre eigene Suche auf ⌘K, im
      Landing-Hero liegt der Playground auf einer fremden Seite — beides Mal
      gingen zwei Paletten auf. Der Öffnen-Knopf steht ohnehin auf der Bühne;
      der Satz darüber erklärt die Prop, statt sie zu verschweigen.
    -->
    <CommandPalette
      bind:open={playgroundOpen}
      items={playgroundItems}
      shortcut={false}
      size={values.size}
      placeholder={String(values.placeholder ?? '')}
      emptyText={String(values.emptyText ?? '')}
      showFooter={values.showFooter}
    />
  {/snippet}
</PlaygroundConfigurator>
