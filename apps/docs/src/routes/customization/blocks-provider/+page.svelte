<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Separator } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'props', title: 'Props', order: 1 },
    { id: 'global-defaults', title: 'Global Defaults', order: 2 },
    { id: 'merge-behavior', title: 'Merge Behavior', order: 3 },
    { id: 'presets', title: 'Presets', order: 4 },
    { id: 'unstyled-mode', title: 'Unstyled Mode', order: 5 },
    { id: 'slot-names', title: 'Slot Names', order: 6 }
  ];

  const basicExample =
    `<scr` +
    `ipt>
  import { BlocksProvider } from '@urbicon-ui/blocks';
</scr` +
    `ipt>

<!-- Wrap your app layout -->
<BlocksProvider
  defaults={{
    Button: {
      slotClasses: {
        base: 'rounded-full font-bold uppercase tracking-wide'
      }
    },
    Card: {
      slotClasses: {
        base: 'rounded-3xl shadow-2xl'
      }
    }
  }}
>
  <slot />
</BlocksProvider>`;

  const unstyledExample =
    `<scr` +
    `ipt>
  import { BlocksProvider, Button, Card, Input } from '@urbicon-ui/blocks';
</scr` +
    `ipt>

<!-- Strip all default styles globally -->
<BlocksProvider unstyled>
  <!-- Components render only HTML structure -->
  <Button class="my-custom-btn">Click me</Button>
  <Card class="my-custom-card">Content</Card>
</BlocksProvider>`;

  const unstyledWithDefaultsExample =
    `<scr` +
    `ipt>
  import { BlocksProvider } from '@urbicon-ui/blocks';
</scr` +
    `ipt>

<!-- Unstyled + your own design system -->
<BlocksProvider
  unstyled
  defaults={{
    Button: {
      slotClasses: {
        base: 'inline-flex items-center gap-2 rounded-none border-2 border-current px-6 py-3 font-mono text-sm font-bold tracking-widest uppercase transition-all hover:bg-current/10',
        content: 'flex items-center gap-2'
      }
    },
    Card: {
      slotClasses: {
        base: 'border-2 border-current p-6 font-mono',
        header: 'border-b-2 border-current pb-4 mb-4 font-bold uppercase tracking-widest',
        content: 'space-y-2',
        footer: 'border-t-2 border-current pt-4 mt-4'
      }
    },
    Input: {
      slotClasses: {
        base: 'w-full border-2 border-current bg-transparent px-4 py-3 font-mono focus-visible:outline-none',
        label: 'font-mono text-xs uppercase tracking-widest mb-1'
      }
    }
  }}
>
  <slot />
</BlocksProvider>`;

  const overrideExample = `<!-- Global default: all Buttons get rounded-full -->
<BlocksProvider defaults={{ Button: { slotClasses: { base: 'rounded-full' } } }}>

  <!-- This button uses the global default (rounded-full) -->
  <Button>Default</Button>

  <!-- This button overrides with its own slotClasses -->
  <Button slotClasses={{ base: 'rounded-none' }}>Override</Button>

  <!-- class prop has highest priority -->
  <Button class="rounded-lg">Class Override</Button>

</BlocksProvider>`;

  const slotNamesExample = `// Each component documents its slot names.
// Check the component's Props type for the slotClasses type:

// Button: 'base' | 'content' | 'spinner'
// Card: 'base' | 'header' | 'content' | 'footer'
// Input: 'wrapper' | 'container' | 'base' | 'label' | 'message' | 'iconContainer'
// Accordion: 'base'
// AccordionItem: 'item' | 'trigger' | 'chevron' | 'content' | 'contentInner'
// Dialog: 'backdrop' | 'panel' | 'content' | 'header' | 'body' | 'footer'
// Tab: 'base' | 'list' | 'indicator' | 'panel'
// ...and more. See each component's API reference.`;

  const apiProps = [
    {
      name: 'unstyled',
      type: 'boolean',
      default: 'false',
      desc: 'Strip all default styles from all child components. They render only their HTML structure.'
    },
    {
      name: 'defaults',
      type: 'Record<string, { slotClasses?: Record<string, string> }>',
      default: '{}',
      desc: 'Per-component default slotClasses. Keys are component names (e.g. "Button", "Card"). Values are merged with instance-level slotClasses.'
    },
    {
      name: 'presets',
      type: 'Record<string, Record<string, { slotClasses?: Record<string, string> }>>',
      default: '{}',
      desc: 'Named looks per component. Components opt-in via their preset="name" prop. Useful for distinct, reusable variants beyond the semantic intent palette.'
    },
    {
      name: 'children',
      type: 'Snippet',
      default: '-',
      desc: 'Child content (your app).'
    }
  ];

  const presetsExample =
    `<scr` +
    `ipt>
  import { BlocksProvider } from '@urbicon-ui/blocks';
</scr` +
    `ipt>

<BlocksProvider
  presets={{
    Card: {
      'round-icon-tile': {
        slotClasses: {
          base: 'rounded-2xl border-0 bg-primary-subtle hover:bg-primary-subtle/80 transition',
          content: 'flex items-center gap-3 p-4'
        }
      },
      'interactive-stat-card': {
        slotClasses: {
          base: 'rounded-xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg',
          content: 'p-5'
        }
      }
    },
    Spinner: {
      brand: {
        slotClasses: {
          base: 'text-primary'
        }
      }
    }
  }}
>
  <!-- Opt-in via the preset prop on any component -->
  <Card preset="round-icon-tile">
    <BuildingIcon /> 12 buildings
  </Card>

  <Card preset="interactive-stat-card" href="/revenue">
    <p class="text-text-tertiary text-xs">Revenue</p>
    <p class="text-2xl font-semibold">€42.1k</p>
  </Card>

  <Spinner preset="brand" />
</BlocksProvider>`;

  const presetsTypeExample = `// /packages/blocks/src/lib/provider/blocks-context.ts

export interface ComponentPreset {
  slotClasses?: Record<string, string>;
}

// Outer key  = component name (e.g. 'Card', 'Spinner', 'Button')
// Inner key  = preset name (whatever the consumer types into preset="...")
export type PresetMap = Record<string, Record<string, ComponentPreset>>;`;
</script>

<SeoMeta
  title="BlocksProvider"
  description="BlocksProvider API for global unstyled mode and per-component default slotClasses in Urbicon UI."
/>

<DocsPageLayout
  title="BlocksProvider"
  description="A context provider that configures all descendant components. Set global defaults for slotClasses per component type, or switch all components to unstyled mode at once."
  {navigation}
  showToc
  breadcrumbs={[
    { label: 'Customization', href: resolve('/customization') },
    { label: 'BlocksProvider' }
  ]}
>
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="props">Props</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-border-subtle border-b">
            <th class="text-text-primary py-3 pr-4 font-semibold">Prop</th>
            <th class="text-text-primary py-3 pr-4 font-semibold">Type</th>
            <th class="text-text-primary py-3 pr-4 font-semibold">Default</th>
            <th class="text-text-primary py-3 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {#each apiProps as prop (prop.name)}
            <tr class="border-border-subtle border-b">
              <td class="py-3 pr-4"
                ><code class="text-primary text-xs font-medium">{prop.name}</code></td
              >
              <td class="py-3 pr-4"><code class="text-text-tertiary text-xs">{prop.type}</code></td>
              <td class="py-3 pr-4"
                ><code class="text-text-tertiary text-xs">{prop.default}</code></td
              >
              <td class="text-text-secondary py-3 text-xs">{prop.desc}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <Separator class="mb-12" />

  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="global-defaults">
      Global Component Defaults
    </h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Pass per-component
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code>
      via the <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">defaults</code> prop.
      Every instance of that component type inherits the classes. Instance-level slotClasses are merged
      on top (both class lists apply).
    </p>
    <CodeExample title="Setting global defaults" code={basicExample} preview={false} />
  </section>

  <Separator class="mb-12" />

  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="merge-behavior">Merge Behavior</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Global defaults and instance overrides are concatenated (not replaced). This means both class
      lists apply. Tailwind resolves conflicts based on CSS source order.
    </p>
    <CodeExample title="Override behavior" code={overrideExample} preview={false} />
    <div
      class="bg-surface-subtle text-text-secondary rounded-contain mt-4 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-text-primary">Priority (lowest to highest):</strong>
      <ol class="mt-2 list-inside list-decimal space-y-1">
        <li>
          <code class="text-xs">tv()</code> variant styles (library default)
        </li>
        <li>
          <code class="text-xs">BlocksProvider defaults.slotClasses</code>
        </li>
        <li>
          Instance <code class="text-xs">slotClasses</code> prop
        </li>
        <li>
          Instance <code class="text-xs">class</code> prop
        </li>
      </ol>
    </div>
  </section>

  <Separator class="mb-12" />

  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="presets">Presets</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">defaults</code>
      apply globally to <em>every</em> instance. Presets are different: register named looks once,
      then opt-in per component via the
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">preset="name"</code>
      prop. Use this when the requested look falls outside the semantic intent palette but should stay
      reusable across the project — round-icon tiles, interactive stat cards, brand spinners, compact
      toolbars, etc.
    </p>

    <div
      class="bg-surface-subtle text-text-secondary rounded-contain mb-6 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-text-primary">Why presets over <code class="text-xs">class</code>?</strong
      >
      <ul class="mt-2 list-inside list-disc space-y-1">
        <li>Reusable — define once, opt-in everywhere with a short name.</li>
        <li>
          Maintains slot-level control — hover/focus/dark-mode logic stays inside the
          <code class="text-xs">slotClasses</code> map, not scattered across instance class strings.
        </li>
        <li>
          Compose with intent — a card with <code class="text-xs">preset="stat-card"</code> still
          honors <code class="text-xs">intent</code>, <code class="text-xs">size</code>, etc.
        </li>
      </ul>
    </div>

    <CodeExample
      title="Three curated presets"
      description="Round-Icon-Tile (sub-cards in a dashboard), Interactive-Stat-Card (KPI link tiles with hover-lift), and Brand-Spinner (uses the project's primary color)."
      code={presetsExample}
      preview={false}
    />

    <p class="text-text-secondary mt-6 mb-3 leading-relaxed">
      The full type definition for <code class="text-xs">PresetMap</code>:
    </p>
    <CodeExample
      title="PresetMap type"
      code={presetsTypeExample}
      language="typescript"
      preview={false}
    />

    <div
      class="border-info/30 bg-info-subtle text-text-secondary rounded-contain mt-6 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-info-emphasis">Missing presets warn in dev.</strong>
      If a component requests <code class="text-xs">preset="foo"</code> but no entry exists in
      <code class="text-xs">presets[ComponentName].foo</code>, the resolver logs a console warning
      (development only). The component falls back to its default look.
    </div>
  </section>

  <Separator class="mb-12" />

  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="unstyled-mode">
      Global Unstyled Mode
    </h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Set <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">unstyled</code> to strip
      all default styles from every component. They render their HTML structure but no visual styling.
      This is useful when building a completely custom design system on top of Urbicon UI components.
    </p>
    <CodeExample title="Unstyled mode" code={unstyledExample} preview={false} />
    <p class="text-text-secondary mt-6 leading-relaxed">
      Combine <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">unstyled</code>
      with
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">defaults</code> to build a
      complete custom design system:
    </p>
    <CodeExample
      title="Unstyled + custom defaults (Brutalist example)"
      code={unstyledWithDefaultsExample}
      preview={false}
    />
  </section>

  <Separator class="mb-12" />

  <section>
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="slot-names">Slot Names Reference</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Each component defines its own set of named slots. Use the API reference for each component to
      see its available slot names, or check the
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code> type in
      the Props interface.
    </p>
    <CodeExample
      title="Common slot names"
      code={slotNamesExample}
      language="typescript"
      preview={false}
    />
  </section>
</DocsPageLayout>
