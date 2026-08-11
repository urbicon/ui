<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import {
    Badge,
    BlocksProvider,
    BuildingIcon,
    Button,
    Card,
    Input,
    Separator
  } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { precedenceChain } from '$lib/customization-data';

  const description =
    'One context provider for app-wide styling: round every Card, register a named stat-card look, add a border only on variant="outlined", or strip all default styles and bring your own.';

  const navigation = [
    { id: 'global-defaults', title: 'Global Defaults' },
    { id: 'merge-behavior', title: 'Merge Behavior' },
    { id: 'presets', title: 'Presets' },
    { id: 'conditional-overrides', title: 'Conditional Defaults' },
    { id: 'unstyled-mode', title: 'Unstyled Mode' },
    { id: 'props', title: 'Props' },
    { id: 'slot-names', title: 'Slot Names' }
  ];

  const basicExample =
    `<!-- src/routes/+layout.svelte -->
<scr` +
    `ipt>
  import { BlocksProvider } from '@urbicon-ui/blocks';
  let { children } = $props();
</scr` +
    `ipt>

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
  {@render children()}
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

  // Hand-written on purpose: BlocksProvider lives in src/lib/provider/, which
  // docs-gen does not scan (it discovers primitives/ and components/), so
  // there is no generated api.ts for it. Source of truth for these four props:
  // packages/blocks/src/lib/provider/blocks-context.ts + BlocksProvider.svelte.
  const apiProps = [
    {
      name: 'unstyled',
      type: 'boolean',
      default: 'false',
      desc: 'Strip all default styles from all child components. They render only their HTML structure.'
    },
    {
      name: 'defaults',
      type: 'Record<string, ComponentDefaults>',
      default: '{}',
      desc: 'Per-component defaults. slotClasses apply to every instance; overrides are prop-conditional rules (e.g. only variant="outlined"). Keys are component names (e.g. "Button", "Card").'
    },
    {
      name: 'presets',
      type: 'PresetMap',
      default: '{}',
      desc: 'Named looks per component, opt-in via the preset="name" prop. Each preset may carry its own conditional overrides.'
    },
    {
      name: 'children',
      type: 'Snippet',
      default: '-',
      desc: 'Child content (your app).'
    }
  ];

  const presetsTypeExample = `// packages/blocks/src/lib/provider/blocks-context.ts

export interface ConditionalOverride {
  class: Record<string, string>;            // slot → classes
  [propCondition: string]: string | string[] | Record<string, string> | undefined;
}

export interface ComponentDefaults {
  slotClasses?: Record<string, string>;     // unconditional
  overrides?: ConditionalOverride[];        // prop-conditional
}

export interface ComponentPreset {
  slotClasses?: Record<string, string>;     // unconditional
  overrides?: ConditionalOverride[];        // prop-conditional
}

// Outer key  = component name (e.g. 'Card', 'Spinner', 'Button')
// Inner key  = preset name (whatever the consumer types into preset="...")
export type PresetMap = Record<string, Record<string, ComponentPreset>>;`;

  const slotNamesExample = `// Two examples; every component's API reference documents its own
// slot map on the slotClasses prop (derived from its tv() config).

// Card
slotClasses?: { base?: string; header?: string; content?: string; footer?: string }

// Input — the root slot is \`wrapper\`, the real <input> is \`base\`
slotClasses?: {
  wrapper?: string; container?: string; base?: string;
  label?: string; message?: string; /* … icon slots */
}`;
</script>

<SeoMeta title="BlocksProvider" {description} />

<DocsPageLayout
  title="BlocksProvider"
  {description}
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
>
  <Section id="global-defaults" title="Global Component Defaults" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      The provider is optional: components carry their full default look without it. Wrap your app
      once to change that look globally, passing per-component
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code>
      via the <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">defaults</code>
      prop. Keys are the exported component names, case-sensitive; an unmatched key is ignored without
      a warning (one exception: ConfirmDialog registers under the
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">Dialog</code> key).
    </p>
    <CodeExample title="Setting global defaults" code={basicExample} preview={false} />
  </Section>

  <Separator class="mb-12" />

  <Section id="merge-behavior" title="Merge Behavior" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Defaults, presets and instance
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code> are
      merged per slot, each source stripping the earlier ones' conflicting Tailwind utilities, so
      the later source wins and non-conflicting classes accumulate. That merged string and the
      instance <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">class</code>
      prop then reach the component's <code class="text-xs">tv()</code> slot together, where they
      strip the library's own conflicting defaults. So
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">class</code> does beat
      the library, but it is not resolved against
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code>: write
      the same utility into both and stylesheet order decides. Override a conflicting utility with
      <code class="text-xs">slotClasses</code>; add one with <code class="text-xs">class</code>. All
      three buttons below live inside one provider that defaults Button to
      <code class="text-xs">rounded-none</code>:
    </p>
    <CodeExample title="Override behavior" isolate>
      <BlocksProvider defaults={{ Button: { slotClasses: { base: 'rounded-none' } } }}>
        <Button>Default (square)</Button>
        <Button slotClasses={{ base: 'rounded-full' }}>slotClasses wins the conflict</Button>
        <Button class="tracking-widest uppercase">class adds utilities</Button>
      </BlocksProvider>
    </CodeExample>
    <p class="text-text-secondary mt-4 text-sm leading-relaxed">
      The live snippets on this page show markup only. Each needs the components it renders imported
      alongside the provider, e.g.
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-xs"
        >import &#123; BlocksProvider, Button &#125; from '@urbicon-ui/blocks';</code
      >.
    </p>
    <div
      class="bg-surface-subtle text-text-secondary rounded-contain mt-4 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-text-primary">Priority (lowest to highest):</strong>
      <ol class="mt-2 list-outside list-decimal space-y-1 pl-5">
        {#each precedenceChain as step (step)}
          <li><code class="text-xs">{step}</code></li>
        {/each}
      </ol>
    </div>
  </Section>

  <Separator class="mb-12" />

  <Section id="presets" title="Presets" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">defaults</code>
      apply globally to <em>every</em> instance. Presets are different: register named looks once,
      then opt-in per component via the
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">preset="name"</code>
      prop, for looks that fall outside the semantic intent palette but should stay reusable across the
      project. An unregistered preset name warns in the browser console in dev and falls through to the
      provider defaults.
    </p>

    <div
      class="bg-surface-subtle text-text-secondary rounded-contain mb-6 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-text-primary">Why presets over <code class="text-xs">class</code>?</strong
      >
      <ul class="mt-2 list-outside list-disc space-y-1 pl-5">
        <li>Reusable: define once, opt-in everywhere with a short name.</li>
        <li>
          Maintains slot-level control: hover/focus/dark-mode logic stays inside the
          <code class="text-xs">slotClasses</code> map, not scattered across instance class strings.
        </li>
        <li>
          Composes with intent: a card with <code class="text-xs">preset="stat-tile"</code> still
          honors <code class="text-xs">intent</code>, <code class="text-xs">size</code>, etc.
        </li>
      </ul>
    </div>

    <CodeExample
      title="Two curated presets"
      description="Round-Icon-Tile (sub-cards in a dashboard) and Stat-Tile (compact KPI tiles)."
      isolate
      previewClass="flex flex-wrap items-center gap-4"
    >
      <BlocksProvider
        presets={{
          Card: {
            'round-icon-tile': {
              slotClasses: {
                base: 'rounded-2xl border-0 bg-primary-subtle',
                content: 'flex items-center gap-3 p-4'
              }
            },
            'stat-tile': {
              slotClasses: {
                base: 'rounded-xl shadow-sm',
                content: 'p-5'
              }
            }
          }
        }}
      >
        <Card preset="round-icon-tile" padding="none">
          <div class="text-primary">
            <BuildingIcon size={20} />
          </div>
          <span class="text-text-primary text-sm font-medium">12 buildings</span>
        </Card>

        <Card preset="stat-tile" padding="none">
          <p class="text-text-tertiary text-xs">Revenue</p>
          <p class="text-text-primary text-2xl font-semibold">€42.1k</p>
        </Card>
      </BlocksProvider>
    </CodeExample>

    <p class="text-text-secondary mt-6 mb-3 leading-relaxed">The full type definitions:</p>
    <CodeExample
      title="ComponentDefaults and PresetMap"
      code={presetsTypeExample}
      language="typescript"
      preview={false}
    />
  </Section>

  <Separator class="mb-12" />

  <Section id="conditional-overrides" title="Conditional Defaults (overrides)" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code>
      apply to <em>every</em> instance regardless of variant. When a rule must target a specific
      variant / intent / state, e.g. a 1px border only on the
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">outlined</code>
      variant, use
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">overrides</code>. Each
      entry is a <code class="text-xs">compoundVariant</code>-shaped matcher (prop conditions →
      per-slot classes); on a match its classes join the cascade, where the
      <code class="text-xs">tv()</code> conflict resolver strips the library's conflicting class
      (here the outlined variant's <code class="text-xs">border-2</code>).
    </p>

    <CodeExample
      title="Style only the outlined variant"
      description="Entries match active prop values, so it is irrelevant whether the library defines border-2 in a variant or a compoundVariant. string = equals, string[] = one-of; multiple matches merge additively."
      isolate
    >
      <BlocksProvider
        defaults={{
          Badge: {
            slotClasses: { base: 'tracking-wide' },
            overrides: [{ variant: 'outlined', class: { base: 'border' } }]
          }
        }}
      >
        <Badge variant="outlined">1px border</Badge>
        <Badge variant="filled">untouched</Badge>
      </BlocksProvider>
    </CodeExample>

    <p class="text-text-secondary mt-6 leading-relaxed">
      When to reach for which of the three: the
      <a href={resolve('/customization')} class="text-primary hover:underline"
        >Customization hub's decision table</a
      > settles it in one look.
    </p>
  </Section>

  <Separator class="mb-12" />

  <Section id="unstyled-mode" title="Global Unstyled Mode" class="mb-12">
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
      complete custom design system. Everything below renders live with every library default stripped;
      the brutalist look is carried by the two slotClasses maps:
    </p>
    <CodeExample
      title="Unstyled + custom defaults (Brutalist example)"
      isolate
      previewClass="text-text-primary w-full max-w-md space-y-6"
    >
      <BlocksProvider
        unstyled
        defaults={{
          Button: {
            slotClasses: {
              base: 'inline-flex items-center gap-2 rounded-none border-2 border-current px-6 py-3 font-mono text-sm font-bold tracking-widest uppercase transition-colors hover:bg-current/10',
              content: 'flex items-center gap-2'
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
        <Input label="Callsign" placeholder="ORBIT-7" />
        <Button>Transmit</Button>
      </BlocksProvider>
    </CodeExample>
  </Section>

  <Separator class="mb-12" />

  <Section id="props" title="Props" class="mb-12">
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
  </Section>

  <Separator class="mb-12" />

  <Section id="slot-names" title="Slot Names Reference">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Each component defines its own set of named slots: the keys
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code>
      accepts. The authoritative slot map lives in each component's API reference, on the
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code> prop
      row (generated from the component's <code class="text-xs">tv()</code> config, so it cannot go
      stale), and your editor autocompletes the same keys. For example:
      <a href={resolve('/blocks/primitives/card')} class="text-primary hover:underline">Card</a>,
      <a href={resolve('/blocks/primitives/input')} class="text-primary hover:underline">Input</a>.
    </p>
    <CodeExample
      title="Reading a slot map"
      code={slotNamesExample}
      language="typescript"
      preview={false}
    />
  </Section>
</DocsPageLayout>
