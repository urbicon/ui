<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Badge, Card } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'architecture', title: 'Token Architecture', order: 1 },
    { id: 'colors', title: 'Color System', order: 2 },
    { id: 'spacing', title: 'Spacing', order: 3 },
    { id: 'typography', title: 'Typography', order: 4 },
    { id: 'radius', title: 'Border Radius', order: 5 },
    { id: 'custom-theming', title: 'Custom Theming', order: 6 },
    { id: 'dark-mode', title: 'Dark Mode', order: 7 }
  ];

  const colorTokenExample = `@theme {
  /* Foundation Colors (oklch for better perception) */
  --color-neutral-50: oklch(0.98 0.005 240);
  --color-neutral-500: oklch(0.55 0.016 240);
  --color-neutral-900: oklch(0.15 0.012 240);
  
  --color-primary-500: oklch(0.58 0.15 240);
  --color-success-500: oklch(0.65 0.15 140);
  --color-danger-500: oklch(0.65 0.18 25);
}`;

  const semanticTokenExample = `/* Semantic Layer – maps foundation to roles */
--color-surface-base: var(--color-neutral-0);
--color-text-primary: var(--color-neutral-900);
--color-primary: var(--color-primary-600);

/* Interactive States */
--color-interactive-hover: var(--color-neutral-100);
--color-border-focus: var(--color-primary-500);`;

  const componentTokenExample = `/* Interaction Layer – motion & focus */
--blocks-duration-fast: 150ms;
--blocks-duration-normal: 250ms;
--blocks-ease-confident: cubic-bezier(0.4, 0, 0.2, 1);

--blocks-shadow-sm: 0 1px 2px var(--color-shadow-xs);
--blocks-shadow-md: 0 4px 6px var(--color-shadow-sm);`;

  const customThemeExample = `@import '@urbicon-ui/blocks';

@theme {
  /* Override primary color */
  --color-primary-500: oklch(0.6 0.2 280); /* Purple */
  
  /* Add custom brand colors */
  --color-brand-500: oklch(0.5 0.25 45); /* Orange */
  --color-accent-500: oklch(0.7 0.3 320); /* Pink */
}

/* Use in your components */
.my-custom-button {
  background: var(--color-brand-500);
  color: white;
  border-radius: var(--radius-lg);
}`;

  const spacingTokens = [
    { name: '--blocks-space-0', value: '0', pixels: '0px' },
    { name: '--blocks-space-1', value: '0.25rem', pixels: '4px' },
    { name: '--blocks-space-2', value: '0.5rem', pixels: '8px' },
    { name: '--blocks-space-3', value: '0.75rem', pixels: '12px' },
    { name: '--blocks-space-4', value: '1rem', pixels: '16px' },
    { name: '--blocks-space-6', value: '1.5rem', pixels: '24px' },
    { name: '--blocks-space-8', value: '2rem', pixels: '32px' },
    { name: '--blocks-space-12', value: '3rem', pixels: '48px' }
  ];

  const typographyTokens = [
    { name: '--blocks-font-size-xs', value: '0.75rem', pixels: '12px' },
    { name: '--blocks-font-size-sm', value: '0.875rem', pixels: '14px' },
    { name: '--blocks-font-size-base', value: '1rem', pixels: '16px' },
    { name: '--blocks-font-size-lg', value: '1.125rem', pixels: '18px' },
    { name: '--blocks-font-size-xl', value: '1.25rem', pixels: '20px' },
    { name: '--blocks-font-size-2xl', value: '1.5rem', pixels: '24px' }
  ];

  const radiusTokens = [
    { name: '--radius-xs', value: '0.125rem', utility: 'rounded-xs' },
    { name: '--radius-sm', value: '0.25rem', utility: 'rounded-sm' },
    { name: '--radius-md', value: '0.375rem', utility: 'rounded-md' },
    { name: '--radius-lg', value: '0.5rem', utility: 'rounded-lg' },
    { name: '--radius-xl', value: '0.75rem', utility: 'rounded-xl' },
    { name: '--radius-2xl', value: '1rem', utility: 'rounded-2xl' },
    { name: '--radius-3xl', value: '1.5rem', utility: 'rounded-3xl' },
    { name: '--radius-4xl', value: '2rem', utility: 'rounded-4xl' }
  ];
</script>

<SeoMeta
  title="Design Tokens"
  description="Comprehensive design token system for colors, typography, spacing, and more. Built with CSS custom properties and Tailwind 4."
/>

<DocsPageLayout
  title="Design Tokens"
  description="A comprehensive design token system built with CSS custom properties and Tailwind 4. Organized in semantic layers for consistent theming and easy customization."
  maxWidth="2xl"
  {navigation}
  showToc
  breadcrumbs={[
    { label: 'Customization', href: resolve('/customization') },
    { label: 'Design Tokens' }
  ]}
>
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="architecture">Token Architecture</h2>

    <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card padding="lg" class="text-center">
        <h3 class="text-text-primary mb-3 text-lg font-semibold">Foundation Layer</h3>
        <p class="text-text-secondary mb-4 text-sm">
          Base design decisions like colors, spacing, and typography scales.
        </p>
        <Badge variant="soft" intent="primary">Raw Values</Badge>
      </Card>

      <Card padding="lg" class="text-center">
        <h3 class="text-text-primary mb-3 text-lg font-semibold">Semantic Layer</h3>
        <p class="text-text-secondary mb-4 text-sm">
          Intent-based tokens that map foundation tokens to semantic meanings.
        </p>
        <Badge variant="soft" intent="success">Contextual</Badge>
      </Card>

      <Card padding="lg" class="text-center">
        <h3 class="text-text-primary mb-3 text-lg font-semibold">Interaction Layer</h3>
        <p class="text-text-secondary mb-4 text-sm">
          Motion, shadow, and focus tokens for consistent animations and depth.
        </p>
        <Badge variant="soft" intent="warning">Motion &amp; Depth</Badge>
      </Card>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <CodeExample
        title="Foundation Colors"
        code={colorTokenExample}
        language="css"
        preview={false}
      />
      <CodeExample
        title="Semantic Tokens"
        code={semanticTokenExample}
        language="css"
        preview={false}
      />
      <CodeExample
        title="Interaction Layer"
        code={componentTokenExample}
        language="css"
        preview={false}
      />
    </div>
  </section>

  <!-- Color System -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="colors">Color System</h2>

    <div class="mb-8">
      <h3 class="text-text-primary mb-4 text-lg font-semibold">Neutral Palette</h3>
      <div class="mb-4 grid grid-cols-12 gap-1">
        {#each [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade (shade)}
          <div class="border-border-subtle bg-surface-base rounded-modify border p-2 text-center">
            <div
              class="rounded-modify mb-1 h-8 w-full"
              style="background: var(--color-neutral-{shade})"
            ></div>
            <div class="text-text-tertiary font-mono text-xs">{shade}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {#each ['primary', 'success', 'warning', 'danger'] as color (color)}
        <div class="border-border-subtle bg-surface-base rounded-contain border p-4">
          <h4 class="text-text-primary mb-3 font-semibold capitalize">{color}</h4>
          <div class="space-y-2">
            {#each [50, 500, 900] as shade (shade)}
              <div class="flex items-center gap-3">
                <div
                  class="rounded-modify h-6 w-6"
                  style="background: var(--color-{color}-{shade})"
                ></div>
                <span class="text-text-secondary font-mono text-sm">--color-{color}-{shade}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Spacing Scale -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="spacing">Spacing Scale</h2>

    <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Pixels</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Visual</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each spacingTokens as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono">{token.name}</td>
                <td class="text-text-secondary px-4 py-3 font-mono">{token.value}</td>
                <td class="text-text-tertiary px-4 py-3">{token.pixels}</td>
                <td class="px-4 py-3">
                  <div
                    class="bg-primary-subtle rounded-modify h-4"
                    style="width: {token.value}"
                  ></div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Typography Scale -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="typography">Typography Scale</h2>

    <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Pixels</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Example</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each typographyTokens as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono">{token.name}</td>
                <td class="text-text-secondary px-4 py-3 font-mono">{token.value}</td>
                <td class="text-text-tertiary px-4 py-3">{token.pixels}</td>
                <td class="text-text-primary px-4 py-3">
                  <span style="font-size: {token.value}">The quick brown fox</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Border Radius -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="radius">Border Radius</h2>

    <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
      {#each radiusTokens as token (token.name)}
        <div class="text-center">
          <div class="bg-primary mx-auto mb-2 h-16 w-16" style="border-radius: {token.value}"></div>
          <div class="text-text-secondary font-mono text-xs">{token.utility}</div>
          <div class="text-text-tertiary text-xs">{token.value}</div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Custom Theming -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="custom-theming">Custom Theming</h2>

    <p class="text-text-secondary mb-6">
      Use Tailwind 4's
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">@theme</code>
      directive to customize design tokens and create your own brand theme.
    </p>

    <CodeExample
      title="Custom Theme Example"
      code={customThemeExample}
      language="css"
      preview={false}
    />

    <div class="bg-primary-subtle border-primary/20 mt-6 rounded-xl border p-6">
      <h3 class="text-primary-emphasis mb-3 font-semibold">Theming Best Practices</h3>
      <ul class="text-text-secondary space-y-2 text-sm">
        <li>Use semantic color names instead of specific color values</li>
        <li>Test your theme in both light and dark modes</li>
        <li>Ensure sufficient contrast ratios for accessibility</li>
        <li>Consider using OKLCH color space for better perceptual uniformity</li>
        <li>Keep your custom tokens organized and documented</li>
      </ul>
    </div>
  </section>

  <!-- Dark Mode -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="dark-mode">Dark Mode Support</h2>

    <p class="text-text-secondary mb-6">
      Design tokens automatically adapt to dark mode using
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">prefers-color-scheme</code>.
      No manual
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">dark:</code> overrides needed.
    </p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card padding="lg">
        <h3 class="text-text-primary mb-4 font-semibold">Light Mode Tokens</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="font-mono">--color-surface-base</span>
            <span class="bg-surface-subtle rounded-modify px-2 py-1 text-xs">neutral-0</span>
          </div>
          <div class="flex justify-between">
            <span class="font-mono">--color-text-primary</span>
            <span class="bg-surface-subtle rounded-modify px-2 py-1 text-xs">neutral-900</span>
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <h3 class="text-text-primary mb-4 font-semibold">Dark Mode Tokens</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="font-mono">--color-surface-base</span>
            <span class="bg-surface-inverted text-text-on-dark rounded-modify px-2 py-1 text-xs"
              >neutral-900</span
            >
          </div>
          <div class="flex justify-between">
            <span class="font-mono">--color-text-primary</span>
            <span class="bg-surface-inverted text-text-on-dark rounded-modify px-2 py-1 text-xs"
              >neutral-50</span
            >
          </div>
        </div>
      </Card>
    </div>
  </section>
</DocsPageLayout>
