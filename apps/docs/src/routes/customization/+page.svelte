<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Card, Separator } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'themes', title: 'CSS Token Themes', order: 1 },
    { id: 'defaults', title: 'Global Defaults', order: 2 },
    { id: 'unstyled', title: 'Unstyled Mode', order: 3 },
    { id: 'deep-dives', title: 'Deep Dives', order: 4 }
  ];

  const quickThemeExample = `/* app.css */
@import '@urbicon-ui/blocks/style/index.css';
@import '@urbicon-ui/blocks/style/themes/ocean.css';`;

  const customThemeExample = `/* app.css */
@import '@urbicon-ui/blocks/style/index.css';

@theme {
  /* Primary – green brand color */
  --color-primary-50: oklch(0.95 0.03 155);
  --color-primary-500: oklch(0.58 0.13 155);
  --color-primary-600: oklch(0.5 0.13 155);
  /* ... all shades 50-950 ... */

  /* Secondary – amber accent */
  --color-secondary-50: oklch(0.95 0.02 90);
  --color-secondary-500: oklch(0.55 0.08 90);
  --color-secondary-600: oklch(0.48 0.08 90);
  /* ... all shades 50-950 ... */
}`;

  const blocksProviderExample =
    `<scr` +
    `ipt>
  import { BlocksProvider } from '@urbicon-ui/blocks';
</scr` +
    `ipt>

<BlocksProvider
  defaults={{
    Button: {
      slotClasses: { base: 'rounded-full font-bold uppercase tracking-wide' }
    },
    Card: {
      slotClasses: { base: 'rounded-3xl' }
    },
    Input: {
      slotClasses: { base: 'rounded-full' }
    }
  }}
>
  <slot />
</BlocksProvider>`;

  const unstyledExample =
    `<scr` +
    `ipt>
  import { BlocksProvider } from '@urbicon-ui/blocks';
</scr` +
    `ipt>

<BlocksProvider unstyled>
  <!-- All components render without default styles -->
  <slot />
</BlocksProvider>`;
</script>

<SeoMeta
  title="Customization"
  description="Customize Urbicon UI with CSS token themes, BlocksProvider, and per-component defaults."
/>

<DocsPageLayout
  title="Customization"
  description="Urbicon UI offers three levels of customization, from simple color changes to fully custom designs. Pick the level that fits your needs."
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Customization' }]}
>
  <div class="mb-12 grid gap-6 sm:grid-cols-3">
    <Card class="border-border-subtle">
      <div class="p-5">
        <div class="text-primary mb-2 text-2xl font-bold">1</div>
        <h3 class="text-text-primary mb-1 font-semibold">CSS Token Themes</h3>
        <p class="text-text-tertiary text-sm">
          Swap the color palette with a single CSS import. All components update automatically.
        </p>
      </div>
    </Card>
    <Card class="border-border-subtle">
      <div class="p-5">
        <div class="text-primary mb-2 text-2xl font-bold">2</div>
        <h3 class="text-text-primary mb-1 font-semibold">Global Defaults</h3>
        <p class="text-text-tertiary text-sm">
          Override slot classes per component type via BlocksProvider. Every Button, Card, Input
          picks up your defaults.
        </p>
      </div>
    </Card>
    <Card class="border-border-subtle">
      <div class="p-5">
        <div class="text-primary mb-2 text-2xl font-bold">3</div>
        <h3 class="text-text-primary mb-1 font-semibold">Fully Unstyled</h3>
        <p class="text-text-tertiary text-sm">
          Strip all default styles globally and build your own design from scratch using
          slotClasses.
        </p>
      </div>
    </Card>
  </div>

  <Separator class="mb-12" />

  <!-- Level 1: CSS Themes -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="themes">CSS Token Themes</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      The simplest way to brand the library. Import a theme CSS file after the base styles to
      override the primary and secondary accents plus the neutral chassis. The semantic layer
      (surface, text, border tokens) derives from that chassis, so each theme re-tints it to match
      the accent's temperature — warm accents get warm surfaces, not cold grey ones.
    </p>
    <CodeExample
      title="Use a built-in theme"
      code={quickThemeExample}
      language="css"
      preview={false}
    />
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div class="rounded-contain border p-3 text-center">
        <div
          class="mx-auto mb-2 h-6 w-6 rounded-full"
          style="background: oklch(0.52 0.14 220)"
        ></div>
        <span class="text-text-tertiary text-xs">Ocean</span>
      </div>
      <div class="rounded-contain border p-3 text-center">
        <div
          class="mx-auto mb-2 h-6 w-6 rounded-full"
          style="background: oklch(0.5 0.13 155)"
        ></div>
        <span class="text-text-tertiary text-xs">Forest</span>
      </div>
      <div class="rounded-contain border p-3 text-center">
        <div
          class="mx-auto mb-2 h-6 w-6 rounded-full"
          style="background: oklch(0.55 0.15 55)"
        ></div>
        <span class="text-text-tertiary text-xs">Sunset</span>
      </div>
      <div class="rounded-contain border p-3 text-center">
        <div
          class="mx-auto mb-2 h-6 w-6 rounded-full"
          style="background: oklch(0.53 0.15 350)"
        ></div>
        <span class="text-text-tertiary text-xs">Rose</span>
      </div>
      <div class="rounded-contain border p-3 text-center">
        <div
          class="mx-auto mb-2 h-6 w-6 rounded-full"
          style="background: oklch(0.43 0.012 240)"
        ></div>
        <span class="text-text-tertiary text-xs">Neutral</span>
      </div>
    </div>
    <p class="text-text-secondary mt-6 leading-relaxed">
      You can also create your own theme. Use the
      <a href={resolve('/customization/theme-builder')} class="text-primary hover:underline"
        >Theme Builder</a
      >
      to generate an OKLCH palette, or write a custom
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">@theme</code> block:
    </p>
    <CodeExample
      title="Custom @theme block"
      code={customThemeExample}
      language="css"
      preview={false}
    />
  </section>

  <Separator class="mb-12" />

  <!-- Level 2: BlocksProvider defaults -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="defaults">
      Global Component Defaults
    </h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      When CSS token overrides are not enough, use
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">BlocksProvider</code>
      to set default
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code>
      for every component type. Wrap your app once, and every Button, Card, Input etc. picks up the defaults.
      Instance-level
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code>
      still override the global ones.
    </p>
    <CodeExample
      title="Global defaults via BlocksProvider"
      code={blocksProviderExample}
      preview={false}
    />
    <div
      class="bg-surface-subtle text-text-secondary rounded-contain mt-4 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-text-primary">Merge order (lowest to highest priority):</strong>
      <ol class="mt-2 list-inside list-decimal space-y-1">
        <li>
          <code class="text-xs">tv()</code> base + variant styles (library default)
        </li>
        <li>
          <code class="text-xs">BlocksProvider defaults</code> slotClasses
        </li>
        <li>
          Instance <code class="text-xs">slotClasses</code> prop
        </li>
        <li>
          Instance <code class="text-xs">class</code> prop (highest priority)
        </li>
      </ol>
    </div>
  </section>

  <Separator class="mb-12" />

  <!-- Level 3: Fully unstyled -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="unstyled">Global Unstyled Mode</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      For a completely custom design, set <code
        class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">unstyled</code
      >
      on BlocksProvider. All components strip their default styles and only render the HTML structure.
      Use
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">slotClasses</code> (globally
      via defaults or per instance) to apply your own design.
    </p>
    <CodeExample title="Global unstyled mode" code={unstyledExample} preview={false} />
  </section>

  <Separator class="mb-12" />

  <!-- Quick links -->
  <section>
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="deep-dives">Deep Dives</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <Card
        href={resolve('/customization/themes')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">CSS Token Themes</h3>
          <p class="text-text-tertiary text-sm">
            All built-in themes with live preview and usage instructions.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/blocks-provider')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">BlocksProvider API</h3>
          <p class="text-text-tertiary text-sm">
            Global unstyled mode, component defaults, and merge behavior.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/theme-builder')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Theme Builder</h3>
          <p class="text-text-tertiary text-sm">
            Interactive OKLCH color palette generator with live preview.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/tokens')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Design Tokens</h3>
          <p class="text-text-tertiary text-sm">
            Foundation, semantic, and interaction token reference.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/tier-system')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Tier System</h3>
          <p class="text-text-tertiary text-sm">
            The three-tier semantic radius vocabulary — commit / modify / contain — with cascade and
            override demos.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/editorial-theme')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Editorial Theme</h3>
          <p class="text-text-tertiary text-sm">
            How this docs site is themed — the <code>--docs-*</code> token catalogue, light/dark via
            <code>light-dark()</code>, activation and override recipes.
          </p>
        </div>
      </Card>
    </div>
  </section>
</DocsPageLayout>
