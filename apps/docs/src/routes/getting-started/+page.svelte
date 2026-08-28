<!--
  Getting started — five steps (install → tokens → component → theme → agent)
  beside a sticky preview card that grows with each one.

  Steps 00–02 are a FORK, not a sequence: the sv add-on does all three in one
  command, so 00 is the greenfield path (`sv create` needs an empty directory)
  and 01 opens with the brownfield form. The manual steps stay in full — they
  are what a reader needs in order to change what the add-on did, and the
  card's choreography hangs off them. The add-on is also the only
  SvelteKit-bound piece (the library imports neither `$app/*` nor
  `@sveltejs/kit`), which is why 00 closes by pointing non-Kit readers at the
  manual fork.

  00 sits outside the STEPS scrollspy on purpose: there is no app to preview
  yet, and readers already inside a SvelteKit project skip it.

  The preview card reuses the landing's .poster-card + .room-accent from
  $lib/style/rooms.css (imported here too; Vite dedupes): a fixed cream+ink
  artboard whose primary-derived token family re-resolves from the inline
  --room-accent, so the real library components repaint live.
-->
<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { ArrowRightIcon, Badge, Button, Input, Select } from '@urbicon-ui/blocks';
  import { CodeExample, ScrollSpy } from '@urbicon-ui/docs';
  import { CHANNELS, FAMILY_CHANNEL } from '$lib/landing/channels';
  import '$lib/style/rooms.css';

  // ── The five steps — ids feed the scrollspy, numerals the poster marks ──
  const STEPS = [
    { id: 'install', n: '01', title: 'Install' },
    { id: 'tokens', n: '02', title: 'Import the tokens' },
    { id: 'first-component', n: '03', title: 'Your first component' },
    { id: 'theme', n: '04', title: 'Make it yours' },
    { id: 'agent', n: '05', title: 'Bring your agent' }
  ] as const;

  const spy = new ScrollSpy(() => STEPS.map((step) => step.id));
  // Before the first section crosses the trigger line spy.active is '' →
  // findIndex -1 → clamp to step 1, so the card never shows "step 0".
  const activeStep = $derived(Math.max(1, STEPS.findIndex((step) => step.id === spy.active) + 1));
  // Monotonic latch: scrolling back up — or the focus jiggle from clicking
  // INTO the card — must never un-build the app the reader has built.
  let reachedStep = $state(1);
  $effect(() => {
    if (activeStep > reachedStep) reachedStep = activeStep;
  });

  // ── Step 04 paints — four of the docs' own room colours ──
  // Straight from the channel register, so a swatch here and the header field
  // of the matching component page are literally the same paint. Four of the
  // eleven, spread across the wheel: this is a demo of repainting, not the
  // room index (that one lives on /customization/rooms-theme).
  const FAMILY_OF = Object.fromEntries(
    Object.entries(FAMILY_CHANNEL).map(([family, channel]) => [channel, family])
  ) as Record<string, string>;
  const PAINTS = (['orange', 'teal', 'blue', 'magenta'] as const).map((name) => ({
    name: `${FAMILY_OF[name]} ${name}`,
    accent: CHANNELS[name].accent,
    fg: CHANNELS[name].accentOn
  }));
  let paint = $state(PAINTS[0]);

  // ── Live mini-booking state (steps 03/04 in the preview card) ──
  // Same fiction as the landing tiles: Fermata, the hotel group. The card
  // runs EXACTLY the code shown in step 03 — the options live here once so
  // the snippet and the live demo cannot drift apart in content.
  const DEMO_ROOMS = [
    { label: 'Garden Room — €300', value: 'garden' },
    { label: 'Corner Room — €360', value: 'corner' }
  ];
  let demoName = $state('');
  let demoRoom = $state<string | null>('garden');
  let demoBooked = $state(false);

  const createProjectExample = `bunx sv create my-app --add @urbicon-ui`;

  // Derselbe Add-on-Pfad für ein bestehendes Projekt. Steht in 01 statt in 00,
  // weil 00 „No project yet?" heißt: `sv create` will ein leeres Verzeichnis.
  const addAddonExample = `bunx sv add @urbicon-ui`;

  const installExample = `bun add @urbicon-ui/blocks`;

  const basicSetupExample = `/* app.css */
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css';`;

  // Kit-Form, weil die Seite mit `sv create` einsteigt. Ohne SvelteKit ist es
  // dieselbe Datei mit svelte() statt sveltekit() — die Zeile steht im Snippet,
  // damit ein Nicht-Kit-Leser sie nicht falsch abschreibt.
  const viteConfigExample = `// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
// no SvelteKit? swap it for svelte()
// from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [tailwindcss(), sveltekit()]
};`;

  const firstComponentExample =
    `<script>
  import { Badge, Button, Input, Select } from '@urbicon-ui/blocks';

  let name = $state('');
  let room = $state('garden');
  let booked = $state(false);
</scr` +
    `ipt>

<Input label="Your name" bind:value={name} placeholder="Ada" />

<Select
  label="Room"
  options={[
    { label: 'Garden Room — €300', value: 'garden' },
    { label: 'Corner Room — €360', value: 'corner' }
  ]}
  bind:value={room}
/>

<Button intent="primary" onclick={() => (booked = true)} disabled={!name}>
  Reserve
</Button>

{#if booked && name}
  <Badge intent="success">Booked — see you in September, {name}.</Badge>
{/if}`;

  const agentExample = `bunx urbicon init`;

  const themeExample = `/* app.css */
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css';

@theme {
  /* Override the primary ramp — every component follows it */
  --color-primary-500: oklch(0.64 0.16 40); /* warm terracotta */
}`;
</script>

<!-- urbicon-ignore arbitrary-color — the ink literal belongs to the cream
     artboard, which pins `color-scheme: light` on purpose (see the comment at
     the artboard) and carries its own two-colour palette through
     `--room-accent`. A semantic surface token there would pull in the site
     chassis the artboard exists to step outside of. -->

<SeoMeta
  title="Getting Started"
  description="Install Urbicon UI, import the design tokens, render your first component, theme it and onboard your AI agent — five steps with a live preview that grows as you go. Svelte 5 + Tailwind 4."
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
      Getting started — install · tokens · component · theme · agent
    </p>
    <h1 class="text-text-primary mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
      Getting started
    </h1>
    <p class="text-text-secondary mt-4 max-w-2xl text-lg">
      Five steps from an empty file to a themed app your agent can keep building. The “Your app so
      far” preview grows with every step — by step 04, you repaint it yourself.
    </p>
    <p class="font-meta mt-6">
      requires svelte 5 · tailwind css 4 · node 18+ or bun 1+ · typescript recommended
    </p>
  </div>
</div>

<div class="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 lg:px-8">
  <div class="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-14">
    <!-- ── The four steps ─────────────────────────────────────────────── -->
    <!--
      Hand-rolled `<section>` + `<h2>` here, not `<Section>`, and on purpose.
      The step number is the page: a 5xl numeral baseline-aligned against a 2xl
      title, one rule per step. `Section`'s `marker` renders a small inline
      marker, which is a different idea — the five prose pages under
      /customization moved onto `Section` in this same pass precisely because
      their headings had no such design behind them.
    -->
    <div>
      <!-- 00 · No project yet? — optional pre-step, outside STEPS (see head
           comment): no scrollspy id, no effect on the preview card. -->
      <section aria-labelledby="prestep-title" class="pb-12">
        <h2
          id="prestep-title"
          class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight"
        >
          <span class="text-primary text-5xl leading-none font-medium" aria-hidden="true">00</span>
          No project yet?
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          Starting from an empty directory, the official
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs">sv</code>
          CLI scaffolds a SvelteKit app — it asks its own questions (TypeScript, Prettier, …), and
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >--add @urbicon-ui</code
          >
          hands the rest to our add-on: it pulls in Tailwind, installs the library and the
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >urbicon</code
          >
          CLI, and writes the stylesheet import for you.
        </p>
        <div class="mt-6">
          <CodeExample
            title="Create a SvelteKit project"
            code={createProjectExample}
            language="bash"
            preview={false}
          />
        </div>
        <!-- Der Sprung setzt die Karten-Latch (reachedStep) direkt auf 3 —
             gewollt: wer 01/02 überspringt, hat die zwei Schritte ja hinter
             sich, und die Latch geht ohnehin nie zurück (siehe Kopfkommentar).
             Danach 01 nachzulesen zeigt die Karte auf „step 3 / 5"; das ist
             die bewusste Abwägung der Latch, kein Fehler des Links. -->
        <p class="text-text-secondary mt-6 max-w-2xl leading-relaxed">
          That covers steps 01 and 02 — jump straight to
          <a href="#first-component" class="text-primary font-medium hover:underline"
            >your first component</a
          >, or read on to see what the add-on did. Inside an existing project, start at 01.
        </p>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          Not a SvelteKit project? The components don&rsquo;t need one — they import neither
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >$app/*</code
          >
          nor
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >@sveltejs/kit</code
          >, so any Svelte 5 project with Vite and Tailwind 4 works. The add-on is the
          SvelteKit-only piece; steps 01 and 02 below are the whole setup by hand.
        </p>
      </section>

      <!-- 01 · Install -->
      <section
        id={STEPS[0].id}
        aria-labelledby="{STEPS[0].id}-title"
        class="border-border-subtle border-t py-12"
      >
        <h2
          id="{STEPS[0].id}-title"
          class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight"
        >
          <span class="text-primary text-5xl leading-none font-medium" aria-hidden="true">
            {STEPS[0].n}
          </span>
          {STEPS[0].title}
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          Already inside a SvelteKit project? The same add-on runs there too, and does this step and
          the next one in one go:
        </p>
        <div class="mt-6">
          <CodeExample
            title="Add Urbicon UI to an existing project"
            code={addAddonExample}
            language="bash"
            preview={false}
          />
        </div>
        <p class="text-text-secondary mt-6 max-w-2xl leading-relaxed">
          By hand it is one package with zero runtime dependencies: compiled Svelte plus a CSS token
          file. Only what you import ends up in your bundle, and any package manager works.
        </p>
        <div class="mt-4">
          <CodeExample
            title="Install Urbicon UI"
            code={installExample}
            language="bash"
            preview={false}
          />
        </div>
      </section>

      <!-- 02 · Import the tokens -->
      <section
        id={STEPS[1].id}
        aria-labelledby="{STEPS[1].id}-title"
        class="border-border-subtle border-t py-12"
      >
        <h2
          id="{STEPS[1].id}-title"
          class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight"
        >
          <span class="text-primary text-5xl leading-none font-medium" aria-hidden="true">
            {STEPS[1].n}
          </span>
          {STEPS[1].title}
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          On the add-on path this is already done — read it to know what is in your project. The
          design system arrives as CSS, and Tailwind 4 does the plumbing, so if Tailwind isn’t part
          of your project yet, add the Vite plugin first (already there? skip ahead):
        </p>
        <div class="mt-6">
          <CodeExample
            title="Vite config"
            code={viteConfigExample}
            language="javascript"
            preview={false}
          />
        </div>
        <p class="text-text-secondary mt-6 max-w-2xl leading-relaxed">
          Then two imports: Tailwind, and the token sheet — OKLCH color ramps, semantic tokens,
          typography, spacing, and dark mode via
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >light-dark()</code
          >. The blocks stylesheet brings its own
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >@source</code
          >
          directives, so Tailwind finds the components&rsquo; classes without extra config. Every further
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >@urbicon-ui/*</code
          >
          package that ships components has a stylesheet of its own (its
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >@source</code
          >
          only, no tokens) — import it after blocks, or that package&rsquo;s markup renders unstyled with
          no error;
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >bunx urbicon init</code
          >
          prints the import list for what you have installed. Load the file once, wherever your app loads
          CSS:
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >import './app.css'</code
          >
          in
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >+layout.svelte</code
          >
          for SvelteKit, in your entry module
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >src/main.js</code
          >
          for plain Vite + Svelte:
        </p>
        <div class="mt-4">
          <CodeExample
            title="Import CSS tokens"
            code={basicSetupExample}
            language="css"
            preview={false}
          />
        </div>
      </section>

      <!-- 03 · Your first component -->
      <section
        id={STEPS[2].id}
        aria-labelledby="{STEPS[2].id}-title"
        class="border-border-subtle border-t py-12"
      >
        <h2
          id="{STEPS[2].id}-title"
          class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight"
        >
          <span class="text-primary text-5xl leading-none font-medium" aria-hidden="true">
            {STEPS[2].n}
          </span>
          {STEPS[2].title}
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          Import and render — no provider, no context setup. This is the booking widget from
          Fermata, the quiet hotel group every demo on this site runs on, and it’s three components
          speaking one grammar:
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >label</code
          >,
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >bind:value</code
          >
          and
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >intent</code
          >
          mean the same thing everywhere. The exact same code runs live in the “Your app so far” preview
          — book yourself a night.
        </p>
        <div class="mt-6">
          <CodeExample title="Book a stay" code={firstComponentExample} preview={false} />
        </div>
      </section>

      <!-- 04 · Make it yours -->
      <section
        id={STEPS[3].id}
        aria-labelledby="{STEPS[3].id}-title"
        class="border-border-subtle border-t py-12"
      >
        <h2
          id="{STEPS[3].id}-title"
          class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight"
        >
          <span class="text-primary text-5xl leading-none font-medium" aria-hidden="true">
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
          — no component needs to know. The preview’s four paints are this site’s own room colours, one
          per component family; flip one and watch every component follow. In your codebase it is a declaration
          in your own stylesheet:
        </p>
        <div class="mt-6">
          <CodeExample title="Custom theme" code={themeExample} language="css" preview={false} />
        </div>
      </section>

      <!-- 05 · Bring your agent — the landing's second install command,
           mirrored here so both entry points tell the same story. -->
      <section
        id={STEPS[4].id}
        aria-labelledby="{STEPS[4].id}-title"
        class="border-border-subtle border-t pt-12"
      >
        <h2
          id="{STEPS[4].id}-title"
          class="text-text-primary flex items-baseline gap-4 text-2xl font-bold tracking-tight"
        >
          <span class="text-primary text-5xl leading-none font-medium" aria-hidden="true">
            {STEPS[4].n}
          </span>
          {STEPS[4].title}
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl leading-relaxed">
          One command writes the AGENTS.md block: the component grammar, the token rules, where to
          look things up. With
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >--hook</code
          >
          /
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >--ci</code
          >
          the design gate arms too, and every file your agent writes is linted against the library&rsquo;s
          own rules before it ships. The add-on already installed
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >@urbicon-ui/design</code
          >; by hand, add it once (<code
            class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >bun add -d @urbicon-ui/design</code
          >) so the knowledge the CLI serves stays pinned to the library version you installed.
        </p>
        <div class="mt-6">
          <CodeExample
            title="Onboard your agent"
            code={agentExample}
            language="bash"
            preview={false}
          />
        </div>
        <p class="text-text-secondary mt-6 max-w-2xl leading-relaxed">
          What the gate checks, and the rest of the toolchain — per-component
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >llms.txt</code
          >, the
          <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
            >urbicon</code
          >
          CLI — lives on
          <a href={resolve('/ai')} class="text-primary font-medium hover:underline">AI &amp; DX</a>.
        </p>
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
          <span>step {reachedStep} / 5</span>
        </p>

        <div class="flex min-h-[17rem] flex-col">
          {#if reachedStep === 1}
            <!-- 01 — installed, nothing rendered -->
            <div
              class="border-border-default mt-5 grid flex-1 place-items-center border border-dashed p-6"
            >
              <div class="font-meta text-center leading-relaxed">
                <p class="text-text-primary">+ @urbicon-ui/blocks</p>
                <p class="mt-3">installed — nothing on screen yet.</p>
                <p>that’s the point.</p>
                <p class="mt-3">(by step 04 you’ll repaint this card.)</p>
              </div>
            </div>
          {:else if reachedStep === 2}
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
            <!-- 03+ — the live mini-booking; the ramp shrinks to a strip:
                 the tokens now sit under the app -->
            <div class="mt-5">
              {@render rampStrip('h-1.5')}
            </div>
            <div class="mt-5 flex flex-1 flex-col gap-4">
              <Input label="Your name" bind:value={demoName} placeholder="Ada" />
              <Select label="Room" options={DEMO_ROOMS} bind:value={demoRoom} />
              <div>
                <Button intent="primary" onclick={() => (demoBooked = true)} disabled={!demoName}>
                  Reserve
                </Button>
              </div>
              {#if demoBooked && demoName}
                <div>
                  <Badge intent="success">Booked — see you in September, {demoName}.</Badge>
                </div>
              {/if}
            </div>

            {#if reachedStep >= 4}
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

            {#if reachedStep >= 5}
              <!-- 05 — the agent is onboarded; quiet, mono, a receipt not a banner -->
              <div class="border-border-hairline mt-4 border-t pt-3">
                <p class="font-meta flex items-baseline justify-between">
                  <span>agent</span>
                  <span>AGENTS.md written · agent onboarded ✓</span>
                </p>
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
