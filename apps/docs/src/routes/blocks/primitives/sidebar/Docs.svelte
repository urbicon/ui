<!-- urbicon-ignore raw-tailwind-color — the 3 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Avatar, Badge, Button, CloseIcon, Kbd, Separator, Sidebar } from '@urbicon-ui/blocks';
  import { r } from '$lib/route';

  let detailOpen = $state(false);
  let navOpen = $state(false);
  let brandedOpen = $state(false);

  const appNav = ['Overview', 'Analytics', 'Customers', 'Products', 'Settings'];
</script>

<!-- ─── When to use ─── -->

<Section marker id="usage" title="When to use">
  <p class="text-text-secondary text-sm leading-relaxed">
    <strong>Sidebar</strong> is an <code>&lt;aside&gt;</code> landmark for a side panel that is
    <em>part of the page layout</em>. Use it for persistent app navigation that slides in as an
    overlay on mobile (<code>mode="responsive"</code>) or width-collapses at all viewports (<code
      >mode="collapsible"</code
    >). On desktop there is no backdrop — the panel sits alongside the main content.
  </p>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    Pick a different overlay if you need:
  </p>
  <ul class="text-text-secondary mt-2 list-outside list-disc space-y-1.5 pl-5 text-sm">
    <li>
      A ready-made app shell with mobile hamburger, header slot, and centered content column →
      <a href={r('/blocks/components/sidebar-layout')} class="text-primary hover:underline"
        >SidebarLayout</a
      >.
    </li>
    <li>
      A transient detail panel that pulls focus (backdrop + focus-trap, opens on click, closes after
      action) →
      <a href={r('/blocks/primitives/drawer')} class="text-primary hover:underline">Drawer</a>.
    </li>
    <li>
      A floating panel anchored to a specific element (date picker, action menu, autocomplete) →
      <a href={r('/blocks/primitives/popover')} class="text-primary hover:underline">Popover</a>.
    </li>
  </ul>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Right-Side Detail Panel"
      description="The primary use case for the Sidebar primitive: a detail or property panel that slides in from an edge as an overlay on click."
      code={`<Sidebar bind:open side="right" width="20rem">
  {#snippet header()}
    <span class="font-semibold">Item Details</span>
  {/snippet}
  <div class="space-y-4 p-4">
    <div>
      <dt class="text-xs text-text-tertiary">Name</dt>
      <dd class="text-sm text-text-primary">Project Alpha</dd>
    </div>
    <div>
      <dt class="text-xs text-text-tertiary">Status</dt>
      <dd><Badge intent="success" size="sm">Active</Badge></dd>
    </div>
  </div>
</Sidebar>`}
    >
      <Button variant="outlined" onclick={() => (detailOpen = true)}>Show Details</Button>
      {#if detailOpen}
        <Sidebar
          open={true}
          side="right"
          width="20rem"
          onOpenChange={(o) => {
            if (!o) detailOpen = false;
          }}
        >
          {#snippet header()}
            <div class="flex items-center justify-between py-3">
              <span class="text-text-primary font-semibold">Item Details</span>
              <Button
                variant="ghost"
                intent="neutral"
                size="xs"
                onclick={() => (detailOpen = false)}
                aria-label="Close panel"
              >
                <CloseIcon class="h-4 w-4" />
              </Button>
            </div>
          {/snippet}
          <div class="p-4">
            <div class="space-y-4">
              <div>
                <dt class="text-text-tertiary text-xs tracking-wider uppercase">Name</dt>
                <dd class="text-text-primary mt-1 text-sm font-medium">Project Alpha</dd>
              </div>
              <Separator />
              <div>
                <dt class="text-text-tertiary text-xs tracking-wider uppercase">Status</dt>
                <dd class="mt-1">
                  <Badge intent="success" size="sm">Active</Badge>
                </dd>
              </div>
              <Separator />
              <div>
                <dt class="text-text-tertiary text-xs tracking-wider uppercase">Created</dt>
                <dd class="text-text-primary mt-1 text-sm">March 1, 2026</dd>
              </div>
              <Separator />
              <div>
                <dt class="text-text-tertiary text-xs tracking-wider uppercase">Team</dt>
                <dd class="mt-2 flex flex-wrap gap-1.5">
                  {#each ['Design', 'Engineering', 'Product'] as tag (tag)}
                    <Badge variant="soft" size="sm">{tag}</Badge>
                  {/each}
                </dd>
              </div>
            </div>
          </div>
        </Sidebar>
      {/if}
    </CodeExample>

    <CodeExample
      title="Collapsible App Navigation"
      description="The second of the two modes, and the one the Playground cannot reach. In `responsive` mode (the default) `open` only drives the mobile overlay — on a desktop width the panel is always there. In `collapsible` mode `open` drives it at every width: the panel stays mounted and animates its width to 0 instead of sliding away, which is why the button below toggles rather than opens. Keep it mounted — wrapping it in a conditional block gets you a disappearing panel in either mode and no animation in this one."
      code={`<!-- The panel stays mounted; open animates its width, it does not unmount. -->
<Button variant="outlined" onclick={() => (navOpen = !navOpen)}>
  {navOpen ? 'Collapse' : 'Expand'} navigation
</Button>

<Sidebar bind:open={navOpen} mode="collapsible" width="16rem">
  {#snippet header()}
    <span class="font-semibold">Acme</span>
  {/snippet}
  <nav class="space-y-1 p-3">
    {#each ['Overview', 'Analytics', 'Settings'] as item (item)}
      <a href="/{item.toLowerCase()}" class="block rounded-lg px-3 py-2 text-sm">{item}</a>
    {/each}
  </nav>
</Sidebar>`}
    >
      <Button variant="outlined" onclick={() => (navOpen = !navOpen)}>
        {navOpen ? 'Collapse' : 'Expand'} navigation
      </Button>
      <Sidebar bind:open={navOpen} mode="collapsible" width="16rem">
        {#snippet header()}
          <div class="flex items-center justify-between py-3">
            <span class="text-text-primary font-semibold">Acme</span>
            <Button
              variant="ghost"
              intent="neutral"
              size="xs"
              onclick={() => (navOpen = false)}
              aria-label="Collapse navigation"
            >
              <CloseIcon class="h-4 w-4" />
            </Button>
          </div>
        {/snippet}
        <nav class="space-y-1 p-3">
          {#each appNav as item (item)}
            <button
              type="button"
              class="text-text-secondary hover:bg-surface-hover hover:text-text-primary w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
              onclick={() => (navOpen = false)}
            >
              {item}
            </button>
          {/each}
        </nav>
      </Sidebar>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Branded Sidebar"
      description="Use slotClasses to create a dark-themed branded sidebar."
      code={`<Sidebar
  bind:open
  slotClasses={{
    panel: 'bg-neutral-900 border-neutral-800',
    header: 'border-neutral-800',
    footer: 'border-neutral-800'
  }}
>
  {#snippet header()}
    <span class="text-white font-semibold">Brand</span>
  {/snippet}
  <nav class="p-3">
    <button class="text-neutral-400 hover:bg-neutral-800">Overview</button>
  </nav>
</Sidebar>`}
    >
      <Button onclick={() => (brandedOpen = true)}>Open Branded Sidebar</Button>
      {#if brandedOpen}
        <Sidebar
          open={true}
          onOpenChange={(o) => {
            if (!o) brandedOpen = false;
          }}
          slotClasses={{
            panel: 'bg-neutral-900 border-neutral-800',
            header: 'border-neutral-800',
            footer: 'border-neutral-800'
          }}
        >
          {#snippet header()}
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-2">
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
                  <span class="text-xs font-bold text-white">A</span>
                </div>
                <span class="font-semibold text-white">Acme Inc</span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onclick={() => (brandedOpen = false)}
                aria-label="Close sidebar"
                slotClasses={{ base: 'text-neutral-400 hover:text-white hover:bg-neutral-800' }}
              >
                <CloseIcon class="h-4 w-4" />
              </Button>
            </div>
          {/snippet}
          <nav class="space-y-1 p-3">
            {#each [{ label: 'Overview', active: true }, { label: 'Analytics' }, { label: 'Customers' }, { label: 'Products' }, { label: 'Settings' }] as item (item.label)}
              <button
                class={item.active
                  ? 'w-full rounded-lg bg-indigo-500/20 px-3 py-2 text-left text-sm font-medium text-indigo-400 transition-colors'
                  : 'w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200'}
                onclick={() => (brandedOpen = false)}
              >
                {item.label}
              </button>
            {/each}
          </nav>
          {#snippet footer()}
            <div class="p-4">
              <div class="flex items-center gap-3">
                <Avatar
                  name="Noah Bennett"
                  size="sm"
                  slotClasses={{ frame: 'bg-neutral-800 text-neutral-300' }}
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-neutral-200">Noah B.</p>
                  <p class="truncate text-xs text-neutral-500">Admin</p>
                </div>
              </div>
            </div>
          {/snippet}
        </Sidebar>
      {/if}
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      Sidebar also supports <code class="text-text-primary">unstyled</code> for a fully hand-rolled
      shell. The branded dark panel above is natural preset material: register it under
      <code class="text-text-primary">presets.Sidebar</code>
      on
      <code class="text-text-primary">BlocksProvider</code> and apply it via
      <code class="text-text-primary">preset</code>
      — see <a href={r('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Semantic Landmark">
      <p>
        Renders as an <code class="text-text-primary">&lt;aside&gt;</code> element, which screen
        readers announce as a complementary landmark. When the sidebar is closed (mobile overlay
        dismissed, or collapsible mode closed),
        <code class="text-text-primary">aria-hidden="true"</code> is applied to remove it from the accessibility
        tree.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Escape" />
        closes the mobile overlay (configurable via
        <code class="text-text-primary">closeOnEscape</code>). Backdrop click dismiss is
        configurable via <code class="text-text-primary">closeOnBackdropClick</code>.
      </p>
    </Note>
    <Note title="Responsive Behavior">
      <p>
        In <code class="text-text-primary">responsive</code> mode (default): on desktop (≥1024px)
        the sidebar is always visible as a fixed panel — the
        <code class="text-text-primary">open</code> prop only controls the mobile overlay. Below 1024px
        it slides in as an overlay with backdrop and body scroll lock.
      </p>
      <p class="text-text-secondary mt-2 text-sm leading-relaxed">
        In <code class="text-text-primary">collapsible</code> mode: the
        <code class="text-text-primary">open</code> prop controls the sidebar at all viewports. On
        desktop it animates its width (no backdrop or scroll lock). On mobile it behaves as an
        overlay like responsive mode. Use
        <code class="text-text-primary">--sidebar-effective-width</code> (0px when closed, full width
        when open) to transition your main content offset.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        Slide and width transitions use CSS custom property durations that respect
        <code class="text-text-primary">prefers-reduced-motion</code> via the design token system.
      </p>
    </Note>
  </NoteList>
</Section>
