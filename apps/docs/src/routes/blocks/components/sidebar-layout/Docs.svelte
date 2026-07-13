<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { r } from '$lib/route';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: false },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 5 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'patterns', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'SidebarLayout Component', showToc: true }
  };
</script>

<!-- ─── When to use ─── -->

<Section marker="01" id="usage" title="When to use">
  <p class="text-text-secondary text-sm leading-relaxed">
    <strong>SidebarLayout</strong> is the ready-made app shell — it wires a <code>Sidebar</code>, a
    centered main column, and an optional mobile header into a responsive layout. Use it when you
    want a permanent sidebar on desktop with a hamburger overlay on mobile and you don't want to
    write the surrounding grid yourself. The component exposes
    <code>--sidebar-width</code> and <code>--sidebar-effective-width</code> on its root so the main-content
    offset animates in lockstep with the sidebar.
  </p>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    Pick a different layout or overlay if you need:
  </p>
  <ul class="text-text-secondary mt-2 list-inside list-disc space-y-1.5 text-sm">
    <li>
      A custom outer grid (multi-region layout, header bar with brand controls, full bleed sections)
      — build it yourself with the
      <a href={r('/blocks/primitives/sidebar')} class="text-primary hover:underline">Sidebar</a>
      primitive directly.
    </li>
    <li>
      A transient detail panel that pulls focus (backdrop + focus-trap) →
      <a href={r('/blocks/primitives/drawer')} class="text-primary hover:underline">Drawer</a>.
    </li>
    <li>
      A floating panel anchored to a specific element →
      <a href={r('/blocks/primitives/popover')} class="text-primary hover:underline">Popover</a>.
    </li>
  </ul>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    See the
    <a href={r('/recipes/dashboard')} class="text-primary hover:underline">Dashboard recipe</a>
    for a full app-shell demonstration.
  </p>
</Section>

<!-- ─── Examples ─── -->

<Section marker="02" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Default app shell"
      description="The most common pattern — permanent sidebar on desktop, hamburger overlay on mobile. The layout exposes --sidebar-width and --sidebar-effective-width on its root, so the main content offset works without any CSS plumbing in the consumer."
      preview={false}
      code={`<script>
  import { SidebarLayout, Button, MenuIcon, ThemeSwitcher } from '@urbicon-ui/blocks';
  let sidebarOpen = $state(false);
<\/script>

<SidebarLayout bind:open={sidebarOpen} sidebarWidth="16rem">
  {#snippet sidebarHeader()}
    <a href="/" class="flex h-14 items-center font-semibold">My App</a>
  {/snippet}

  {#snippet sidebar()}
    <nav class="flex flex-col gap-1 p-3">
      <a href="/dashboard" class="rounded-lg px-3 py-2 text-sm">Dashboard</a>
      <a href="/projects" class="rounded-lg px-3 py-2 text-sm">Projects</a>
      <a href="/settings" class="rounded-lg px-3 py-2 text-sm">Settings</a>
    </nav>
  {/snippet}

  {#snippet sidebarFooter()}
    <div class="flex items-center justify-between p-3">
      <span class="text-text-tertiary text-xs">v1.0.0</span>
      <ThemeSwitcher size="xs" />
    </div>
  {/snippet}

  {#snippet mobileHeader({ openSidebar })}
    <Button variant="ghost" size="sm" onclick={openSidebar} aria-label="Open menu">
      <MenuIcon class="h-5 w-5" />
    </Button>
    <span class="font-semibold">My App</span>
  {/snippet}

  <h1 class="text-2xl font-bold">Page content</h1>
  <p class="text-text-secondary mt-2">Goes inside a centered, max-width column.</p>
</SidebarLayout>`}
    />

    <CodeExample
      title="Grouped navigation with active state"
      description="Sections, icons, and an active-link pattern using SvelteKit's $page store. The mobile header surfaces the current page title for context."
      preview={false}
      code={`<script>
  import { page } from '$app/state';
  import { SidebarLayout, Button, MenuIcon, HomeIcon, UsersIcon, SettingsIcon } from '@urbicon-ui/blocks';

  const sections = [
    { label: 'Overview', items: [{ href: '/', label: 'Dashboard', icon: HomeIcon }] },
    {
      label: 'Workspace',
      items: [
        { href: '/team', label: 'Team', icon: UsersIcon },
        { href: '/settings', label: 'Settings', icon: SettingsIcon }
      ]
    }
  ];

  let sidebarOpen = $state(false);
  const path = $derived(page.url.pathname);
  const isActive = (href) => href === '/' ? path === '/' : path === href || path.startsWith(\`\${href}/\`);
  const activeItem = $derived(
    sections.flatMap((s) => s.items)
      .sort((a, b) => b.href.length - a.href.length)
      .find((i) => isActive(i.href))
  );
<\/script>

<SidebarLayout bind:open={sidebarOpen} sidebarWidth="17rem">
  {#snippet sidebarHeader()}
    <a href="/" class="flex h-14 items-center font-semibold">My App</a>
  {/snippet}

  {#snippet sidebar()}
    <nav class="flex flex-col gap-6 p-3">
      {#each sections as section, i (section.label ?? i)}
        <div class="flex flex-col gap-1">
          <span class="text-text-tertiary px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider">
            {section.label}
          </span>
          {#each section.items as item (item.href)}
            {@const Icon = item.icon}
            <a href={item.href} class={isActive(item.href)
              ? 'bg-primary-subtle text-primary flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium'
              : 'text-text-secondary hover:bg-surface-hover flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm'}>
              <Icon class="h-4 w-4 shrink-0" />
              <span class="truncate">{item.label}</span>
            </a>
          {/each}
        </div>
      {/each}
    </nav>
  {/snippet}

  {#snippet mobileHeader({ openSidebar })}
    <Button variant="ghost" size="sm" onclick={openSidebar} aria-label="Open menu">
      <MenuIcon class="h-5 w-5" />
    </Button>
    {#if activeItem}
      <span class="font-semibold truncate">{activeItem.label}</span>
    {/if}
  {/snippet}

  <!-- page content -->
</SidebarLayout>`}
    />

    <CodeExample
      title="Collapsible mode (toggle on all viewports)"
      description="Set mode='collapsible' to make the sidebar toggleable on desktop too. The panel animates its width via --sidebar-effective-width and the main content offset transitions in lockstep."
      preview={false}
      code={`<SidebarLayout
  bind:open={sidebarOpen}
  mode="collapsible"
  sidebarWidth="16rem"
>
  {#snippet sidebarHeader()}<span class="font-semibold">App</span>{/snippet}
  {#snippet sidebar()}<nav class="p-3"><!-- … --></nav>{/snippet}

  <Button onclick={() => (sidebarOpen = !sidebarOpen)}>
    {sidebarOpen ? 'Collapse' : 'Expand'} sidebar
  </Button>
</SidebarLayout>`}
    />

    <CodeExample
      title="Right-side rail"
      description="Set side='right' for an inspector-style layout. The main content gets right-padding instead of left."
      preview={false}
      code={`<SidebarLayout side="right" sidebarWidth="20rem">
  {#snippet sidebar()}
    <div class="p-4">Inspector content…</div>
  {/snippet}
  <!-- main content (occupies left side) -->
</SidebarLayout>`}
    />
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Branded shell via slotClasses"
      description="slotClasses lets you restyle each region. sidebar* keys are forwarded into the embedded Sidebar primitive."
      preview={false}
      code={`<SidebarLayout
  bind:open={sidebarOpen}
  sidebarWidth="16rem"
  slotClasses={{
    root: 'bg-neutral-50',
    sidebar: 'bg-neutral-900 border-neutral-800',
    sidebarHeader: 'border-neutral-800',
    sidebarFooter: 'border-neutral-800',
    mobileHeader: 'bg-neutral-900 text-white border-neutral-800'
  }}
>
  <!-- snippets -->
</SidebarLayout>`}
    />

    <CodeExample
      title="Reusable preset via BlocksProvider"
      description="When the same shell look repeats across an app, register it once as a preset and reference it by name. Presets win over class overrides for cohesive hover/active/dark-mode behavior."
      preview={false}
      code={`<BlocksProvider
  presets={{
    SidebarLayout: {
      brand: {
        slotClasses: {
          sidebar: 'bg-neutral-900 border-neutral-800',
          mobileHeader: 'bg-neutral-900 text-white'
        }
      }
    }
  }}
>
  <SidebarLayout preset="brand" bind:open={sidebarOpen}>
    <!-- … -->
  </SidebarLayout>
</BlocksProvider>`}
    />

    <CodeExample
      title="Wider content column"
      description="Override the centered column width via contentMaxWidth, or pass 'none' to disable centering entirely."
      preview={false}
      code={`<SidebarLayout contentMaxWidth="2xl" bind:open={sidebarOpen}>
  <!-- content uses max-w-screen-2xl -->
</SidebarLayout>

<SidebarLayout contentMaxWidth="none" bind:open={sidebarOpen}>
  <!-- content stretches to fill the available width -->
</SidebarLayout>`}
    />
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Skip-link target</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The main column is rendered as <code class="text-text-primary"
            >&lt;main id="main-content"&gt;</code
          >, so a global skip-link with
          <code class="text-text-primary">href="#main-content"</code> jumps straight to the page content.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Sidebar landmark</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Inherits the <code class="text-text-primary">Sidebar</code> primitive's behavior: rendered
          as <code class="text-text-primary">&lt;aside&gt;</code> and marked
          <code class="text-text-primary">aria-hidden="true"</code> while the mobile overlay is closed.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Mobile overlay</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Body scroll is locked while the overlay is open. Pressing
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          closes the overlay (configurable via
          <code class="text-text-primary">closeOnEscape</code>), and a backdrop click also dismisses
          it (configurable via
          <code class="text-text-primary">closeOnBackdropClick</code>).
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The padding-transition on the main column uses the design system's
          <code class="text-text-primary">--blocks-duration-normal</code> and
          <code class="text-text-primary">--blocks-ease-confident</code> tokens, which respect
          <code class="text-text-primary">prefers-reduced-motion</code>.
        </p>
      </div>
    </div>
  </div>
</Section>
