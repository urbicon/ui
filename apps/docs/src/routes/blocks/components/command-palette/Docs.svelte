<!-- urbicon-ignore raw-tailwind-color — the 4 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Badge,
    Button,
    CommandPalette,
    FilePlusIcon,
    FolderOpenIcon,
    Kbd,
    LogOutIcon,
    PanelLeftIcon,
    RepeatIcon,
    SaveIcon,
    SearchIcon,
    SettingsIcon,
    TerminalIcon
  } from '@urbicon-ui/blocks';
  import type { CommandPaletteItem } from '@urbicon-ui/blocks';

  let basicOpen = $state(false);
  let iconsOpen = $state(false);
  let customOpen = $state(false);
  let minimalOpen = $state(false);
  let brandedOpen = $state(false);
  let compactOpen = $state(false);
  let selectedAction = $state('');

  const fileCommands: CommandPaletteItem[] = [
    { label: 'New File', shortcut: 'Ctrl+N', category: 'File', icon: FilePlusIcon },
    { label: 'Open File', shortcut: 'Ctrl+O', category: 'File', icon: FolderOpenIcon },
    { label: 'Save', shortcut: 'Ctrl+S', category: 'File', icon: SaveIcon },
    { label: 'Search', shortcut: 'Ctrl+F', category: 'Edit', icon: SearchIcon },
    { label: 'Find and Replace', shortcut: 'Ctrl+H', category: 'Edit', icon: RepeatIcon },
    { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', category: 'View', icon: PanelLeftIcon },
    { label: 'Toggle Terminal', category: 'View', icon: TerminalIcon },
    { label: 'Settings', category: 'Navigation', icon: SettingsIcon },
    { label: 'Sign Out', category: 'Account', icon: LogOutIcon }
  ];

  const simpleCommands: CommandPaletteItem[] = [
    { label: 'Home', category: 'Navigation' },
    { label: 'Dashboard', category: 'Navigation' },
    { label: 'Profile', category: 'Navigation' },
    { label: 'Create Post', category: 'Actions' },
    { label: 'Upload Image', category: 'Actions' },
    { label: 'Export Data', category: 'Actions' },
    { label: 'Dark Mode', category: 'Preferences' },
    { label: 'Language', category: 'Preferences' }
  ];

  const disabledCommands: CommandPaletteItem[] = [
    { label: 'Copy', category: 'Edit', shortcut: 'Ctrl+C' },
    { label: 'Paste', category: 'Edit', shortcut: 'Ctrl+V' },
    { label: 'Undo', category: 'Edit', shortcut: 'Ctrl+Z', disabled: true },
    { label: 'Redo', category: 'Edit', shortcut: 'Ctrl+Y', disabled: true }
  ];
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Basic"
      description="Simple command palette with categories and keyboard shortcuts."
      isolate
    >
      <Button variant="outlined" intent="neutral" onclick={() => (basicOpen = true)}>
        Open Command Palette
      </Button>
      <CommandPalette
        bind:open={basicOpen}
        items={fileCommands}
        onSelect={(item) => (selectedAction = item.label)}
        placeholder="Type a command or search..."
        shortcut={false}
      />
      {#if selectedAction}
        <p class="text-text-secondary mt-3 text-sm">
          Last action: <strong class="text-text-primary">{selectedAction}</strong>
        </p>
      {/if}
    </CodeExample>

    <CodeExample
      title="Minimal (no icons, no shortcuts)"
      description="A list with no icons and no shortcut hints."
      isolate
    >
      <Button variant="outlined" intent="neutral" onclick={() => (minimalOpen = true)}>
        Quick Navigation
      </Button>
      <CommandPalette
        bind:open={minimalOpen}
        items={simpleCommands}
        placeholder="Where do you want to go?"
        shortcut={false}
      />
    </CodeExample>

    <CodeExample
      title="With Disabled Items"
      description="Set disabled: true on an item to show it greyed out and skip it in keyboard navigation."
      isolate
    >
      <Button variant="outlined" intent="neutral" onclick={() => (iconsOpen = true)}>
        Edit Commands
      </Button>
      <CommandPalette
        bind:open={iconsOpen}
        items={disabledCommands}
        placeholder="Search edit commands..."
        emptyText="No matching commands."
        shortcut={false}
      />
    </CodeExample>

    <CodeExample
      title="Trigger with Shortcut Badge"
      description="A search-bar styled trigger with a Ctrl+K badge, instead of a plain button."
      isolate
    >
      <button
        class="border-border-default bg-surface-base text-text-tertiary hover:border-border-emphasis hover:text-text-secondary rounded-modify flex items-center gap-2 border px-4 py-2.5 text-sm shadow-[var(--blocks-shadow-sm)] transition-all"
        onclick={() => (customOpen = true)}
      >
        <SearchIcon class="h-4 w-4" />
        Search commands...
        <Badge variant="outlined" intent="neutral" size="sm" class="ml-8">
          <kbd class="text-3xs font-mono">Ctrl+K</kbd>
        </Badge>
      </button>
      <CommandPalette
        bind:open={customOpen}
        items={fileCommands}
        placeholder="Type a command..."
        shortcut={false}
      />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Styled via slotClasses"
      description="Override specific slots for a branded appearance."
      isolate
    >
      <Button variant="outlined" intent="neutral" onclick={() => (brandedOpen = true)}>
        Branded Palette
      </Button>
      <CommandPalette
        bind:open={brandedOpen}
        items={simpleCommands}
        placeholder="Search..."
        shortcut={false}
        slotClasses={{
          wrapper: 'border-violet-500/30',
          itemHighlighted: 'bg-violet-100 text-violet-700',
          groupLabel: 'text-violet-500'
        }}
      />
    </CodeExample>

    <CodeExample
      title="No Footer"
      description="Hide the keyboard hints footer for a more compact look."
      isolate
    >
      <Button variant="outlined" intent="neutral" onclick={() => (compactOpen = true)}>
        Compact Palette
      </Button>
      <CommandPalette
        bind:open={compactOpen}
        items={disabledCommands}
        placeholder="Quick search..."
        showFooter={false}
        shortcut={false}
      />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA Combobox Pattern">
      <p>
        The search input uses <code class="text-text-primary">role="combobox"</code> with
        <code class="text-text-primary">aria-expanded</code>,
        <code class="text-text-primary">aria-controls</code>, and
        <code class="text-text-primary">aria-activedescendant</code> linking to the highlighted
        option. Results use
        <code class="text-text-primary">role="listbox"</code> with
        <code class="text-text-primary">role="option"</code> on each item.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys={['Cmd', 'K']} />
        /
        <Kbd keys={['Ctrl', 'K']} />
        to open (configurable).
        <Kbd keys="↑" />
        <Kbd keys="↓" />
        to navigate,
        <Kbd keys="Enter" />
        to select,
        <Kbd keys="Escape" />
        to close. The highlighted item scrolls into view automatically.
      </p>
    </Note>
    <Note title="Focus Management">
      <p>
        Inherits focus trap from Dialog. The search input receives focus automatically when the
        palette opens. Disabled items are skipped during keyboard navigation and have <code
          class="text-text-primary">aria-disabled="true"</code
        >.
      </p>
    </Note>
  </NoteList>
</Section>
