<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { parseInteractionTokens } from '$lib/interaction-tokens';
  // The shipped stylesheet itself, so the tables below cannot quote a value
  // the library does not have.
  import interactionCss from '@urbicon-ui/blocks/style/interaction.css?raw';

  const description =
    'The tokens the library ships, layer by layer: color ramps, spacing, typography, radius, motion and depth. Look values up here; write and switch themes on the Themes page.';

  const navigation = [
    { id: 'architecture', title: 'Token Architecture' },
    { id: 'colors', title: 'Color System' },
    { id: 'spacing', title: 'Spacing Scale' },
    { id: 'typography', title: 'Typography Scale' },
    { id: 'radius', title: 'Border Radius' },
    { id: 'interaction', title: 'Motion & Depth' }
  ];

  const colorTokenExample = `@theme {
  /* Foundation Colors (oklch for better perception) */
  --color-neutral-50: oklch(0.965 0.006 240);
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

  // Custom brand tokens get Tailwind utilities for free.
  const brandTokenExample = `@theme {
  /* bg-brand-500, text-brand-500, border-brand-500, … */
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
    { utility: 'text-3xs', variable: '--text-3xs', value: '0.625rem', pixels: '10px', uses: 17 },
    { utility: 'text-2xs', variable: '--text-2xs', value: '0.6875rem', pixels: '11px', uses: 23 },
    { utility: 'text-xs', variable: '--text-xs', value: '0.75rem', pixels: '12px', uses: 129 },
    { utility: 'text-sm', variable: '--text-sm', value: '0.875rem', pixels: '14px', uses: 169 },
    { utility: 'text-base', variable: '--text-base', value: '1rem', pixels: '16px', uses: 96 },
    { utility: 'text-lg', variable: '--text-lg', value: '1.125rem', pixels: '18px', uses: 39 },
    { utility: 'text-xl', variable: '--text-xl', value: '1.25rem', pixels: '20px', uses: 14 },
    { utility: 'text-2xl', variable: '--text-2xl', value: '1.5rem', pixels: '24px', uses: 5 }
  ];

  const weightScale = [
    { utility: 'font-normal', variable: '--font-weight-normal', value: '400', uses: 5 },
    { utility: 'font-medium', variable: '--font-weight-medium', value: '500', uses: 67 },
    { utility: 'font-semibold', variable: '--font-weight-semibold', value: '600', uses: 53 },
    { utility: 'font-bold', variable: '--font-weight-bold', value: '700', uses: 12 }
  ];

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
      name: '--radius-control',
      value: '9999px',
      usage:
        'Radio indicator only. Defaults to the same pill as --radius-commit but is not tied to it, so squaring your buttons keeps the "pick exactly one" circle. Set it to 0 if you want square radios too.'
    },
    {
      name: '--radius-modify',
      value: 'var(--radius-sm) · 4px',
      usage: 'Editable surfaces, navigation (Input, Select, Tab, Menu)'
    },
    {
      name: '--radius-contain',
      value: 'var(--radius-xs) · 2px',
      usage: 'Containers, panels (Card, Alert, Dialog, Drawer, Popover, Tooltip)'
    },
    {
      name: '--radius-bridge',
      value: 'var(--radius-md) · 6px',
      usage:
        'The middle rung, for two cases: adjacency (a floating panel anchored to a pill trigger — the Menu panel) and optical size (a surface too small for the container radius to read as intentional — the ChatMessage bubble, Textarea at tier="commit", Card tier="bridge")'
    }
  ];

  // Interaction layer — parsed out of the shipped stylesheet, not copied.
  // A retuned bezier or a new per-component override point appears here
  // without a docs edit; a value quoted here cannot diverge from the library.
  const { durations, easings, shadows, overridePoints } = parseInteractionTokens(interactionCss);

  // Both are declared on `:root` in semantic.css, NOT inside @theme — they are
  // raw partial values spliced into a color function, not standalone tokens.
  // See the caveat rendered below the table.
  const chromaTokens = [
    {
      name: '--blocks-shadow-tint',
      value: '0 0 0',
      usage: 'Re-tint so shadows match your chassis. Declare on :root, see below.'
    },
    {
      name: '--neutral-chrome-hue',
      value: '240',
      usage:
        'Hue of the neutral intent chrome (bg-neutral / text-neutral / neutral borders). Keeps the warm-neutral ramp lightness; only the hue moves, so contrast is untouched.'
    }
  ];
</script>

<!-- urbicon-ignore placeholder-content — 'The quick brown fox' is a type
     specimen, the one place filler copy is the content: it shows the
     typography scale at each size. -->

<SeoMeta title="Token Reference" {description} />

<DocsPageLayout
  title="Token Reference"
  {description}
  maxWidth="2xl"
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
>
  <Section id="architecture" title="Token Architecture" class="mb-16">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Three layers. The <strong>foundation</strong> holds the raw ramps a theme re-tints; the
      <strong>semantic</strong> layer maps them to roles like
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">surface-elevated</code>
      and resolves both modes via
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">light-dark()</code>; the
      <strong>interaction</strong> layer times motion and stacks depth. How to write, scope and
      switch a theme is the
      <a href={resolve('/customization/themes')} class="text-primary hover:underline">Themes</a> page;
      this one lists what exists.
    </p>

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

    <div class="bg-primary-subtle border-primary/20 mt-8 rounded-xl border p-6">
      <h3 class="text-primary-emphasis mb-3 font-semibold">Override at the right layer</h3>
      <ul class="text-text-secondary space-y-3 text-sm">
        <li>
          <strong class="text-text-primary">Re-tint a hue → foundation ramp.</strong> Override every stop
          of the ramp, keeping each stop's lightness/chroma profile: the WCAG-tuned contrast survives,
          and the semantic layer picks the new hue up in both modes automatically. This is exactly what
          the shipped themes do.
        </li>
        <li>
          <strong class="text-text-primary">Change a role → semantic token.</strong> To alter what
          "elevated" or "subtle" means, override the semantic token itself, and supply a
          <code class="bg-surface-base rounded-modify px-1.5 py-0.5">light-dark(light, dark)</code>
          pair, otherwise the token is pinned to one look in both modes.
        </li>
        <li>
          <strong class="text-text-primary"
            >Restyle one component → the component API, not CSS.</strong
          >
          That is a job for
          <code class="bg-surface-base rounded-modify px-1.5 py-0.5">class</code>,
          <code class="bg-surface-base rounded-modify px-1.5 py-0.5">slotClasses</code> and
          <a href={resolve('/customization/blocks-provider')} class="text-primary hover:underline"
            >BlocksProvider</a
          >, never for
          <code class="bg-surface-base rounded-modify px-1.5 py-0.5">!</code> color overrides; the
          <a href={resolve('/customization')} class="text-primary hover:underline"
            >Customization hub</a
          > carries the decision table.
        </li>
      </ul>
    </div>

    <!-- Anchor targets for deep links published before the restructure:
         /customization/tokens#custom-theming and #dark-mode both named
         sections that now live on the Themes page. Without the ids, an old
         bookmark or search hit lands at the top of this page with no hint
         where the content went. -->
    <p class="text-text-tertiary mt-6 text-sm leading-relaxed">
      <span id="custom-theming"></span><span id="dark-mode"></span>Custom theming and dark mode used
      to live on this page. They moved to
      <a href={`${resolve('/customization/themes')}#create`} class="text-primary hover:underline"
        >Themes → Write Your Own Theme</a
      >
      and
      <a href={`${resolve('/customization/themes')}#dark-mode`} class="text-primary hover:underline"
        >Themes → Dark Mode</a
      >.
    </p>
  </Section>

  <!-- Color System -->
  <Section id="colors" title="Color System" class="mb-16">
    <div class="mb-8">
      <h3 class="text-text-primary mb-4 text-lg font-semibold">Neutral Palette</h3>
      <p class="text-text-secondary mb-4">
        The neutral ramp has 16 steps: alongside
        <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">0</code> (pure white)
        and the standard 50–950 ladder it ships a
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
      Six intent ramps (primary, secondary, success, warning, danger, info), each a full 50–950
      ladder. The ramps are tuned so
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">text-on-fill</code>
      clears WCAG AA on every solid fill: white on the 500/600/700 fills in light mode, near-black on
      the lighter 400/500 fills in dark mode. It is the label colour for
      <em>every</em> solid intent, which is why it is not named after one of them.
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">text-on-primary</code>
      still exists, resolves to the same value and governs the primary fill alone, so retuning it cannot
      repaint success or danger along with it. Warning is the deliberate exception (its fill stays light
      in both modes and pairs with its own warm-dark
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">text-on-warning</code>).
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

    <h3 class="text-text-primary mb-4 text-lg font-semibold">Neutral Intent Chrome</h3>
    <p class="text-text-secondary mb-4">
      The neutral intent (<code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >bg-neutral</code
      >, <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">text-neutral</code>,
      neutral borders) is built from a separate
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >--color-warm-neutral-*</code
      >
      ramp, but never renders it directly: each role re-derives the ramp stop through
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >oklch(from … l c var(--neutral-chrome-hue))</code
      >, keeping the ramp's lightness and chroma and taking only the hue from the knob. The knob
      defaults to 240, so the library's own chrome is cool, and re-tinting it is a one-line theme
      move (see Motion &amp; Depth). The swatches below render in whatever theme is active: this
      docs site re-pins them to the warm ramp directly, which is why they look warm here.
    </p>
    <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {#each ['neutral', 'neutral-hover', 'neutral-active', 'neutral-subtle', 'neutral-emphasis'] as role (role)}
        <div class="border-border-subtle bg-surface-base rounded-modify border p-2 text-center">
          <div class="rounded-modify mb-1 h-8 w-full" style="background: var(--color-{role})"></div>
          <div class="text-text-tertiary font-mono text-xs">--color-{role}</div>
        </div>
      {/each}
    </div>

    <p class="text-text-secondary mb-4">
      Your own color tokens live in the same system: any
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--color-*</code>
      variable declared in
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">@theme</code> gets its Tailwind
      utilities for free.
    </p>
    <CodeExample
      title="Custom brand token"
      code={brandTokenExample}
      language="css"
      preview={false}
    />
  </Section>

  <!-- Spacing Scale -->
  <Section id="spacing" title="Spacing Scale" class="mb-16">
    <p class="text-text-secondary mb-6">
      Urbicon UI does not ship a custom spacing token layer. It uses
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

    <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
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
  </Section>

  <!-- Typography Scale -->
  <Section id="typography" title="Typography Scale" class="mb-16">
    <p class="text-text-secondary mb-6">
      Sizes, weights, leading, tracking and families are Tailwind
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">@theme</code> variables;
      override them alongside your color ramps (<a
        href={resolve('/customization/themes')}
        class="text-primary hover:underline">Themes → Typography</a
      >, including the paired
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >--text-*--line-height</code
      > rule). The two sub-xs steps are library-added and ship size-only; every other row re-tunes a Tailwind
      built-in.
    </p>

    <div class="border-border-subtle bg-surface-base rounded-contain mb-8 overflow-hidden border">
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
    <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
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
  </Section>

  <!-- Border Radius -->
  <Section id="radius" title="Border Radius" class="mb-16">
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
      variables to reshape the whole library at once (the full cascade:
      <a href={resolve('/customization/tier-system')} class="text-primary hover:underline"
        >Radius Tiers</a
      >). A fourth token,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--radius-bridge</code>,
      is not a tier: it pairs pill triggers with their dropdown panels.
    </p>
    <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
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
  </Section>

  <!-- Motion & Depth -->
  <Section id="interaction" title="Motion &amp; Depth" class="mb-16">
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
      widens the focus ring to 3px and darkens subtle borders to text colour; in print, shadows drop to
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">none</code> and hairlines promote
      to a real grey rule.
    </p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Duration token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each durations as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono text-xs">{token.name}</td>
                <td class="text-text-secondary px-4 py-3 font-mono">{token.value}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Shadow token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Source</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each shadows as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono text-xs">{token.name}</td>
                <td class="text-text-tertiary px-4 py-3 font-mono text-xs">{token.value}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Easing token</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Value</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each easings as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono text-xs">{token.name}</td>
                <td class="text-text-tertiary px-4 py-3 font-mono text-xs">{token.value}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
        <table class="w-full text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Override point</th>
              <th class="text-text-primary px-4 py-3 text-left font-semibold">Default</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each overridePoints as token (token.name)}
              <tr>
                <td class="text-primary px-4 py-3 font-mono text-xs">{token.name}</td>
                <td class="text-text-tertiary px-4 py-3 font-mono text-xs">{token.value}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <h3 class="text-text-primary mt-10 mb-4 text-lg font-semibold">Theme-level chroma knobs</h3>
    <p class="text-text-secondary mb-6">
      Two tokens let a theme match its chrome to its chassis without touching contrast. The four
      coloured themes set both; see
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >blocks/src/lib/style/themes/forest.css</code
      >. The Neutral theme sets neither, by design: it inherits the library-default cool grey chrome
      and leaves the shadow tint untouched.
    </p>
    <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
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
  </Section>
</DocsPageLayout>
