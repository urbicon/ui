<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Breadcrumb, Badge } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['items', 'size', 'separator', 'unstyled'],
        defaults: { size: 'md' },
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
    meta: { title: 'Breadcrumb Component', showToc: true }
  };

  // Demo-only items don't navigate — they're just to illustrate the
  // component's shape. Real consumers omit the onclick override.
  const demoNoop = (event: MouseEvent) => event.preventDefault();

  const basicItems = [
    { label: 'Home', href: '#', onclick: demoNoop },
    { label: 'Products', href: '#', onclick: demoNoop },
    { label: 'Headphones', href: '#', onclick: demoNoop },
    { label: 'AirPods Max' }
  ];

  const deepItems = [
    { label: 'Org', href: '#', onclick: demoNoop },
    { label: 'Engineering', href: '#', onclick: demoNoop },
    { label: 'Frontend', href: '#', onclick: demoNoop },
    { label: 'Components', href: '#', onclick: demoNoop },
    { label: 'Breadcrumb' }
  ];

  const veryDeepItems = [
    { label: 'Org', href: '#', onclick: demoNoop },
    { label: 'Engineering', href: '#', onclick: demoNoop },
    { label: 'Platform', href: '#', onclick: demoNoop },
    { label: 'Design System', href: '#', onclick: demoNoop },
    { label: 'Primitives', href: '#', onclick: demoNoop },
    { label: 'Navigation', href: '#', onclick: demoNoop },
    { label: 'Breadcrumb' }
  ];

  const docsItems = [
    { label: 'Docs', href: '#', onclick: demoNoop },
    { label: 'Components', href: '#', onclick: demoNoop },
    { label: 'Navigation', href: '#', onclick: demoNoop },
    { label: 'Breadcrumb' }
  ];
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Deep Hierarchy"
      description="Handles long paths gracefully with wrapping. Demo items use `href='#'` + `onclick: preventDefault` to keep the docs scroll position — real consumers omit the `onclick`."
      isolate
    >
      <Breadcrumb items={deepItems} size="sm" />
    </CodeExample>

    <CodeExample
      title="Collapsing Long Paths"
      description="Set `maxItems` to fold the middle of a deep trail into an expandable ellipsis (…). `itemsBeforeCollapse` / `itemsAfterCollapse` keep that many items at each end (the current page is always shown); clicking the ellipsis reveals the full path and moves focus to the first revealed item."
      isolate
    >
      <Breadcrumb items={veryDeepItems} maxItems={4} itemsBeforeCollapse={2} size="sm" />
    </CodeExample>

    <CodeExample
      title="With Icon Home"
      description="Replace the first label with an icon for compact navigation."
      isolate
    >
      <Breadcrumb
        items={[
          { label: '🏠', href: '/', 'aria-label': 'Home' },
          { label: 'Blog', href: '/blog' },
          { label: 'Architecture', href: '/blog/architecture' },
          { label: 'Monorepo Setup' }
        ]}
      >
        {#snippet separator()}
          <svg
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        {/snippet}
      </Breadcrumb>
    </CodeExample>

    <CodeExample
      title="Page Header Context"
      description="Breadcrumb paired with a page title — a common real-world pattern."
      isolate
      previewClass="w-full"
    >
      <div class="flex flex-col gap-2">
        <Breadcrumb
          items={[
            { label: 'Projects', href: '/projects' },
            { label: 'urbicon-ui', href: '/projects/urbicon-ui' },
            { label: 'Settings' }
          ]}
          size="sm"
        >
          {#snippet separator()}
            <svg
              class="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          {/snippet}
        </Breadcrumb>
        <div class="flex items-center gap-3">
          <h1 class="text-text-primary text-2xl font-bold">Settings</h1>
          <Badge intent="warning" size="xs" variant="soft">Beta</Badge>
        </div>
        <p class="text-text-secondary text-sm">
          Manage your project configuration and preferences.
        </p>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Pill Links"
      description="Use slotClasses to turn breadcrumb links into subtle pill buttons."
      isolate
    >
      <Breadcrumb
        items={basicItems}
        slotClasses={{
          link: 'rounded-full bg-surface-subtle px-2.5 py-0.5 no-underline hover:bg-surface-hover hover:no-underline',
          currentPage: 'rounded-full bg-primary/10 text-primary px-2.5 py-0.5'
        }}
      >
        {#snippet separator()}
          <svg
            class="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        {/snippet}
      </Breadcrumb>
    </CodeExample>

    <CodeExample
      title="Glassmorphism"
      description="Frosted glass breadcrumb over a rich gradient background."
      isolate
      previewClass="flex items-center rounded-xl bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-6"
    >
      <Breadcrumb
        unstyled
        items={[
          { label: 'Home', href: '/' },
          { label: 'Gallery', href: '/gallery' },
          { label: 'Featured' }
        ]}
        class="flex items-center rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm backdrop-blur-md"
        slotClasses={{
          list: 'flex items-center gap-1',
          item: 'inline-flex items-center',
          link: 'text-white/80 hover:text-white transition-colors',
          currentPage: 'font-semibold text-white',
          separator: 'mx-2 text-white/40'
        }}
      >
        {#snippet separator()}
          <svg
            class="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        {/snippet}
      </Breadcrumb>
    </CodeExample>

    <CodeExample
      title="Terminal Path"
      description="Monospace terminal-style breadcrumb for developer tools."
      isolate
      previewClass="rounded-xl bg-neutral-950 px-6 py-4"
    >
      <Breadcrumb
        unstyled
        items={[
          { label: '~', href: '/' },
          { label: 'workspace', href: '/workspace' },
          { label: 'ui', href: '/workspace/ui' },
          { label: 'src' }
        ]}
        class="flex items-center font-mono text-sm"
        slotClasses={{
          list: 'flex items-center',
          item: 'inline-flex items-center',
          link: 'text-emerald-400 hover:text-emerald-300 transition-colors',
          currentPage: 'font-bold text-amber-400',
          separator: 'mx-1 text-neutral-600'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Drop all defaults for a bordered, uppercase navigation."
      isolate
    >
      <Breadcrumb
        unstyled
        items={docsItems}
        class="text-text-primary flex items-center rounded-lg border-2 border-current px-4 py-2"
        slotClasses={{
          list: 'flex items-center gap-1',
          item: 'inline-flex items-center',
          link: 'text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors',
          currentPage: 'text-xs font-bold uppercase tracking-widest text-primary',
          separator: 'mx-2 text-border-default text-xs'
        }}
      >
        {#snippet separator()}
          <span>/</span>
        {/snippet}
      </Breadcrumb>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Renders as a <code class="text-text-primary">&lt;nav&gt;</code> with
          <code class="text-text-primary">aria-label="Breadcrumb"</code> (customizable via prop).
          The last item carries
          <code class="text-text-primary">aria-current="page"</code> to announce the current page.
          Individual items support
          <code class="text-text-primary">aria-label</code> for accessible name overrides (e.g. icon-only
          items).
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          All breadcrumb links are standard
          <code class="text-text-primary">&lt;a&gt;</code> elements, fully focusable via
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >. Focus indicators use
          <code class="text-text-primary">focus-visible:</code> to only show on keyboard navigation.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Semantic Markup</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Uses an ordered list (<code class="text-text-primary">&lt;ol&gt;</code>) inside the
          <code class="text-text-primary">&lt;nav&gt;</code> landmark, following the
          <a
            href="https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/"
            class="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            WAI-ARIA Breadcrumb pattern</a
          >. Separators are marked
          <code class="text-text-primary">aria-hidden="true"</code> to avoid screen reader clutter.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Hover transitions on links respect
          <code class="text-text-primary">prefers-reduced-motion</code> via the design-token-based transition
          duration.
        </p>
      </div>
    </div>
  </div>
</Section>
