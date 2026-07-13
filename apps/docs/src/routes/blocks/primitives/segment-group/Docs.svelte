<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['size', 'tier', 'fullWidth', 'disabled', 'mint'],
        defaults: { size: 'md', tier: 'commit' },
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
    meta: { title: 'Segment Group Component', showToc: true }
  };

  let theme = $state('system');
  let period = $state('month');
  let pricing = $state('pro');
  let chartType = $state('line');
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Time-Range Selector"
      description="Compact range picker for charts and dashboards. Works well with 2 to 5 options — beyond that, consider a Menu or Tab."
      isolate
    >
      <SegmentGroup value="1h" ariaLabel="Time range">
        <SegmentItem value="1h">1H</SegmentItem>
        <SegmentItem value="6h">6H</SegmentItem>
        <SegmentItem value="1d">1D</SegmentItem>
        <SegmentItem value="1w">1W</SegmentItem>
        <SegmentItem value="1m">1M</SegmentItem>
      </SegmentGroup>
    </CodeExample>

    <CodeExample
      title="Per-Item Disabled"
      description="Disable individual segments while the rest of the group stays interactive. Keyboard navigation skips disabled items."
      isolate
    >
      <SegmentGroup value="a" ariaLabel="Partial disabled example">
        <SegmentItem value="a">Available</SegmentItem>
        <SegmentItem value="b" disabled>Unavailable</SegmentItem>
        <SegmentItem value="c">Available</SegmentItem>
      </SegmentGroup>
    </CodeExample>
  </div>
</Section>

<!-- ─── Micro-Interactions ─── -->

<Section marker="02" id="mints" title="Micro-Interactions">
  <div class="space-y-8">
    <CodeExample
      title="Configured Mint"
      description="The Playground toggles single mints — for richer effects, combine multiple mints in an array, or use the object form to fine-tune intensity and duration."
      isolate
    >
      <SegmentGroup
        value="pro"
        mint={[{ name: 'scale', config: { intensity: 1.03, duration: 200 } }, 'glow']}
        ariaLabel="Configured mint"
      >
        <SegmentItem value="free">Free</SegmentItem>
        <SegmentItem value="pro">Pro</SegmentItem>
        <SegmentItem value="enterprise">Enterprise</SegmentItem>
      </SegmentGroup>
    </CodeExample>
  </div>
</Section>

<!-- ─── Comparison ─── -->

<Section marker="03" id="comparison" title="Choosing the Right Component">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">SegmentGroup</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Compact mode/view switcher with animated sliding indicator. Best for 2-5 mutually
          exclusive options that don't control content panels. Minimal API, single neutral style.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">
          ButtonGroup
          <code class="text-text-tertiary font-normal">selection="single"</code>
        </h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Toolbar-style toggle with full button styling (variants, intents, connected borders).
          Choose this when you need visual customization, multi-select, or connected button layouts.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">RadioGroup</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Form input with labels, descriptions, helper/error text, and native
          <code class="text-text-primary">&lt;input type="radio"&gt;</code>. Choose this when
          collecting data in forms or when options need descriptions.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Tab</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Content panel navigation where each option reveals a different panel. Uses
          <code class="text-text-primary">role="tablist"</code> semantics. Choose this when switching
          between content sections, not selecting a value.
        </p>
      </div>
    </div>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="04" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Theme Switcher"
      description="Embedded in a settings panel with two-way binding."
      isolate
      previewClass="flex justify-center"
    >
      <div
        class="border-border-subtle bg-surface-elevated flex w-full max-w-sm items-center justify-between rounded-2xl border p-4"
      >
        <span class="text-text-primary text-sm font-medium">Appearance</span>
        <SegmentGroup bind:value={theme} size="sm" mint="scale" ariaLabel="Theme preference">
          <SegmentItem value="light">Light</SegmentItem>
          <SegmentItem value="dark">Dark</SegmentItem>
          <SegmentItem value="system">System</SegmentItem>
        </SegmentGroup>
      </div>
    </CodeExample>

    <CodeExample
      title="Dashboard Toolbar"
      description="Full-width segment in a toolbar layout."
      isolate
    >
      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-text-primary text-base font-semibold">Analytics</h3>
          <span class="text-text-tertiary text-xs">Last updated: just now</span>
        </div>
        <SegmentGroup
          bind:value={period}
          fullWidth
          mint={['scale', 'glow']}
          ariaLabel="Analytics period"
        >
          <SegmentItem value="day">Day</SegmentItem>
          <SegmentItem value="week">Week</SegmentItem>
          <SegmentItem value="month">Month</SegmentItem>
          <SegmentItem value="year">Year</SegmentItem>
        </SegmentGroup>
      </div>
    </CodeExample>

    <CodeExample
      title="Gradient Pricing Toggle"
      description="slotClasses transforms the neutral control into a branded pricing switcher."
      isolate
      previewClass="flex justify-center"
    >
      <SegmentGroup
        bind:value={pricing}
        mint={['scale', 'glow']}
        slotClasses={{
          base: 'bg-linear-to-r from-violet-500/15 to-fuchsia-500/15 border border-violet-500/20',
          indicator: 'bg-linear-to-r from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/30',
          item: 'text-violet-300 data-[state=active]:text-white'
        }}
        ariaLabel="Pricing tier"
      >
        <SegmentItem value="free">Free</SegmentItem>
        <SegmentItem value="pro">Pro</SegmentItem>
        <SegmentItem value="enterprise">Enterprise</SegmentItem>
      </SegmentGroup>
    </CodeExample>

    <CodeExample
      title="Neon Chart Switcher"
      description="Dark-themed control with neon glow – all via slotClasses, no unstyled needed."
      isolate
      previewClass="flex justify-center rounded-xl bg-neutral-950 px-8 py-6"
    >
      <SegmentGroup
        bind:value={chartType}
        mint="scale"
        slotClasses={{
          base: 'bg-neutral-900 border border-emerald-500/20',
          indicator:
            'bg-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.25)] border border-emerald-400/40',
          item: 'text-neutral-500 data-[state=active]:text-emerald-400'
        }}
        ariaLabel="Chart type"
      >
        <SegmentItem value="line">Line</SegmentItem>
        <SegmentItem value="bar">Bar</SegmentItem>
        <SegmentItem value="area">Area</SegmentItem>
      </SegmentGroup>
    </CodeExample>

    <CodeExample
      title="Glassmorphism"
      description="Frosted glass effect with backdrop-blur on a vibrant background."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-sky-400 via-indigo-500 to-purple-600 px-8 py-8"
    >
      <SegmentGroup
        value="overview"
        mint="scale"
        slotClasses={{
          base: 'bg-white/10 backdrop-blur-md border border-white/20 shadow-lg',
          indicator: 'bg-white/25 backdrop-blur-sm shadow-lg',
          item: 'text-white/60 data-[state=active]:text-white'
        }}
        ariaLabel="Glass navigation"
      >
        <SegmentItem value="overview">Overview</SegmentItem>
        <SegmentItem value="details">Details</SegmentItem>
        <SegmentItem value="history">History</SegmentItem>
      </SegmentGroup>
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Drop all default styles. The sliding indicator, keyboard nav, and mint still work."
      isolate
      previewClass="flex flex-col items-center gap-6"
    >
      <SegmentGroup
        value="bold"
        unstyled
        mint="scale"
        class="inline-flex gap-1 rounded-2xl bg-linear-to-br from-amber-200 to-orange-400 p-1.5 shadow-xl"
        slotClasses={{
          indicator: 'rounded-xl bg-white/80 shadow-md',
          item: 'relative z-10 rounded-xl px-5 py-2 text-sm font-bold text-orange-950/80 transition-colors data-[state=active]:text-orange-900'
        }}
        ariaLabel="Unstyled warm"
      >
        <SegmentItem value="bold">Bold</SegmentItem>
        <SegmentItem value="vibrant">Vibrant</SegmentItem>
        <SegmentItem value="muted">Muted</SegmentItem>
      </SegmentGroup>
      <SegmentGroup
        value="deploy"
        unstyled
        class="inline-flex gap-0 border-2 border-current p-0 font-mono text-sm"
        slotClasses={{
          indicator: 'bg-text-primary',
          item: 'text-text-primary relative z-10 border-r border-current px-5 py-2.5 font-bold tracking-widest uppercase transition-colors last:border-r-0 data-[state=active]:text-surface-base'
        }}
        ariaLabel="Unstyled brutalist"
      >
        <SegmentItem value="staging">Staging</SegmentItem>
        <SegmentItem value="deploy">Deploy</SegmentItem>
        <SegmentItem value="rollback">Rollback</SegmentItem>
      </SegmentGroup>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="05" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The container uses <code class="text-text-primary">role="radiogroup"</code> with each item
          as <code class="text-text-primary">role="radio"</code> +
          <code class="text-text-primary">aria-checked</code>. Provide
          <code class="text-text-primary">ariaLabel</code> to describe the group's purpose.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Arrow</kbd
          >
          keys move between options and select immediately.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Home</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >End</kbd
          >
          jump to first/last option. Only the active item is in the tab order (roving tabindex).
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Visual States</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Active items expose
          <code class="text-text-primary">data-state="active"</code> for CSS-only styling in
          <code class="text-text-primary">unstyled</code> mode. The sliding indicator uses
          <code class="text-text-primary">aria-hidden="true"</code> since it is purely decorative.
          Focus rings use
          <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
        </p>
      </div>
    </div>
  </div>
</Section>
