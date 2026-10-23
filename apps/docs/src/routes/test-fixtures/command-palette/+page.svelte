<script lang="ts">
  import type { CommandPaletteItem } from '@urbicon-ui/blocks';
  // E2E fixture for e2e/command-palette.spec.ts: an info row above and below
  // more commands than the palette's list shows at once, so the spec can watch
  // which rows Home, End and the wraps bring into view, and a second palette
  // whose info rows above the first command are taller than the list. The page
  // keeps the docs chrome, whose search is one more CommandPalette.
  import { Button, CommandPalette } from '@urbicon-ui/blocks';

  const commands = Array.from({ length: 30 }, (_, i) => ({
    id: `c${i}`,
    label: `Command ${i + 1}`
  }));

  const items: CommandPaletteItem[] = [
    { id: 'hint-top', label: 'Type #project or a date word', kind: 'info' },
    ...commands,
    { id: 'hint-bottom', label: 'Two letters start a search', kind: 'info' }
  ];

  const tallPreamble: CommandPaletteItem[] = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `hint-${i}`,
      label: `Hint ${i + 1}`,
      kind: 'info' as const
    })),
    ...commands
  ];

  let open = $state(false);
  let tallOpen = $state(false);
</script>

<svelte:head>
  <title>Command Palette Test Fixture</title>
</svelte:head>

<div class="bg-surface-base flex min-h-screen gap-4 p-8" data-testid="command-palette-fixture">
  <Button data-testid="palette-trigger" onclick={() => (open = true)}>Open palette</Button>
  <Button data-testid="tall-palette-trigger" onclick={() => (tallOpen = true)}>
    Open palette with a tall preamble
  </Button>
  <CommandPalette bind:open {items} shortcut={false} aria-label="Fixture commands" />
  <CommandPalette
    bind:open={tallOpen}
    items={tallPreamble}
    shortcut={false}
    aria-label="Fixture commands below a tall preamble"
  />
</div>
