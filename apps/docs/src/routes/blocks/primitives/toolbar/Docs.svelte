<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Badge, Button, Separator, Toolbar } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['variant', 'orientation', 'gap', 'padding', 'aria-label'],
        defaults: { variant: 'quiet', orientation: 'horizontal', gap: 'sm', padding: 'sm' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Toolbar Component', showToc: true }
  };

  let activeTool = $state('select');
  let bold = $state(false);
  let italic = $state(false);
  let underline = $state(false);
  let alignment = $state<'left' | 'center' | 'right'>('left');
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Rich Text Editor"
      description="Realistic text formatting toolbar with grouped controls and active states."
      isolate
      previewClass="flex flex-col items-start gap-4 w-full"
    >
      <Toolbar aria-label="Text formatting" gap="xs" padding="sm">
        <Button
          variant={bold ? 'filled' : 'ghost'}
          intent={bold ? 'primary' : 'neutral'}
          size="sm"
          class="min-w-8 font-bold"
          onclick={() => (bold = !bold)}>B</Button
        >
        <Button
          variant={italic ? 'filled' : 'ghost'}
          intent={italic ? 'primary' : 'neutral'}
          size="sm"
          class="min-w-8 italic"
          onclick={() => (italic = !italic)}>I</Button
        >
        <Button
          variant={underline ? 'filled' : 'ghost'}
          intent={underline ? 'primary' : 'neutral'}
          size="sm"
          class="min-w-8 underline"
          onclick={() => (underline = !underline)}>U</Button
        >
        <Button variant="ghost" size="sm" class="min-w-8 line-through">S</Button>

        <Separator orientation="vertical" size="sm" />

        <Button
          variant={alignment === 'left' ? 'filled' : 'ghost'}
          intent={alignment === 'left' ? 'primary' : 'neutral'}
          size="sm"
          class="min-w-8"
          onclick={() => (alignment = 'left')}>⇤</Button
        >
        <Button
          variant={alignment === 'center' ? 'filled' : 'ghost'}
          intent={alignment === 'center' ? 'primary' : 'neutral'}
          size="sm"
          class="min-w-8"
          onclick={() => (alignment = 'center')}>≡</Button
        >
        <Button
          variant={alignment === 'right' ? 'filled' : 'ghost'}
          intent={alignment === 'right' ? 'primary' : 'neutral'}
          size="sm"
          class="min-w-8"
          onclick={() => (alignment = 'right')}>⇥</Button
        >

        <Separator orientation="vertical" size="sm" />

        <Button variant="ghost" size="sm" class="min-w-8">🔗</Button>
        <Button variant="ghost" size="sm" class="min-w-8">📷</Button>
      </Toolbar>

      <div
        class="bg-surface-base border-border-subtle rounded-contain w-full border p-4 text-sm transition-all"
        style="text-align: {alignment};"
      >
        <p
          class={[
            'text-text-secondary',
            bold && 'font-bold',
            italic && 'italic',
            underline && 'underline'
          ]}
        >
          Click the buttons above to toggle formatting. The text alignment and style update live.
        </p>
      </div>
    </CodeExample>

    <CodeExample
      title="Vertical Tools Palette"
      description="Sidebar-style toolbar with selectable tools and active indicator."
      isolate
      previewClass="flex gap-6 items-start"
    >
      <Toolbar aria-label="Drawing tools" orientation="vertical" variant="elevated" gap="xs">
        {#each [{ id: 'select', icon: '⇱', label: 'Select' }, { id: 'pen', icon: '✎', label: 'Pen' }, { id: 'brush', icon: '🖌', label: 'Brush' }, { id: 'eraser', icon: '⌫', label: 'Eraser' }, { id: 'shape', icon: '◻', label: 'Shape' }, { id: 'text', icon: 'T', label: 'Text' }] as tool (tool.id)}
          <Button
            variant={activeTool === tool.id ? 'filled' : 'ghost'}
            intent={activeTool === tool.id ? 'primary' : 'neutral'}
            size="sm"
            class="min-w-9 justify-center"
            onclick={() => (activeTool = tool.id)}
            aria-label={tool.label}>{tool.icon}</Button
          >
        {/each}
      </Toolbar>

      <div class="bg-surface-base border-border-subtle flex-1 rounded-xl border p-6">
        <p class="text-text-tertiary text-center text-sm">
          Active tool: <Badge size="sm" intent="primary">{activeTool}</Badge>
        </p>
      </div>
    </CodeExample>

    <CodeExample
      title="Media Controls"
      description="Centered playback toolbar with action groups."
      isolate
      previewClass="flex justify-center w-full"
    >
      <Toolbar aria-label="Media player" variant="elevated" gap="sm" padding="md">
        <Button variant="ghost" size="sm">⏮</Button>
        <Button variant="filled" intent="primary" size="sm" class="min-w-9 justify-center">▶</Button
        >
        <Button variant="ghost" size="sm">⏭</Button>
        <Separator orientation="vertical" size="sm" />
        <Button variant="ghost" size="sm">🔀</Button>
        <Button variant="ghost" size="sm">🔁</Button>
        <Separator orientation="vertical" size="sm" />
        <span class="text-text-tertiary px-2 text-xs tabular-nums">2:34 / 4:12</span>
      </Toolbar>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Developer Toolbar"
      description="Dark gradient toolbar with accent-colored actions via slotClasses."
      isolate
      previewClass="flex justify-center w-full"
    >
      <Toolbar
        aria-label="Developer actions"
        variant="ghost"
        slotClasses={{
          base: 'bg-linear-to-r from-neutral-900 to-neutral-800 border border-neutral-700/50 shadow-xl shadow-black/20 rounded-xl px-3 py-2'
        }}
        gap="sm"
      >
        <Button
          unstyled
          class="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
          >▶ Run</Button
        >
        <Button
          unstyled
          class="rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/25"
          >⏸ Debug</Button
        >
        <Separator orientation="vertical" size="sm" class="!border-neutral-600" />
        <Button
          unstyled
          class="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-700/50 hover:text-neutral-200"
          >⚙ Settings</Button
        >
        <Button
          unstyled
          class="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-700/50 hover:text-neutral-200"
          >📦 Build</Button
        >
      </Toolbar>
    </CodeExample>

    <CodeExample
      title="Floating Glass Toolbar"
      description="Glassmorphism toolbar floating over a vibrant background — built with unstyled + custom classes."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-violet-600 via-fuchsia-500 to-rose-500 px-8 py-12"
    >
      <Toolbar
        aria-label="Quick actions"
        unstyled
        class="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 shadow-2xl backdrop-blur-xl"
      >
        <Button
          unstyled
          class="rounded-xl px-3 py-1.5 text-sm font-medium text-white/90 transition-all hover:bg-white/15"
          >✨ New</Button
        >
        <Button
          unstyled
          class="rounded-xl px-3 py-1.5 text-sm font-medium text-white/90 transition-all hover:bg-white/15"
          >📁 Open</Button
        >
        <div class="mx-1 h-5 w-px bg-white/20"></div>
        <Button
          unstyled
          class="rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold text-white shadow-lg shadow-black/10 backdrop-blur-sm transition-all hover:bg-white/30"
          >💾 Save</Button
        >
      </Toolbar>
    </CodeExample>

    <CodeExample
      title="Pill Toolbar"
      description="Fully rounded toolbar with pill-shaped items — using slotClasses for the container."
      isolate
      previewClass="flex justify-center w-full"
    >
      <Toolbar
        aria-label="Navigation"
        variant="outlined"
        slotClasses={{ base: 'rounded-full px-1.5 py-1 border-border-default' }}
        gap="xs"
      >
        <Button variant="filled" intent="primary" size="sm" class="rounded-full">Dashboard</Button>
        <Button variant="ghost" size="sm" class="rounded-full">Projects</Button>
        <Button variant="ghost" size="sm" class="rounded-full">Teams</Button>
        <Button variant="ghost" size="sm" class="rounded-full">Settings</Button>
      </Toolbar>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A dock or pill-nav chrome used on several screens belongs in a <code class="text-text-primary"
        >BlocksProvider</code
      >
      preset (<code class="text-text-primary">presets.Toolbar</code>), applied via
      <code class="text-text-primary">preset</code>
      — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Renders with <code class="text-text-primary">role="toolbar"</code>.
          <code class="text-text-primary">aria-label</code> is required to identify the toolbar's
          purpose. <code class="text-text-primary">aria-orientation</code> is set automatically from
          the <code class="text-text-primary">orientation</code> prop.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          moves focus into and out of the toolbar. Individual items inside the toolbar follow their own
          keyboard semantics (e.g. Buttons activate via
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >).
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Best Practices</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Use descriptive <code class="text-text-primary">aria-label</code> values that communicate
          the toolbar's function (e.g. "Text formatting", "File actions"). Group related controls
          using <code class="text-text-primary">Separator</code> for visual clarity. Avoid nesting toolbars
          inside each other.
        </p>
      </div>
    </div>
  </div>
</Section>
