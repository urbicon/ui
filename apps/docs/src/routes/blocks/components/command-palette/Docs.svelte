<!-- urbicon-ignore raw-tailwind-color — the 4 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import type { CommandPaletteItem } from '@urbicon-ui/blocks';
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
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';

  let basicOpen = $state(false);
  let iconsOpen = $state(false);
  let customOpen = $state(false);
  let minimalOpen = $state(false);
  let brandedOpen = $state(false);
  let compactOpen = $state(false);
  let customRowOpen = $state(false);
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
    { label: 'Nothing to undo in this document yet', category: 'Edit', kind: 'info' },
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
      title="Disabled and Informational Rows"
      description="disabled: true is a command that cannot run right now: greyed out and skipped by the arrow keys. kind: 'info' is a row that is no command at all, here the line explaining why Undo is off: the arrow keys skip it as well, but it keeps the list's own ink. A screen reader reaches both in reading mode only, never while the user types; an explanation that has to be heard then belongs in the excerpt of a command the arrow keys reach, which is part of that command's accessible name."
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
        type="button"
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
      title="Custom Rows"
      description="The customItem snippet draws each row's contents — content only, nothing focusable — while the option container (role, id, highlight, hover and click) stays with the palette. Here the highlighted argument puts an Enter hint on the active row."
      isolate
    >
      <Button variant="outlined" intent="neutral" onclick={() => (customRowOpen = true)}>
        Custom Rows
      </Button>
      <CommandPalette
        bind:open={customRowOpen}
        items={simpleCommands}
        placeholder="Search..."
        shortcut={false}
      >
        {#snippet customItem(item, highlighted)}
          <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span class="truncate">{item.label}</span>
            {#if highlighted}
              <Badge purpose="tag" variant="soft" size="xs">Enter</Badge>
            {/if}
          </span>
        {/snippet}
      </CommandPalette>
    </CodeExample>

    <CodeExample
      title="Footer Hints"
      description="The footer snippet receives the palette's own key hints, translated, and draws the ones it wants; here the arrow hint goes. A hint for a key of your own takes the same shape: an id, its keys and a label. Setting showFooter to false hides the footer altogether."
      isolate
    >
      <Button variant="outlined" intent="neutral" onclick={() => (compactOpen = true)}>
        Fewer Footer Hints
      </Button>
      <CommandPalette
        bind:open={compactOpen}
        items={simpleCommands}
        placeholder="Quick search..."
        shortcut={false}
      >
        {#snippet footer({ hints })}
          {#each hints.filter((hint) => hint.id !== 'navigate') as hint (hint.id)}
            <span class="flex items-center gap-1">
              <Kbd keys={hint.keys} size="sm" />
              {hint.label}
            </span>
          {/each}
        {/snippet}
      </CommandPalette>
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
        <code class="text-text-primary">role="option"</code> on each command. An info row is plain
        text in the list, not an option, so it is never announced as an unavailable command. With no
        command to offer — no match, or only info rows — the list is no listbox and the input
        reports
        <code class="text-text-primary">aria-expanded="false"</code>.
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
        to navigate — the list wraps at both ends —
        <Kbd keys="Home" />
        /
        <Kbd keys="End" />
        for the first and last item,
        <Kbd keys="Enter" />
        to select,
        <Kbd keys="Escape" />
        to close. The highlighted item scrolls into view automatically.
      </p>
    </Note>
    <Note title="Focus Management">
      <p>
        Inherits focus trap from Dialog. The search input receives focus automatically when the
        palette opens. Disabled items and info rows are skipped during keyboard navigation; disabled
        items have <code class="text-text-primary">aria-disabled="true"</code>.
        <code class="text-text-primary">onOpenChange(false)</code>
        fires as the palette starts to close, with focus still inside it;
        <code class="text-text-primary">onClosed</code> fires once it has closed and focus is back where
        it was, which is the moment to move focus on or open what the selection asked for. When stacked
        surfaces close together, focus can end on the page body instead.
      </p>
    </Note>
  </NoteList>
</Section>
