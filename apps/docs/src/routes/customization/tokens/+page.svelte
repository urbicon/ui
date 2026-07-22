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
    { id: 'interaction', title: 'Motion & Depth', order: 6 },
    { id: 'custom-theming', title: 'Custom Theming', order: 7 },
    { id: 'dark-mode', title: 'Dark Mode', order: 8 }
  ];

  const colorTokenExample = `@theme {
  /* Foundation Colors (oklch for better perception) */
  --color-neutral-50: oklch(0.98 0.005 240);
  --color-neutral-500: oklch(0.55 0.016 240);
  --color-neutral-900: oklch(0.15 0.012 240);

  /* Intent 500s darkened so white text passes WCAG AA */
  --color-primary-500: oklch(0.58 0.15 240);
  --color-success-500: oklch(0.5 0.15 140);
  --color-danger-500: oklch(0.5 0.17 25);
}`;

  const semanticTokenExample = `/* Semantic Layer – maps foundation to
   roles; light-dark() resolves both modes */
--color-surface-base: light-dark(
  var(--color-neutral-0), var(--color-neutral-900));
--color-text-primary: light-dark(
  var(--color-neutral-900), var(--color-neutral-100));
--color-primary: light-dark(
  var(--color-primary-600), var(--color-primary-500));

/* Interactive states */
--color-interactive-hover:
  oklch(from var(--color-primary-500) l c h / 0.1);
--color-interactive-focus: light-dark(
  var(--color-primary-500), var(--color-primary-400));`;

  const componentTokenExample = `/* Interaction Layer – motion & depth */
--blocks-duration-fast: 150ms;
--blocks-duration-normal: 250ms;
--blocks-ease-gentle: cubic-bezier(0.25, 0.1, 0.25, 1);

--blocks-shadow-sm: var(--color-shadow-sm);
--blocks-shadow-md: var(--color-shadow-md);`;

  const customThemeExample = `@import '@urbicon-ui/blocks/style/index.css';

/* Option A — import a shipped theme
   (neutral, ocean, forest, rose, sunset) */
@import '@urbicon-ui/blocks/style/themes/ocean.css';

/* Option B — re-tint the ramps yourself. The semantic layer
   consumes several stops (600/500 base, 700/400 hover,
   800/300 active, 900/200 emphasis, 50/900 subtle), so
   override the WHOLE ramp: keep each stop's lightness and
   chroma, swap only the hue. */
@theme {
  --color-primary-500: oklch(0.58 0.15 280);
  --color-primary-600: oklch(0.52 0.15 280);
  --color-primary-700: oklch(0.44 0.13 280);
  /* … all stops 50–950 with the new hue */

  /* The chassis, NOT optional: surface/text/border derive
     from neutral, so a purple brand on the default cool
     240 chassis reads broken. Same L/C, hue → 290. */
  --color-neutral-50: oklch(0.98 0.005 290);
  --color-neutral-500: oklch(0.55 0.016 290);
  --color-neutral-900: oklch(0.15 0.012 290);
  /* … all 15 stops (25–950) with the new hue. Leave
     --color-neutral-0 (pure white) alone — tinting it
     tints your white. */
}

/* Raw partial values — :root, never @theme (see Motion & Depth). */
:root {
  --blocks-shadow-tint: 0.2 0.025 290;
  --neutral-chrome-hue: 290;
}

/* Custom brand tokens get Tailwind utilities for free
   (bg-brand-500, text-brand-500, …) */
@theme {
  --color-brand-500: oklch(0.5 0.25 45);
}`;

  // Spacing is NOT a custom token layer — Urbicon UI uses Tailwind's built-in
  // spacing scale directly (utilities like p-4, gap-2, m-6). Each step is
  // 0.25rem × n, driven by Tailwind's own `--spacing` variable.
  const spacingScale = [
    { utility: 'p-0 / gap-0', value: '0', pixels: '0px' },
    { utility: 'p-1 / gap-1', value: '0.25rem', pixels: '4px' },
    { utility: 'p-2 / gap-2', value: '0.5rem', pixels: '8px' },
    { utility: 'p-3 / gap-3', value: '0.75rem', pixels: '12px' },
    { utility: 'p-4 / gap-4', value: '1rem', pixels: '16px' },
    { utility: 'p-6 / gap-6', value: '1.5rem', pixels: '24px' },
    { utility: 'p-8 / gap-8', value: '2rem', pixels: '32px' },
    { utility: 'p-12 / gap-12', value: '3rem', pixels: '48px' }
  ];

  // `uses` counts word-bounded occurrences of the utility across every .ts/.svelte
  // under packages/blocks/src/lib, excluding tests — an indicative snapshot, not a
  // contract. It is here because it is the only honest answer to "which variable
  // actually moves my UI?": the ramp is steep, and everything above text-xl is
  // unused by the library. A 0 renders as an em-dash, i.e. reads as "nothing uses
  // this" — so a stale count here is a factual lie, not a rounding error. The exact
  // method above is the one typography-uses.test.ts re-measures against; keep them
  // in step.
  const typographyScale = [
    { utility: 'text-3xs', variable: '--text-3xs', value: '0.625rem', pixels: '10px', uses: 12 },
    { utility: 'text-2xs', variable: '--text-2xs', value: '0.6875rem', pixels: '11px', uses: 17 },
    { utility: 'text-xs', variable: '--text-xs', value: '0.75rem', pixels: '12px', uses: 96 },
    { utility: 'text-sm', variable: '--text-sm', value: '0.875rem', pixels: '14px', uses: 130 },
    { utility: 'text-base', variable: '--text-base', value: '1rem', pixels: '16px', uses: 78 },
    { utility: 'text-lg', variable: '--text-lg', value: '1.125rem', pixels: '18px', uses: 29 },
    { utility: 'text-xl', variable: '--text-xl', value: '1.25rem', pixels: '20px', uses: 10 },
    { utility: 'text-2xl', variable: '--text-2xl', value: '1.5rem', pixels: '24px', uses: 0 }
  ];

  const weightScale = [
    { utility: 'font-normal', variable: '--font-weight-normal', value: '400', uses: 4 },
    { utility: 'font-medium', variable: '--font-weight-medium', value: '500', uses: 53 },
    { utility: 'font-semibold', variable: '--font-weight-semibold', value: '600', uses: 43 },
    { utility: 'font-bold', variable: '--font-weight-bold', value: '700', uses: 12 }
  ];

  const typographyOverrideExample = `/* app.css — the SAME @theme block that retunes color.
   Safe because the library never re-imports Tailwind: your
   @theme is compiled last and wins. */
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css';

@theme {
  /* Families — blocks never sets \`font-sans\`, so body type simply
     inherits from your page. It DOES use \`font-mono\` (CommandPalette
     shortcut keys, JourneyTimeline meta), so this retunes those. */
  --font-sans: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Size AND its paired line-height. Tailwind's built-in sizes each
     ship a --text-*--line-height; changing the size alone leaves the
     old rhythm behind on all ~128 text-sm call sites. */
  --text-sm: 0.9375rem;
  --text-sm--line-height: calc(1.375 / 0.9375);

  --font-weight-medium: 550;
  --leading-tight: 1.3;
  --tracking-wide: 0.02em;
}`;

  // Physical radius scale — real CSS variables defined in
  // blocks/src/lib/style/foundation.css, each with a matching Tailwind utility.
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

  // Semantic 3-tier radius vocabulary (+ the bridge adjacency token) —
  // components consume these, not raw radii. Re-tint per brand to reshape
  // the whole library at once.
  const semanticRadiusTokens = [
    {
      name: '--radius-commit',
      value: '9999px',
      usage: 'Pill/round — actions, identity, status (Button, Badge, Toggle)'
    },
    {
      name: '--radius-modify',
      value: 'var(--radius-sm) · 4px',
      usage: 'Editable surfaces, navigation (Input, Select, Tab, Menu)'
    },
    {
      name: '--radius-contain',
      value: 'var(--radius-xs) · 2px',
      usage: 'Containers, panels (Card, Alert, Dialog, Tooltip)'
    },
    {
      name: '--radius-bridge',
      value: 'var(--radius-md) · 6px',
      usage: 'Adjacency only — floating panel anchored to a pill (commit-tier) trigger'
    }
  ];

  // Interaction layer — real CSS variables in blocks/src/lib/style/interaction.css.
  const durationTokens = [
    { name: '--blocks-duration-instant', value: '75ms' },
    { name: '--blocks-duration-fast', value: '150ms' },
    { name: '--blocks-duration-normal', value: '250ms' },
    { name: '--blocks-duration-slow', value: '350ms' },
    { name: '--blocks-duration-slower', value: '500ms' },
    { name: '--blocks-duration-slowest', value: '750ms' }
  ];

  const shadowTokens = [
    { name: '--blocks-shadow-xs', source: 'var(--color-shadow-xs)' },
    { name: '--blocks-shadow-sm', source: 'var(--color-shadow-sm)' },
    { name: '--blocks-shadow-base', source: 'var(--color-shadow-base)' },
    { name: '--blocks-shadow-md', source: 'var(--color-shadow-md)' },
    { name: '--blocks-shadow-lg', source: 'var(--color-shadow-lg)' },
    { name: '--blocks-shadow-tint', source: '0 0 0 · oklch L C H, no alpha' }
  ];

  // Both are declared on `:root`, NOT inside @theme — they are raw partial
  // values spliced into a color function, not standalone tokens. See the
  // caveat rendered below the table.
  const chromaTokens = [
    {
      name: '--blocks-shadow-tint',
      value: '0 0 0',
      usage:
        'oklch L C H triplet (no alpha) spliced into every --color-shadow-*. Re-tint so shadows match your chassis instead of reading as cool smudges.'
    },
    {
      name: '--neutral-chrome-hue',
      value: '240',
      usage:
        'Hue of the neutral intent chrome (bg-neutral / text-neutral / neutral borders). Keeps the warm-neutral ramp lightness — only the hue moves, so contrast is untouched.'
    }
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
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
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
      <p class="text-text-secondary mb-4">
        The neutral ramp has 16 steps: alongside the standard 50–950 ladder it ships a
        <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">25</code> tint (the
        quiet-surface ground) and the half-steps
        <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">650/750/850</code>,
        which differentiate the dark-mode elevation ladder.
      </p>
      <div class="mb-4 grid grid-cols-4 gap-1 sm:grid-cols-8">
        {#each [0, 25, 50, 100, 200, 300, 400, 500, 600, 650, 700, 750, 800, 850, 900, 950] as shade (shade)}
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

    <h3 class="text-text-primary mb-4 text-lg font-semibold">Intent Ramps</h3>
    <p class="text-text-secondary mb-4">
      Six intent ramps — primary, secondary, success, warning, danger, info — each a full 50–950
      ladder. The 500/600/700 stops are tuned dark enough that white
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">text-on-primary</code>
      passes WCAG AA on the solid fills; warning is the deliberate exception (its fill stays light in
      both modes and pairs with its own warm-dark
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">text-on-warning</code>).
      A separate
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">warm-neutral</code>
      ramp powers the themeable neutral intent chrome.
    </p>
    <div class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each ['primary', 'secondary', 'success', 'warning', 'danger', 'info'] as color (color)}
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

    <p class="text-text-secondary mb-6">
      Urbicon UI does not ship a custom spacing token layer — it uses
      <a
        href="https://tailwindcss.com/docs/padding"
        class="text-primary hover:underline"
        target="_blank"
        rel="noreferrer">Tailwind's built-in spacing scale</a
      >
      directly. Apply spacing with the standard utilities (<code
        class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">p-4</code
      >,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">gap-2</code>,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">m-6</code>). Each step is
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">0.25rem × n</code>,
      driven by Tailwind's own
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--spacing</code> variable.
    </p>

    <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Utility</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Pixels</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Visual</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each spacingScale as step (step.utility)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono">{step.utility}</td>
                <td class="text-text-secondary px-4 py-3 font-mono">{step.value}</td>
                <td class="text-text-tertiary px-4 py-3">{step.pixels}</td>
                <td class="px-4 py-3">
                  <div
                    class="bg-primary-subtle rounded-modify h-4"
                    style="width: {step.value}"
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

    <p class="text-text-secondary mb-6">
      Type is themeable exactly like color. Sizes, weights, leading, tracking and font families are
      Tailwind
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">@theme</code>
      variables —
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--text-sm</code>,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >--font-weight-medium</code
      >,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--leading-tight</code>,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--tracking-wide</code>,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--font-sans</code>,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--font-mono</code> — and
      you override them in the
      <em>same</em>
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">@theme</code> block that
      retunes
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--color-primary-500</code
      >. This docs site is the proof: it rethemes the whole library's type by overriding
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--font-mono</code>
      and
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--font-sans</code> — see
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >apps/docs/src/lib/style/rooms-docs.css</code
      >.
    </p>

    <div
      class="border-warning/40 bg-warning-subtle text-text-secondary rounded-contain mb-6 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-warning-emphasis">Two things to get right.</strong>
      <ul class="mt-2 list-inside list-disc space-y-1">
        <li>
          <strong class="text-text-primary">Change the paired line-height too.</strong> Tailwind's
          built-in sizes each ship a companion
          <code class="text-xs">--text-*--line-height</code>. Resize without it and the rhythm goes
          subtly wrong everywhere the size is used. The two library-added steps (<code
            class="text-xs">--text-2xs</code
          >, <code class="text-xs">--text-3xs</code>) are deliberately size-only — Tailwind emits a
          <code class="text-xs">line-height</code> only when the paired key exists, so they inherit
          it from the cascade. Add the paired key in your own
          <code class="text-xs">@theme</code> if you want one.
        </li>
        <li>
          <strong class="text-text-primary">This works because of one property:</strong> the library
          deliberately does not
          <code class="text-xs">@import 'tailwindcss'</code>, so there is exactly one Tailwind
          compilation — yours — and it wins. If your tooling introduces a second one, typography
          overrides silently revert, exactly like color overrides do. See
          <a
            href="https://codeberg.org/urbicon/ui/src/branch/main/docs/TailwindCaveats.md"
            class="text-primary hover:underline"
            target="_blank"
            rel="noreferrer">docs/TailwindCaveats.md</a
          >.
        </li>
      </ul>
    </div>

    <CodeExample
      title="Theme the type scale"
      code={typographyOverrideExample}
      language="css"
      preview={false}
    />

    <p class="text-text-secondary mt-6 mb-6">
      <strong class="text-text-primary">Know where the leverage is.</strong> The library's usage is
      steep and lopsided:
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--text-sm</code> reaches
      the most call sites by a wide margin, while
      <strong>nothing above <code class="text-xs">text-xl</code> is used at all</strong> — so
      overriding
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--text-6xl</code>
      changes nothing in the library, and
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--text-sm</code> reshapes
      it. And because blocks never sets
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">font-sans</code>, body
      type inherits from your page: <strong>you already own the font decision</strong> — no override needed.
    </p>

    <div class="border-border-subtle bg-surface-base mb-8 overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Utility</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Override</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Pixels</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Uses in blocks</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Example</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each typographyScale as step (step.utility)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono">{step.utility}</td>
                <td class="text-text-secondary px-4 py-3 font-mono whitespace-nowrap"
                  >{step.variable}</td
                >
                <td class="text-text-secondary px-4 py-3 font-mono">{step.value}</td>
                <td class="text-text-tertiary px-4 py-3">{step.pixels}</td>
                <td class="text-text-tertiary px-4 py-3 tabular-nums">
                  {step.uses === 0 ? '—' : step.uses}
                </td>
                <td class="text-text-primary px-4 py-3">
                  <span class={step.utility}>The quick brown fox</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <h3 class="text-text-primary mb-4 text-lg font-semibold">Weights</h3>
    <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Utility</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Override</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Uses in blocks</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each weightScale as step (step.utility)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono">{step.utility}</td>
                <td class="text-text-secondary px-4 py-3 font-mono whitespace-nowrap"
                  >{step.variable}</td
                >
                <td class="text-text-secondary px-4 py-3 font-mono">{step.value}</td>
                <td class="text-text-tertiary px-4 py-3 tabular-nums">{step.uses}</td>
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

    <h3 class="text-text-primary mb-4 text-lg font-semibold">Physical Scale</h3>
    <p class="text-text-secondary mb-6">
      Real <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--radius-*</code>
      CSS variables, each with a matching Tailwind utility.
    </p>
    <div class="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
      {#each radiusTokens as token (token.name)}
        <div class="text-center">
          <div class="bg-primary mx-auto mb-2 h-16 w-16" style="border-radius: {token.value}"></div>
          <div class="text-text-secondary font-mono text-xs">{token.utility}</div>
          <div class="text-text-tertiary text-xs">{token.value}</div>
        </div>
      {/each}
    </div>

    <h3 class="text-text-primary mb-4 text-lg font-semibold">Semantic Tiers</h3>
    <p class="text-text-secondary mb-6">
      Components consume a 3-tier semantic vocabulary, not raw radii. Re-tint the three tier
      variables to reshape the whole library at once — see the
      <a href={resolve('/customization/tier-system')} class="text-primary hover:underline"
        >Tier System</a
      >
      for the full cascade. A fourth token,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--radius-bridge</code>,
      is not a tier — it pairs pill triggers with their dropdown panels.
    </p>
    <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Used by</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each semanticRadiusTokens as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono whitespace-nowrap">{token.name}</td>
                <td class="text-text-secondary px-4 py-3 font-mono whitespace-nowrap"
                  >{token.value}</td
                >
                <td class="text-text-tertiary px-4 py-3">{token.usage}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Motion & Depth -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="interaction">Motion &amp; Depth</h2>
    <p class="text-text-secondary mb-6">
      The interaction layer ships real
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--blocks-duration-*</code
      >
      and
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--blocks-shadow-*</code>
      variables (plus easing curves like
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >--blocks-ease-gentle</code
      >). Durations collapse to 1ms under
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >prefers-reduced-motion</code
      >;
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >prefers-contrast: more</code
      >
      widens the focus ring to 3px and promotes hairline borders; in print, shadows drop to
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">none</code>.
    </p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Duration token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each durationTokens as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono text-xs">{token.name}</td>
                <td class="text-text-secondary px-4 py-3 font-mono">{token.value}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Shadow token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Source</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each shadowTokens as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono text-xs">{token.name}</td>
                <td class="text-text-tertiary px-4 py-3 font-mono text-xs">{token.source}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <h3 class="text-text-primary mt-10 mb-4 text-lg font-semibold">Theme-level chroma knobs</h3>
    <p class="text-text-secondary mb-6">
      Two tokens let a theme match its chrome to its chassis without touching contrast. The four
      coloured themes set both — see
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >blocks/src/lib/style/themes/forest.css</code
      >. The Neutral theme sets neither, by design: it inherits the library-default cool grey chrome
      and leaves the shadow tint untouched.
    </p>
    <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Default</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">What it does</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each chromaTokens as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono text-xs whitespace-nowrap"
                  >{token.name}</td
                >
                <td class="text-text-secondary px-4 py-3 font-mono text-xs">{token.value}</td>
                <td class="text-text-tertiary px-4 py-3">{token.usage}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div
      class="border-warning/40 bg-warning-subtle text-text-secondary rounded-contain mt-4 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-warning-emphasis"
        >Set these in <code class="text-xs">:root</code>, never in
        <code class="text-xs">@theme</code>.</strong
      >
      Both are raw partial values, not standalone tokens —
      <code class="text-xs">--blocks-shadow-tint</code> is an
      <code class="text-xs">oklch L C H</code> triplet <em>without</em> an alpha channel, spliced
      into
      <code class="text-xs">oklch(var(--blocks-shadow-tint) / 0.05)</code>. Putting either inside
      <code class="text-xs">@theme</code>
      gets you nothing. The shipped themes declare them in a
      <code class="text-xs">:root</code> block after their <code class="text-xs">@theme</code> for exactly
      this reason.
    </div>
  </section>

  <!-- Custom Theming -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="custom-theming">Custom Theming</h2>

    <p class="text-text-secondary mb-6">
      Use Tailwind 4's
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">@theme</code>
      directive to override tokens, or import one of the shipped themes — see
      <a href={resolve('/customization/themes')} class="text-primary hover:underline">Themes</a> for the
      full gallery.
    </p>

    <CodeExample
      title="Custom Theme Example"
      code={customThemeExample}
      language="css"
      preview={false}
    />

    <div class="bg-primary-subtle border-primary/20 mt-6 rounded-xl border p-6">
      <h3 class="text-primary-emphasis mb-3 font-semibold">Override at the right layer</h3>
      <ul class="text-text-secondary space-y-3 text-sm">
        <li>
          <strong class="text-text-primary">Re-tint a hue → foundation ramp.</strong> Override every stop
          of the ramp, keeping each stop's lightness/chroma profile — the WCAG-tuned contrast survives,
          and the semantic layer picks the new hue up in both modes automatically. This is exactly what
          the shipped themes do.
        </li>
        <li>
          <strong class="text-text-primary">Change a role → semantic token.</strong> To alter what
          "elevated" or "subtle" means, override the semantic token itself — and supply a
          <code class="bg-surface-base rounded-modify px-1.5 py-0.5">light-dark(light, dark)</code>
          pair, otherwise the token is pinned to one look in both modes.
        </li>
        <li>
          <strong class="text-text-primary"
            >Restyle one component → the component API, not CSS.</strong
          >
          Use the override ladder:
          <code class="bg-surface-base rounded-modify px-1.5 py-0.5">class</code>
          → <code class="bg-surface-base rounded-modify px-1.5 py-0.5">slotClasses</code> →
          <code class="bg-surface-base rounded-modify px-1.5 py-0.5">BlocksProvider</code>
          presets/overrides →
          <code class="bg-surface-base rounded-modify px-1.5 py-0.5">unstyled</code>. Never force
          colors with <code class="bg-surface-base rounded-modify px-1.5 py-0.5">!</code> overrides
          — see
          <a href={resolve('/customization/blocks-provider')} class="text-primary hover:underline"
            >BlocksProvider</a
          >.
        </li>
      </ul>
    </div>
  </section>

  <!-- Dark Mode -->
  <section class="mb-16">
    <h2 class="text-text-primary mb-6 text-2xl font-bold" id="dark-mode">Dark Mode Support</h2>

    <p class="text-text-secondary mb-6">
      Design tokens automatically adapt to dark mode using
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">light-dark()</code>:
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">:root</code> declares
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm"
        >color-scheme: light dark</code
      >, so the browser resolves the matching branch from the user's preference. A manual toggle
      only sets
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">:root.light</code>
      /
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">:root.dark</code> to override
      the
      <code class="bg-surface-subtle rounded-modify px-2 py-1 text-sm">color-scheme</code> — no
      token duplication, and no manual
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
              >neutral-100</span
            >
          </div>
        </div>
      </Card>
    </div>
  </section>
</DocsPageLayout>
