<!--
  Getting started — the "build guide". Four real steps (install → tokens →
  first component → theme) with big poster numerals on the left; on the right
  a sticky "Your app so far" specimen card that grows as the reader scrolls:
  empty after 01, token swatches after 02, the live hello-world after 03, and
  at 04 the reader repaints the preview themselves via four paint switches —
  the landing promises "repaint the building", this page lets you do it.

  The preview card reuses the landing's poster grammar (.poster-card +
  .room-accent from $lib/style/rooms.css — imported here too; Vite dedupes):
  a fixed cream+ink artboard (color-scheme: light) whose whole primary-derived
  token family re-resolves from the inline --room-accent, so the real library
  components repaint live. The four paints are the docs' own room colours.

  Step tracking reuses the shared ScrollSpy from @urbicon-ui/docs (same class
  DocsLayout, TableOfContents and /blocks use). Below lg the card is not
  sticky and sits AFTER the steps — by then the last step is active, so the
  mobile reader gets the finished, playable app as the closer.
-->
<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { ArrowRightIcon, Badge, Button, Input } from '@urbicon-ui/blocks';
  import { CodeExample, ScrollSpy } from '@urbicon-ui/docs';
  import '$lib/style/rooms.css';

  // ── The four steps — ids feed the scrollspy, numerals the poster marks ──
  const STEPS = [
    { id: 'install', n: '01', title: 'Install' },
    { id: 'tokens', n: '02', title: 'Import the tokens' },
    { id: 'first-component', n: '03', title: 'Your first component' },
    { id: 'theme', n: '04', title: 'Make it yours' }
  ] as const;

  const spy = new ScrollSpy(() => STEPS.map((step) => step.id));
  $effect(() => spy.observe());
  // Before the first section crosses the trigger line spy.active is '' →
  // findIndex -1 → clamp to step 1, so the card never shows "step 0".
  const activeStep = $derived(Math.max(1, STEPS.findIndex((step) => step.id === spy.active) + 1));

  // ── Step 04 paints — the docs' four room colours (rooms-docs.css) ──
  const PAINTS = [
    { name: 'blocks green', accent: '#00845c', fg: '#f6f3ec' },
    { name: 'table wine', accent: '#7c1f2d', fg: '#f6f3ec' },
    { name: 'auth amber', accent: '#e3a31c', fg: '#17150f' },
    { name: 'ai orange', accent: '#e8500f', fg: '#17150f' }
  ];
  let paint = $state(PAINTS[0]);

  // ── Live hello-world state (steps 03/04 in the preview card) ──
  let demoName = $state('');
  let demoGreeted = $state(false);

  const installExample = `bun add @urbicon-ui/blocks`;

  const basicSetupExample = `/* app.css */
@import '@urbicon-ui/blocks/style/index.css';

/* Your custom styles here */`;

  const viteConfigExample = `// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [tailwindcss(), sveltekit()]
};`;

  const firstComponentExample =
    `<script>
  import { Badge, Button, Input } from '@urbicon-ui/blocks';

  let name = $state('');
  let greeted = $state(false);
</scr` +
    `ipt>

<Input label="Your name" bind:value={name} placeholder="Ada" />

<Button intent="primary" onclick={() => (greeted = true)} disabled={!name}>
  Say hello
</Button>

{#if greeted && name}
  <Badge intent="success">Hello {name}!</Badge>
{/if}`;

  const themeExample = `/* app.css */
@import '@urbicon-ui/blocks/style/index.css';

@theme {
  /* Override the primary ramp — every component follows it */
  --color-primary-500: oklch(0.64 0.16 40); /* warm terracotta */
}`;
</script>

<SeoMeta
  title="Getting Started"
  description="Install Urbicon UI, import the design tokens, render your first component and theme it — four steps with a live preview that grows as you go. Svelte 5 + Tailwind 4."
/>

{#snippet rampStrip(heightClass: string)}
  <div class={['flex', heightClass]} aria-hidden="true">
    <div class="bg-primary-100 flex-1"></div>
    <div class="bg-primary-300 flex-1"></div>
    <div class="bg-primary-500 flex-1"></div>
    <div class="bg-primary-700 flex-1"></div>
    <div class="bg-primary-900 flex-1"></div>
  </div>
{/snippet}

<!-- Hero — Color Rooms field (default blocks room), full-width band flush to
     the app sidebar; the inner wrapper re-aligns with the body column. The
     prerequisites are one mono line here instead of a section of cards. -->
<div data-room-hero>
  <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
    <p class="meta-marker text-text-tertiary text-xs font-medium tracking-wider uppercase">
      Getting started — install · tokens · component · theme
    </p>
    <h1 class="text-text-primary mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
      Getting started
    </h1>
    <p class="text-text-secondary mt-4 max-w-2xl text-lg">
      Four steps from an empty file to a themed app. The “Your app so far” preview grows with every
      step — by the last one, you repaint it yourself.
    </p>
    <p class="font-meta mt-6">
      requires svelte 5 · tailwind css 4 · node 18+ or bun 1+ · typescript recommended
    </p>
  </div>
</div>

<div class="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
  <div class="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-14">
    <!-- ── The four steps ─────────────────────────────────────────────── -->
    <div>
      <!-- 01 · Install -->
      <section id={STEPS[0].id} class="pb-12">
        <h2 class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight">
          <span class="text-primary text-5xl font-medium leading-none" aria-hidden="true">
            {STEPS[0].n}
          </span>
          {STEPS[0].title}
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          One package, zero runtime dependencies — the components ship as compiled Svelte plus a CSS
          token ledger, and only what you import ends up in your bundle. Any package manager works.
        </p>
        <div class="mt-6">
          <CodeExample
            title="Install Urbicon UI"
            code={installExample}
            language="bash"
            preview={false}
          />
        </div>
      </section>

      <!-- 02 · Import the tokens -->
      <section id={STEPS[1].id} class="border-border-subtle border-t py-12">
        <h2 class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight">
          <span class="text-primary text-5xl font-medium leading-none" aria-hidden="true">
            {STEPS[1].n}
          </span>
          {STEPS[1].title}
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          The design system arrives as CSS. One import wires up the OKLCH color ramps, semantic
          tokens, typography and spacing — dark mode included via
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >light-dark()</code
          >, no configuration.
        </p>
        <div class="mt-6">
          <CodeExample
            title="Import CSS tokens"
            code={basicSetupExample}
            language="css"
            preview={false}
          />
        </div>
        <p class="text-text-secondary mt-6 max-w-2xl leading-relaxed">
          If Tailwind 4 isn’t part of your project yet, add the Vite plugin:
        </p>
        <div class="mt-4">
          <CodeExample
            title="Vite config"
            code={viteConfigExample}
            language="javascript"
            preview={false}
          />
        </div>
      </section>

      <!-- 03 · Your first component -->
      <section id={STEPS[2].id} class="border-border-subtle border-t py-12">
        <h2 class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight">
          <span class="text-primary text-5xl font-medium leading-none" aria-hidden="true">
            {STEPS[2].n}
          </span>
          {STEPS[2].title}
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          Import and render — no provider, no context setup. This exact code is what runs in the
          “Your app so far” preview: type your name there and say hello.
        </p>
        <div class="mt-6">
          <CodeExample title="Hello world" code={firstComponentExample} preview={false} />
        </div>
      </section>

      <!-- 04 · Make it yours -->
      <section id={STEPS[3].id} class="border-border-subtle border-t pt-12">
        <h2 class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight">
          <span class="text-primary text-5xl font-medium leading-none" aria-hidden="true">
            {STEPS[3].n}
          </span>
          {STEPS[3].title}
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          Every component reads semantic tokens, so theming means overriding custom properties in
          Tailwind’s
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >@theme</code
          >
          — no component needs to know. The preview’s four paints are this site’s own room colours; flip
          one and watch every component follow. In your codebase, it’s one line:
        </p>
        <div class="mt-6">
          <CodeExample title="Custom theme" code={themeExample} language="css" preview={false} />
        </div>
      </section>
    </div>

    <!-- ── "Your app so far" — the growing preview ────────────────────────
         Sticky companion on lg+; below lg it stacks after the steps as the
         finished, playable result. Fixed cream artboard (color-scheme: light)
         so the specimen reads identically in docs light and dark — the
         repaint mixes against constants, exactly like the landing cards. -->
    <aside
      class="lg:sticky lg:top-[calc(var(--sidebar-layout-header-h)+2.5rem)]"
      aria-label="Your app so far — live preview"
    >
      <div
        class="poster-card room-accent border-border-default border p-6"
        style="--room-accent: {paint.accent}; --room-accent-fg: {paint.fg}; color-scheme: light"
      >
        <p
          class="font-meta border-border-hairline flex items-baseline justify-between border-b pb-3"
        >
          <span class="text-text-primary">Your app so far</span>
          <span>step {activeStep} / 4</span>
        </p>

        <div class="flex min-h-[17rem] flex-col">
          {#if activeStep === 1}
            <!-- 01 — installed, nothing rendered -->
            <div
              class="border-border-default mt-5 grid flex-1 place-items-center border border-dashed p-6"
            >
              <div class="font-meta text-center leading-relaxed">
                <p class="text-text-primary">+ @urbicon-ui/blocks</p>
                <p class="mt-3">installed — nothing on screen yet.</p>
                <p>that’s the point.</p>
              </div>
            </div>
          {:else if activeStep === 2}
            <!-- 02 — tokens loaded, still no components -->
            <div class="mt-5 flex flex-1 flex-col justify-between gap-5">
              <div>
                <p class="font-meta">--color-primary-50 … 950</p>
                <div class="mt-2">
                  {@render rampStrip('h-8')}
                </div>
              </div>
              <div>
                <p class="font-meta">--color-surface-base · elevated · quiet</p>
                <div class="mt-2 flex gap-2" aria-hidden="true">
                  <div class="bg-surface-base border-border-default h-8 flex-1 border"></div>
                  <div class="bg-surface-elevated border-border-default h-8 flex-1 border"></div>
                  <div class="bg-surface-quiet border-border-default h-8 flex-1 border"></div>
                </div>
              </div>
              <div>
                <p class="font-meta">--color-text-primary · secondary · tertiary</p>
                <p class="mt-2 text-sm">
                  <span class="text-text-primary font-semibold">The quick</span>
                  <span class="text-text-secondary">brown fox</span>
                  <span class="text-text-tertiary">jumps over</span>
                </p>
              </div>
              <p class="font-meta">tokens loaded — still no components.</p>
            </div>
          {:else}
            <!-- 03/04 — the live hello-world; the ramp shrinks to a strip:
                 the tokens now sit under the app -->
            <div class="mt-5">
              {@render rampStrip('h-1.5')}
            </div>
            <div class="mt-5 flex flex-1 flex-col gap-4">
              <Input label="Your name" bind:value={demoName} placeholder="Ada" />
              <div>
                <Button intent="primary" onclick={() => (demoGreeted = true)} disabled={!demoName}>
                  Say hello
                </Button>
              </div>
              {#if demoGreeted && demoName}
                <div>
                  <Badge intent="success">Hello {demoName}!</Badge>
                </div>
              {/if}
            </div>

            {#if activeStep === 4}
              <!-- 04 — the reader repaints the preview -->
              <div class="border-border-hairline mt-6 border-t pt-4">
                <p class="font-meta flex items-baseline justify-between">
                  <span>repaint</span>
                  <span>{paint.accent}</span>
                </p>
                <div class="mt-3 flex gap-2.5">
                  {#each PAINTS as p (p.accent)}
                    <button
                      type="button"
                      aria-label="Repaint in {p.name}"
                      aria-pressed={p.accent === paint.accent}
                      onclick={() => (paint = p)}
                      class="h-11 w-11 border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17150f] lg:h-9 lg:w-9"
                      style="background: {p.accent}; border-color: {p.accent === paint.accent
                        ? '#17150f'
                        : 'transparent'}"
                    ></button>
                  {/each}
                </div>
                <p class="font-meta mt-3">one decision — every component follows.</p>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </aside>
  </div>

  <!-- Next steps — three-link footer instead of a card grid -->
  <footer class="border-border-subtle mt-16 border-t pt-8">
    <p class="meta-marker text-text-tertiary text-xs font-medium tracking-wider uppercase">Next</p>
    <div class="mt-4 flex flex-wrap gap-x-10 gap-y-3">
      <a
        href={resolve('/blocks')}
        class="group text-text-primary hover:text-primary inline-flex items-center gap-1.5 font-medium transition-colors"
      >
        Browse the components
        <ArrowRightIcon class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </a>
      <a
        href={resolve('/customization/tokens')}
        class="group text-text-primary hover:text-primary inline-flex items-center gap-1.5 font-medium transition-colors"
      >
        The token system
        <ArrowRightIcon class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </a>
      <a
        href={resolve('/ai')}
        class="group text-text-primary hover:text-primary inline-flex items-center gap-1.5 font-medium transition-colors"
      >
        Set up your AI tooling
        <ArrowRightIcon class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </a>
    </div>
  </footer>
</div>
