<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Card, Separator } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'ladder', title: 'Which tool do I use?', order: 1 },
    { id: 'class-trap', title: 'The class Root-Slot Trap', order: 2 },
    { id: 'themes', title: 'CSS Token Themes', order: 3 },
    { id: 'defaults', title: 'Global Defaults', order: 4 },
    { id: 'unstyled', title: 'Unstyled Mode', order: 5 },
    { id: 'deep-dives', title: 'Deep Dives', order: 6 }
  ];

  // The canonical override ladder (weak → strong). Each rung answers one
  // concrete "I want to…" goal so consumers stop guessing which tool to reach for.
  const ladder = [
    {
      goal: 'Restyle one element on one instance',
      tool: 'class',
      example: '<Button class="rounded-full">',
      note: 'Highest priority. Merges onto the OUTERMOST (root) slot only — see the trap below.'
    },
    {
      goal: 'Restyle an inner element (the actual <input>, a header, a chevron…)',
      tool: 'slotClasses.<slot>',
      example: '<Input slotClasses={{ base: "rounded-full" }} />',
      note: 'Type-safe — autocomplete lists the available slot names for each component.'
    },
    {
      goal: 'App-wide look for a component type (every Button, every Card)',
      tool: 'preset / BlocksProvider defaults',
      example: 'defaults={{ Button: { slotClasses: { base: "rounded-full" } } }}',
      note: 'defaults apply to every instance; presets are opt-in via preset="name".'
    },
    {
      goal: 'Style only one variant / intent / state (e.g. only outlined)',
      tool: 'overrides',
      example: 'overrides: [{ variant: "outlined", class: { base: "border" } }]',
      note: 'Prop-conditional rule — what unconditional slotClasses cannot express.'
    },
    {
      goal: 'Rebuild a component from scratch (strip every default)',
      tool: 'unstyled + slotClasses',
      example: '<Card unstyled slotClasses={{ base: "…" }} />',
      note: 'Renders the HTML structure only; you own all visuals.'
    }
  ];

  // Full precedence chain, weak → strong (from resolveSlotClasses + the component class merge).
  const precedence = [
    'tv() variant styles (library default)',
    'BlocksProvider defaults.slotClasses',
    'BlocksProvider defaults.overrides[match]',
    'preset.slotClasses (when preset="…" is set)',
    'preset.overrides[match]',
    'Instance slotClasses prop',
    'Instance class prop (root slot only)'
  ];

  const classTrapExample =
    `<scr` +
    `ipt>
  import { Input } from '@urbicon-ui/blocks';
</scr` +
    `ipt>

<!-- ❌ Surprise: this rounds the WRAPPER (label + field column), not the field. -->
<Input label="Email" class="rounded-full" />

<!-- ✅ Reach the actual <input> via the \`base\` slot. -->
<Input label="Email" slotClasses={{ base: 'rounded-full' }} />`;

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
  description="Every Urbicon UI component is restyleable through one predictable ladder of escape hatches. Pick the lowest rung that solves your problem — lower rungs preserve more of the design system's behavior (dark mode, hover/active cascade, focus rings)."
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Customization' }]}
>
  <!-- Task 1: the canonical override ladder as a decision table -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="ladder">Which tool do I use?</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Start from your goal, not from the API. Find the row that matches what you want to change —
      the <strong>Reach for</strong> column is the tool to use.
    </p>
    <div class="border-border-subtle bg-surface-base overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-border-subtle bg-surface-subtle border-b">
            <tr>
              <th class="text-text-primary px-4 py-3 font-semibold">I want to…</th>
              <th class="text-text-primary px-4 py-3 font-semibold">Reach for</th>
              <th class="text-text-primary px-4 py-3 font-semibold">Example</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            {#each ladder as rung (rung.tool)}
              <tr>
                <td class="text-text-secondary px-4 py-3 align-top">
                  {rung.goal}
                  <span class="text-text-tertiary mt-1 block text-xs">{rung.note}</span>
                </td>
                <td class="px-4 py-3 align-top">
                  <code class="text-primary text-xs font-medium whitespace-nowrap">{rung.tool}</code
                  >
                </td>
                <td class="px-4 py-3 align-top">
                  <code class="text-text-tertiary text-xs">{rung.example}</code>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <div
      class="bg-surface-subtle text-text-secondary rounded-contain mt-4 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-text-primary">Full precedence chain (weakest → strongest):</strong>
      Conflicting Tailwind utilities are resolved per bucket, so a later source wins (e.g. an instance
      <code class="text-xs">rounded-none</code>
      defeats a default
      <code class="text-xs">rounded-full</code>); non-conflicting classes accumulate.
      <ol class="mt-2 list-inside list-decimal space-y-1">
        {#each precedence as step (step)}
          <li><code class="text-xs">{step}</code></li>
        {/each}
      </ol>
    </div>
  </section>

  <Separator class="mb-12" />

  <!-- Task 2: the "class only hits the root slot" trap -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="class-trap">
      The <code class="text-primary">class</code> Root-Slot Trap
    </h2>
    <div
      class="border-warning/40 bg-warning-subtle text-text-secondary rounded-contain mb-6 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-warning-emphasis"
        >The <code class="text-xs">class</code> prop only reaches the outermost (root) slot.</strong
      >
      Most components wrap several elements. <code class="text-xs">class</code> lands on the
      <em>root</em> wrapper, not the element you are usually picturing. To style something inside,
      go through <code class="text-xs">slotClasses.&lt;slot&gt;</code>.
    </div>
    <p class="text-text-secondary mb-6 leading-relaxed">
      The classic surprise is <code class="text-xs">Input</code>: its root slot is
      <code class="text-xs">wrapper</code> (the label + field column), and the real
      <code class="text-xs">&lt;input&gt;</code> element is the
      <code class="text-xs">base</code> slot. So <code class="text-xs">class="rounded-full"</code>
      rounds the column, not the field.
    </p>
    <CodeExample title="class vs. slotClasses on Input" code={classTrapExample} preview={false} />
    <p class="text-text-secondary mt-6 leading-relaxed">
      <code class="text-xs">slotClasses</code> is now <strong>type-safe</strong> on every component:
      the keys are derived from the component's <code class="text-xs">tv()</code> slots, so your
      editor autocompletes the available slot names (<code class="text-xs">wrapper</code>,
      <code class="text-xs">container</code>, <code class="text-xs">base</code>,
      <code class="text-xs">label</code>, <code class="text-xs">message</code>… for
      <code class="text-xs">Input</code>). Check a component's API reference, or the
      <a href={resolve('/customization/blocks-provider')} class="text-primary hover:underline"
        >Slot Names reference</a
      >, for its slot map.
    </p>
  </section>

  <Separator class="mb-12" />

  <!-- CSS Themes -->
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

  <!-- BlocksProvider defaults -->
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
    <p class="text-text-secondary mt-4 text-sm leading-relaxed">
      Defaults sit near the bottom of the
      <a href="#ladder" class="text-primary hover:underline">precedence chain</a> above — instance
      <code class="text-xs">slotClasses</code> and <code class="text-xs">class</code> still win. For
      prop-conditional defaults (<code class="text-xs">overrides</code>) and named
      <code class="text-xs">presets</code>, see the
      <a href={resolve('/customization/blocks-provider')} class="text-primary hover:underline"
        >BlocksProvider API</a
      >.
    </p>
  </section>

  <Separator class="mb-12" />

  <!-- Fully unstyled -->
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
