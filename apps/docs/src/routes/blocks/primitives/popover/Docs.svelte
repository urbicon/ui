<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Popover, Button, Badge } from '@urbicon-ui/blocks';
  import { r } from '$lib/route';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['placement', 'size', 'offsetDistance', 'syncWidth'],
        defaults: { placement: 'bottom-start', size: 'md', offsetDistance: 4 },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Popover Component', showToc: true }
  };

  let controlledOpen = $state(false);
</script>

<!-- ─── When to use ─── -->

<Section marker="01" id="usage" title="When to use">
  <p class="text-text-secondary text-sm leading-relaxed">
    <strong>Popover</strong> is a floating panel anchored to a trigger element. Use it for
    contextual surfaces — action menus, date pickers, inline help — that should appear next to the
    element the user just interacted with. Built on Floating UI for placement, with native
    <code>popover="auto"</code> for the open/close lifecycle. Not modal.
  </p>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    Pick a different overlay if you need:
  </p>
  <ul class="text-text-secondary mt-2 list-inside list-disc space-y-1.5 text-sm">
    <li>
      A modal sheet that opens from the edge of the viewport (focus trap, backdrop) →
      <a href={r('/blocks/primitives/drawer')} class="text-primary hover:underline">Drawer</a>.
    </li>
    <li>
      A hover-only description tied to <code>aria-describedby</code> →
      <a href={r('/blocks/primitives/tooltip')} class="text-primary hover:underline">Tooltip</a>.
    </li>
    <li>
      A list of selectable actions or items with full keyboard semantics →
      <a href={r('/blocks/primitives/menu')} class="text-primary hover:underline">Menu</a>.
    </li>
    <li>
      A centered, blocking modal (confirmation, short form) →
      <a href={r('/blocks/primitives/dialog')} class="text-primary hover:underline">Dialog</a>.
    </li>
  </ul>
</Section>

<!-- ─── Examples ─── -->

<Section marker="02" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample title="Sizes" isolate previewClass="flex items-center gap-4">
      <Popover size="sm">
        {#snippet trigger()}
          <Button variant="outlined" size="sm">Small</Button>
        {/snippet}
        <div class="text-text-secondary p-2">Compact panel for tight spaces</div>
      </Popover>
      <Popover size="md">
        {#snippet trigger()}
          <Button variant="outlined" size="sm">Medium</Button>
        {/snippet}
        <div class="text-text-secondary p-3">Default size with comfortable spacing</div>
      </Popover>
      <Popover size="lg">
        {#snippet trigger()}
          <Button variant="outlined" size="sm">Large</Button>
        {/snippet}
        <div class="text-text-secondary p-4">Generous panel for rich content</div>
      </Popover>
    </CodeExample>

    <CodeExample
      title="Placements"
      description="The popover auto-flips when the preferred side runs out of space."
      isolate
      previewClass="flex flex-wrap items-center justify-center gap-3 py-16"
    >
      {#each [{ label: 'Top', placement: 'top' }, { label: 'Top Start', placement: 'top-start' }, { label: 'Top End', placement: 'top-end' }, { label: 'Bottom', placement: 'bottom' }, { label: 'Left', placement: 'left' }, { label: 'Right', placement: 'right' }] as const as { label, placement } (placement)}
        <Popover {placement}>
          {#snippet trigger()}
            <Button variant="outlined" size="sm">{label}</Button>
          {/snippet}
          <div class="text-text-secondary px-3 py-2 whitespace-nowrap">
            Placed at <span class="text-text-primary font-medium">{placement}</span>
          </div>
        </Popover>
      {/each}
    </CodeExample>

    <CodeExample
      title="Rich Content – User Profile"
      code={`<Popover placement="bottom-end">
  {#snippet trigger()}
    <div class="avatar-trigger">JD</div>
  {/snippet}
  {#snippet children()}
    <div class="w-64">
      <!-- profile card content -->
    </div>
  {/snippet}
</Popover>`}
      isolate
      previewClass="flex justify-center"
    >
      <Popover placement="bottom-end">
        {#snippet trigger()}
          <button
            type="button"
            aria-label="Open user menu"
            class="bg-primary/10 text-primary-emphasis hover:ring-primary/30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition-all hover:ring-2"
          >
            JD
          </button>
        {/snippet}
        <div class="w-64">
          <div class="border-border-subtle border-b px-4 py-3">
            <div class="flex items-center gap-3">
              <div
                class="bg-primary/10 text-primary-emphasis flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              >
                JD
              </div>
              <div class="min-w-0">
                <div class="text-text-primary truncate text-sm font-semibold">Jane Doe</div>
                <div class="text-text-tertiary truncate text-xs">jane@urbicon.dev</div>
              </div>
              <Badge size="xs" intent="success" class="ml-auto shrink-0">Pro</Badge>
            </div>
          </div>
          <div class="py-1">
            {#each [{ icon: '👤', label: 'Profile' }, { icon: '⚙️', label: 'Settings' }, { icon: '📊', label: 'Analytics' }] as item (item.label)}
              <button
                class="text-text-secondary hover:bg-surface-hover hover:text-text-primary flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors"
              >
                <span class="w-5 text-center text-xs">{item.icon}</span>
                {item.label}
              </button>
            {/each}
          </div>
          <div class="border-border-subtle border-t py-1">
            <button
              class="text-danger hover:bg-danger/5 flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors"
            >
              <span class="w-5 text-center text-xs">🚪</span>
              Sign out
            </button>
          </div>
        </div>
      </Popover>
    </CodeExample>

    <CodeExample
      title="Sync Width"
      description="Match the popover width to its trigger – ideal for select or autocomplete patterns."
      code={`<Popover syncWidth placement="bottom-start">
  {#snippet trigger()}
    <div class="w-80 ...">Select a framework…</div>
  {/snippet}
  {#snippet children()}
    <div class="py-1">
      {#each frameworks as fw}
        <div class="hover:bg-surface-hover px-3 py-2">{fw}</div>
      {/each}
    </div>
  {/snippet}
</Popover>`}
      isolate
      previewClass="flex justify-center"
    >
      <Popover syncWidth placement="bottom-start">
        {#snippet trigger()}
          <button
            type="button"
            class="bg-surface-base border-border-default hover:border-border-emphasis rounded-modify flex w-80 cursor-pointer items-center justify-between border px-3 py-2.5 text-sm transition-colors"
          >
            <span class="text-text-secondary">Select a framework…</span>
            <svg class="text-text-tertiary h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        {/snippet}
        <div class="py-1">
          {#each ['SvelteKit', 'Next.js', 'Nuxt', 'Remix', 'Astro'] as fw (fw)}
            <div
              class="text-text-primary hover:bg-surface-hover cursor-pointer px-3 py-2 text-sm transition-colors first:rounded-t-md last:rounded-b-md"
            >
              {fw}
            </div>
          {/each}
        </div>
      </Popover>
    </CodeExample>

    <CodeExample
      title="Controlled State"
      description="Bind the open state to react to or drive popover visibility from outside."
      code={`<` +
        `script>
  let open = $state(false);
<` +
        `/script>

<Popover bind:open>
  {#snippet trigger()}
    <Button>{open ? 'Viewing' : 'View'} Status</Button>
  {/snippet}
  {#snippet children()}
    <div class="p-3">...</div>
    <Button onclick={() => open = false}>Dismiss</Button>
  {/snippet}
</Popover>`}
      isolate
      previewClass="flex justify-center"
    >
      <Popover bind:open={controlledOpen}>
        {#snippet trigger()}
          <Button
            variant={controlledOpen ? 'filled' : 'outlined'}
            intent={controlledOpen ? 'primary' : 'neutral'}
          >
            {controlledOpen ? 'Viewing' : 'View'} Status
          </Button>
        {/snippet}
        <div class="w-56 p-3">
          <div class="mb-2 flex items-center gap-2">
            <span class="bg-success h-2 w-2 rounded-full"></span>
            <span class="text-text-primary text-sm font-semibold">All Systems Operational</span>
          </div>
          <p class="text-text-tertiary mb-3 text-xs leading-relaxed">
            Last checked 2 min ago. Uptime 99.98 % over 30 days.
          </p>
          <Button
            variant="ghost"
            size="xs"
            intent="primary"
            onclick={() => (controlledOpen = false)}
          >
            Dismiss
          </Button>
        </div>
      </Popover>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Gradient Action Panel"
      description="Override the panel surface with slotClasses for a branded popover."
      isolate
      previewClass="flex justify-center"
    >
      <Popover
        slotClasses={{
          base: 'bg-linear-to-br from-violet-600 to-indigo-700 border-none shadow-xl shadow-violet-500/20 text-white'
        }}
        size="md"
      >
        {#snippet trigger()}
          <Button intent="primary">Upgrade Plan</Button>
        {/snippet}
        <div class="w-64 p-4">
          <div class="mb-1 text-sm font-bold text-white">Go Premium</div>
          <p class="mb-3 text-xs leading-relaxed text-white/75">
            Unlock advanced analytics, priority support, and unlimited projects.
          </p>
          <Button
            unstyled
            class="w-full rounded-lg bg-white px-3 py-2 text-center text-sm font-semibold text-violet-700 transition-all hover:bg-white/90"
          >
            Start Free Trial
          </Button>
        </div>
      </Popover>
    </CodeExample>

    <CodeExample
      title="Glass Morphism (unstyled)"
      description="Strip all defaults and rebuild with a translucent glass aesthetic."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-rose-500 via-fuchsia-500 to-indigo-500 px-8 py-12"
    >
      <Popover
        unstyled
        class="w-56 rounded-2xl border border-white/20 bg-white/10 p-4 text-white shadow-2xl backdrop-blur-xl"
      >
        {#snippet trigger()}
          <Button
            unstyled
            class="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
          >
            Quick Actions
          </Button>
        {/snippet}
        <div class="space-y-1">
          {#each ['New Project', 'Import Data', 'Invite Team'] as action (action)}
            <div
              class="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/90 transition-colors hover:bg-white/10"
            >
              {action}
            </div>
          {/each}
        </div>
      </Popover>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA Attributes</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The trigger wrapper sets
          <code class="text-text-primary">aria-haspopup="dialog"</code> and
          <code class="text-text-primary">aria-expanded</code> reflecting the current open state.
          The floating panel receives
          <code class="text-text-primary">role="dialog"</code> by default. Set
          <code class="text-text-primary">aria-modal</code> when the popover contains a form or critical
          action.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          toggle the popover when the trigger is focused.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          closes the popover and returns focus to the trigger.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          moves through focusable content inside the popover.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Click Outside</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Clicking outside the popover or its trigger closes it automatically. Use the
          <code class="text-text-primary">ignore</code> prop to exclude specific elements from outside-click
          detection.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Focus Management</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          When <code class="text-text-primary">aria-modal</code> is set, focus stays within the popover
          until it is closed. Use for forms or critical actions where escaping focus could confuse the
          user. For lightweight overlays, omit it so users can freely tab away.
        </p>
      </div>
    </div>
  </div>
</Section>
