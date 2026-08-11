<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Card, Input, Separator } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { classCaveat, precedenceChain } from '$lib/customization-data';

  const navigation = [
    { id: 'ladder', title: 'Which tool do I use?' },
    { id: 'class-trap', title: 'The class Root-Slot Trap' },
    { id: 'themes', title: 'Theming' },
    { id: 'defaults', title: 'Defaults & Unstyled Mode' },
    { id: 'deep-dives', title: 'Deep Dives' }
  ];

  // The decision table (narrow → broad). Each row answers one concrete
  // "I want to…" goal so consumers stop guessing which tool to reach for.
  const ladder = [
    {
      goal: 'Restyle one element on one instance',
      tool: 'class',
      example: '<Button class="rounded-full">',
      note: `${classCaveat} Merges onto the OUTERMOST (root) slot only, see the trap below.`
    },
    {
      goal: 'Restyle an inner element (the <input> itself, a header, a chevron…)',
      tool: 'slotClasses.<slot>',
      example: '<Input slotClasses={{ base: "rounded-full" }} />',
      note: 'Type-safe: autocomplete lists the available slot names for each component.'
    },
    {
      goal: 'App-wide look for a component type (every Button, every Card)',
      tool: 'preset / BlocksProvider defaults',
      example: '<BlocksProvider defaults={{ Button: { slotClasses: { base: "rounded-full" } } }}>',
      note: 'defaults apply to every instance; presets are opt-in via preset="name". Keys inside defaults are plain strings; the slot-name autocomplete lives on the component\'s own slotClasses prop.'
    },
    {
      goal: 'Style only one variant / intent / state (e.g. only outlined)',
      tool: 'overrides',
      example:
        'defaults={{ Badge: { overrides: [{ variant: "outlined", class: { base: "border" } }] } }}',
      note: 'Prop-conditional rule matching any combination of variant props: only variant="outlined", or size and intent together.'
    },
    {
      goal: 'Rebuild a component from scratch (strip every default)',
      tool: 'unstyled + slotClasses',
      example: '<Card unstyled slotClasses={{ base: "…" }} />',
      note: 'Renders the HTML structure only: you own every visual, including dark mode, hover/active and focus rings.'
    }
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

  const providerExample =
    `<!-- src/routes/+layout.svelte -->
<scr` +
    `ipt>
  import { BlocksProvider } from '@urbicon-ui/blocks';
  let { children } = $props();
</scr` +
    `ipt>

<BlocksProvider defaults={{ Button: { slotClasses: { base: 'rounded-full' } } }}>
  {@render children()}
</BlocksProvider>`;
</script>

<!-- urbicon-ignore inline-style card-monotony font-weight-uniform — the
     inline styles are OKLCH swatches: the colour IS the content, and a token
     would show the reader the current theme instead of the one being named.
     The deep-dive cards are a grid of peers — one entry per customization
     page — so varying their weight would invent a hierarchy the set does not
     have; the uniform font-semibold hits are those peer card titles plus one
     table's header cells, where a single weight is correct. -->

<SeoMeta
  title="Customization"
  description="Customize Urbicon UI with CSS token themes, BlocksProvider, and per-component defaults."
/>

<DocsPageLayout
  title="Customization"
  description="Every component can be restyled from the outside. Start with the narrowest tool that solves your problem: class and slotClasses change one instance, BlocksProvider changes every instance, unstyled drops the library's styling and hands you the markup."
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Home', href: resolve('/') }]}
>
  <!-- Task 1: the canonical override ladder as a decision table -->
  <Section id="ladder" title="Which tool do I use?" class="mb-12">
    <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
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
      Through step 6, each source strips the earlier ones' conflicting Tailwind utilities on the slot
      they share, so the later source wins (an instance <code class="text-xs">slotClasses</code>
      <code class="text-xs">rounded-none</code> defeats a provider default
      <code class="text-xs">rounded-full</code>), and non-conflicting classes accumulate. Step 7 is
      not a further rung: <code class="text-xs">class</code> joins steps 2–6 as one source, and
      within a source conflicting utilities are left to the CSS cascade. So
      <code class="text-xs">class</code> reliably beats the library defaults and nothing else —
      against a provider or preset value, both utilities survive and stylesheet order decides. Use
      <code class="text-xs">slotClasses</code> to override a conflicting utility and
      <code class="text-xs">class</code> to add one.
      <ol class="mt-2 list-outside list-decimal space-y-1 pl-5">
        {#each precedenceChain as step (step)}
          <li><code class="text-xs">{step}</code></li>
        {/each}
      </ol>
    </div>
  </Section>

  <Separator class="mb-12" />

  <!-- Task 2: the "class only hits the root slot" trap -->
  <!-- titleSnippet, not `title`: the heading carries inline markup, and a
       `title` prop is a plain string. -->
  <Section id="class-trap" class="mb-12">
    {#snippet titleSnippet()}
      The <code class="text-primary">class</code> Root-Slot Trap
    {/snippet}
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
      Input is the one that catches people: its root slot is
      <code class="text-xs">wrapper</code> (the label + field column), and the
      <code class="text-xs">&lt;input&gt;</code> itself is the
      <code class="text-xs">base</code> slot. So <code class="text-xs">class="rounded-full"</code>
      rounds the column, not the field.
    </p>
    <CodeExample title="class vs. slotClasses on Input" code={classTrapExample}>
      <div class="flex w-full max-w-md flex-col gap-6">
        <Input label="Email" class="rounded-full" placeholder="you@example.com" />
        <Input label="Email" slotClasses={{ base: 'rounded-full' }} placeholder="you@example.com" />
      </div>
    </CodeExample>
    <p class="text-text-secondary mt-6 leading-relaxed">
      <code class="text-xs">slotClasses</code> is <strong>type-safe</strong> on every component: the
      keys are derived from the component's <code class="text-xs">tv()</code> slots, so your editor
      autocompletes the available slot names (<code class="text-xs">wrapper</code>,
      <code class="text-xs">container</code>, <code class="text-xs">base</code>,
      <code class="text-xs">label</code>, <code class="text-xs">message</code>… for
      <code class="text-xs">Input</code>). Each component's API reference documents its slot map on
      the <code class="text-xs">slotClasses</code> prop (for example
      <a href={resolve('/blocks/primitives/input')} class="text-primary hover:underline">Input</a>).
    </p>
  </Section>

  <Separator class="mb-12" />

  <!-- Theming quickstart; the full recipe lives on /customization/themes -->
  <Section id="themes" title="Theming" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      A theme is one CSS file, imported after the base styles. It replaces the primary and secondary
      accent ramps plus the neutral ramp (<code class="text-xs">--color-neutral-*</code>) that the
      surface, text and border tokens are built from, so a warm accent gets warm surfaces.
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
      A brand color alone is not enough: the neutral ramp follows the accent, and any intent ramp
      (success, warning, danger) that lands near your brand hue has to be moved so status colors
      stay distinguishable. The full recipe, typography, a scoped-theme pattern and the dark-mode
      wiring are on
      <a href={resolve('/customization/themes')} class="text-primary hover:underline">Themes</a>;
      the
      <a href={resolve('/customization/theme-builder')} class="text-primary hover:underline"
        >Theme Builder</a
      >
      generates the file from your brand color.
    </p>
  </Section>

  <Separator class="mb-12" />

  <!-- Provider surface, slimmed: the full API lives on /customization/blocks-provider -->
  <Section id="defaults" title="Defaults & Unstyled Mode" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      When CSS tokens are not enough, wrap your app once in
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">BlocksProvider</code>:
    </p>
    <CodeExample title="The smallest provider setup" code={providerExample} preview={false} />
    <p class="text-text-secondary mt-6 leading-relaxed">
      Its
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">defaults</code> restyle
      every instance of a component type, named
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">presets</code> are opt-in
      looks per instance, and
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">overrides</code> apply to
      one combination of variant props. All three sit below instance props in the
      <a href="#ladder" class="text-primary hover:underline">precedence chain</a>.
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">unstyled</code> sits
      outside it: it drops the <code class="text-xs">tv()</code> styles, and whatever you pass is
      all that is left. The full API with worked examples is
      <a href={resolve('/customization/blocks-provider')} class="text-primary hover:underline"
        >BlocksProvider</a
      >.
    </p>
  </Section>

  <Separator class="mb-12" />

  <!-- Quick links -->
  <Section id="deep-dives" title="Deep Dives">
    <div class="grid gap-4 sm:grid-cols-2">
      <Card
        href={resolve('/customization/themes')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Themes</h3>
          <p class="text-text-tertiary text-sm">
            The gallery with live preview, and the full recipe: write your own theme, scope one to a
            sub-tree, wire up dark mode.
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
            Interactive OKLCH palette generator: pick a brand color, copy the finished theme file.
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
            Global defaults, named presets, prop-conditional overrides, unstyled mode, and how the
            merge behaves.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/tokens')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Token Reference</h3>
          <p class="text-text-tertiary text-sm">
            Every shipped token: color ramps, spacing, typography, radius, motion and depth.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/tier-system')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Radius Tiers</h3>
          <p class="text-text-tertiary text-sm">
            The three-tier semantic radius vocabulary (commit / modify / contain) with cascade and
            override demos.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/figma-tokens')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Figma Export</h3>
          <p class="text-text-tertiary text-sm">
            For designers: the shipped tokens as Tokens-Studio-compatible JSON.
          </p>
        </div>
      </Card>
      <Card
        href={resolve('/customization/rooms-theme')}
        class="border-border-subtle hover:border-primary/30 transition-colors"
      >
        <div class="p-5">
          <h3 class="text-text-primary mb-1 font-semibold">Color Rooms</h3>
          <p class="text-text-tertiary text-sm">
            Case study: how this docs site is themed. A scoped, token-only overlay with a per-family
            accent, light/dark via <code>light-dark()</code>.
          </p>
        </div>
      </Card>
    </div>
  </Section>
</DocsPageLayout>
