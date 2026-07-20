<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Tooltip, Button, Badge } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['label', 'placement', 'intent', 'size', 'arrow', 'showDelay', 'disabled'],
        defaults: { placement: 'top', intent: 'neutral', size: 'md', arrow: true },
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
    meta: { title: 'Tooltip Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Formatting Toolbar"
      description="The canonical tooltip use case — icon-only buttons paired with keyboard shortcut hints."
      code={`<Tooltip label="Bold (⌘B)">
  <button class="toolbar-btn">B</button>
</Tooltip>`}
      isolate
      previewClass="flex justify-center py-6"
    >
      <div
        class="bg-surface-elevated border-border-subtle inline-flex items-center gap-0.5 rounded-xl border p-1.5 shadow-[var(--blocks-shadow-sm)]"
      >
        {#each [{ icon: 'B', hint: 'Bold (⌘B)', style: 'font-bold' }, { icon: 'I', hint: 'Italic (⌘I)', style: 'italic' }, { icon: 'U', hint: 'Underline (⌘U)', style: 'underline' }, { icon: 'S', hint: 'Strikethrough (⌘⇧X)', style: 'line-through' }, { icon: '🔗', hint: 'Insert Link (⌘K)', style: '' }, { icon: '<>', hint: 'Inline Code (⌘E)', style: 'font-mono text-xs' }, { icon: '📷', hint: 'Insert Image', style: '' }] as tool (tool.hint)}
          <Tooltip label={tool.hint} size="sm">
            <button
              class="text-text-secondary hover:bg-surface-hover hover:text-text-primary rounded-modify flex h-8 w-8 items-center justify-center text-sm transition-colors {tool.style}"
            >
              {tool.icon}
            </button>
          </Tooltip>
        {/each}
      </div>
    </CodeExample>

    <CodeExample
      title="Status Dashboard"
      description="Color-coded tooltips on icon-only status indicators communicate severity at a glance."
      isolate
      previewClass="flex flex-col items-center gap-3 py-4"
    >
      <div
        class="bg-surface-elevated border-border-subtle divide-border-subtle w-full max-w-sm divide-y rounded-xl border"
      >
        {#each [{ service: 'API Gateway', status: 'Operational – 99.99 % uptime', intent: 'success', dot: 'bg-success' }, { service: 'Auth Service', status: '⚠ Degraded – elevated latency', intent: 'warning', dot: 'bg-warning' }, { service: 'CDN', status: 'Operational – 34 ms avg', intent: 'success', dot: 'bg-success' }, { service: 'Database', status: '✗ Incident – failover active', intent: 'danger', dot: 'bg-danger' }] as const as row (row.service)}
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-text-primary text-sm">{row.service}</span>
            <Tooltip label={row.status} intent={row.intent} placement="left">
              <span class="flex h-5 w-5 items-center justify-center">
                <span class="{row.dot} inline-block h-2.5 w-2.5 rounded-full"></span>
              </span>
            </Tooltip>
          </div>
        {/each}
      </div>
    </CodeExample>

    <CodeExample
      title="Truncated Text Reveal"
      description="Wrap truncated text with a tooltip to expose the full value on hover or focus."
      isolate
      previewClass="flex justify-center py-6"
    >
      <ul
        class="bg-surface-elevated border-border-subtle divide-border-subtle w-full max-w-sm divide-y rounded-xl border"
      >
        {#each [{ name: 'Q4-roadmap-final-with-stakeholder-feedback-v3.pdf', size: '2.4 MB' }, { name: 'design-system-token-migration-notes.md', size: '18 KB' }, { name: 'customer-interview-transcripts-jan-2026.zip', size: '14.2 MB' }] as file (file.name)}
          <li class="flex items-center justify-between gap-3 px-4 py-2.5">
            <Tooltip label={file.name} placement="top-start" size="sm">
              <span class="text-text-primary block max-w-[14rem] truncate text-sm">{file.name}</span
              >
            </Tooltip>
            <span class="text-text-tertiary shrink-0 text-xs">{file.size}</span>
          </li>
        {/each}
      </ul>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Branded Gradient"
      description="Override the tooltip surface with slotClasses for a branded look."
      isolate
      previewClass="flex justify-center py-8"
    >
      <Tooltip
        label="✨ Premium feature unlocked"
        slotClasses={{
          base: 'bg-linear-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 font-semibold'
        }}
        size="md"
      >
        <Button intent="primary" variant="filled">Upgrade</Button>
      </Tooltip>
    </CodeExample>

    <CodeExample
      title="Glass Morphism (unstyled)"
      description="Strip all defaults and rebuild with a translucent glass aesthetic."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-rose-500 via-fuchsia-500 to-indigo-500 px-8 py-12"
    >
      <Tooltip
        unstyled
        label="Frosted glass tooltip"
        class="rounded-xl border border-white/20 bg-white/15 px-3 py-1.5 text-sm font-medium text-white shadow-2xl backdrop-blur-xl"
        slotClasses={{
          arrow: 'h-2 w-2 rotate-45 border border-white/20 bg-white/15 backdrop-blur-xl'
        }}
      >
        <Button
          unstyled
          class="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
        >
          Hover for glass
        </Button>
      </Tooltip>
    </CodeExample>

    <CodeExample
      title="Terminal / Monospace"
      description="A developer-friendly tooltip with monospace font and dark aesthetic."
      isolate
      previewClass="flex justify-center py-8"
    >
      <Tooltip
        label="git commit -m 'fix: resolve race condition'"
        slotClasses={{
          base: 'font-mono bg-neutral-900 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
        }}
        size="sm"
      >
        <Badge variant="outlined" intent="neutral">
          <span class="font-mono text-xs">$ git</span>
        </Badge>
      </Tooltip>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A branded tooltip surface belongs in a <code class="text-text-primary">BlocksProvider</code>
      preset (<code class="text-text-primary">presets.Tooltip</code>): registered once, every
      <code class="text-text-primary">preset</code>
      instance matches — see
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
          Uses <code class="text-text-primary">role="tooltip"</code> with
          <code class="text-text-primary">aria-describedby</code> linking the trigger to the tooltip content.
          A unique ID is generated automatically for each instance.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Tooltips appear on
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Focus</kbd
          >
          and dismiss with
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >. The tooltip itself is never focusable – it supplements the trigger's accessible
          description.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Timing</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          A configurable <code class="text-text-primary">showDelay</code> (default 200 ms) prevents
          accidental activation during mouse movement. The
          <code class="text-text-primary">hideDelay</code> (default 100 ms) allows users to briefly move
          away without the tooltip disappearing.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The tooltip uses <code class="text-text-primary">opacity</code> transitions with the
          system's <code class="text-text-primary">--blocks-duration-fast</code> token. In reduced motion
          mode, the transition duration is automatically shortened.
        </p>
      </div>
    </div>
  </div>
</Section>
