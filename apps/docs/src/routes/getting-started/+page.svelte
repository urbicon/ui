<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { REPO_URL } from '$lib/seo';
  import { ArrowRightIcon, Badge, Button, Card, CheckCircleIcon, Input } from '@urbicon-ui/blocks';
  import { CodeExample } from '@urbicon-ui/docs';

  const installExample = `bun add @urbicon-ui/blocks`;

  const basicSetupExample = `/* app.css */
@import '@urbicon-ui/blocks/style/index.css';

/* Your custom styles here */`;

  const firstComponentExample =
    `<script>
  import { Button, Input, Badge } from '@urbicon-ui/blocks';

  let name = $state('');
  let greeted = $state(false);
</scr` +
    `ipt>

<div class="space-y-4">
  <Input label="Your name" bind:value={name} placeholder="Enter your name" />

  <Button onclick={() => (greeted = true)} disabled={!name}>
    Say hello
  </Button>

  {#if greeted && name}
    <Badge intent="success">Hello {name}!</Badge>
  {/if}
</div>`;

  const viteConfigExample = `// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [tailwindcss(), sveltekit()]
};`;

  const themeCustomizationExample = `/* app.css */
@import '@urbicon-ui/blocks/style/index.css';

@theme {
  /* Override the primary ramp — every component follows it */
  --color-primary-500: oklch(0.64 0.16 40); /* warm terracotta */

  /* Add a custom color of your own */
  --color-brand-500: oklch(0.55 0.13 250);
}

/* Custom component styles */
.my-custom-button {
  background: var(--color-brand-500);
  border-radius: var(--radius-xl);
}`;

  let demoName = $state('');
  let demoGreeted = $state(false);
</script>

<SeoMeta
  title="Getting Started"
  description="Get started with Urbicon UI - installation, setup, and your first components. Built with Svelte 5 and Tailwind 4."
/>

<div class="mx-auto max-w-4xl px-6 py-12">
  <!-- Header -->
  <div class="mb-14">
    <p class="meta-marker">Getting started — install · setup · first component</p>
    <h1 class="text-text-primary mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
      Getting started<span class="pipe" aria-hidden="true">|</span>
    </h1>
    <p class="text-text-secondary mt-4 max-w-2xl text-lg">
      Get up and running with Urbicon&nbsp;UI in minutes. This guide covers installation, basic
      setup, and creating your first components.
    </p>
  </div>

  <!-- Prerequisites -->
  <section class="mb-14">
    <h2 class="text-text-primary mb-6 text-2xl font-bold tracking-tight">
      Prerequisites<span class="pipe" aria-hidden="true">|</span>
    </h2>

    <div
      class="border-border-subtle bg-surface-elevated rounded-[var(--docs-radius-card,1rem)] border p-6"
    >
      <p class="meta-marker">Requirements</p>
      <ul class="text-text-secondary mt-4 space-y-2.5 text-sm">
        <li class="flex gap-2.5">
          <span class="text-primary" aria-hidden="true">·</span>
          <span
            ><strong class="text-text-primary font-semibold">Svelte 5.0+</strong> with runes support</span
          >
        </li>
        <li class="flex gap-2.5">
          <span class="text-primary" aria-hidden="true">·</span>
          <span
            ><strong class="text-text-primary font-semibold">Tailwind CSS 4.0+</strong> for styling</span
          >
        </li>
        <li class="flex gap-2.5">
          <span class="text-primary" aria-hidden="true">·</span>
          <span
            ><strong class="text-text-primary font-semibold">TypeScript</strong> (recommended)</span
          >
        </li>
        <li class="flex gap-2.5">
          <span class="text-primary" aria-hidden="true">·</span>
          <span
            ><strong class="text-text-primary font-semibold">Node.js 18+</strong> or
            <strong class="text-text-primary font-semibold">Bun 1.0+</strong></span
          >
        </li>
      </ul>
    </div>
  </section>

  <!-- Installation -->
  <section class="mb-14">
    <h2 class="text-text-primary mb-6 text-2xl font-bold tracking-tight">
      Installation<span class="pipe" aria-hidden="true">|</span>
    </h2>

    <CodeExample title="Install Urbicon UI" code={installExample} language="bash" preview={false} />

    <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div
        class="border-border-subtle bg-surface-elevated rounded-[var(--docs-radius-card,1rem)] border p-5"
      >
        <h3 class="text-text-primary font-semibold">Package managers</h3>
        <p class="text-text-secondary mt-1.5 text-sm leading-relaxed">
          Works with npm, yarn, pnpm and bun.
        </p>
      </div>
      <div
        class="border-border-subtle bg-surface-elevated rounded-[var(--docs-radius-card,1rem)] border p-5"
      >
        <h3 class="text-text-primary font-semibold">Tree shaking</h3>
        <p class="text-text-secondary mt-1.5 text-sm leading-relaxed">
          Only import what you use — nothing else ships.
        </p>
      </div>
    </div>
  </section>

  <!-- Basic Setup -->
  <section class="mb-14">
    <h2 class="text-text-primary mb-6 text-2xl font-bold tracking-tight">
      Basic setup<span class="pipe" aria-hidden="true">|</span>
    </h2>

    <div class="space-y-6">
      <div>
        <h3 class="text-text-primary mb-3 text-lg font-semibold">1. Import design tokens</h3>
        <CodeExample
          title="Import CSS Tokens"
          code={basicSetupExample}
          language="css"
          preview={false}
        />
      </div>

      <div>
        <h3 class="text-text-primary mb-3 text-lg font-semibold">
          2. Configure Tailwind (if not already set up)
        </h3>
        <CodeExample
          title="Vite Config"
          code={viteConfigExample}
          language="javascript"
          preview={false}
        />
      </div>
    </div>
  </section>

  <!-- First Component -->
  <section class="mb-14">
    <h2 class="text-text-primary mb-6 text-2xl font-bold tracking-tight">
      Your first component<span class="pipe" aria-hidden="true">|</span>
    </h2>

    <CodeExample title="Hello world" code={firstComponentExample}>
      <div class="w-full max-w-sm space-y-4">
        <Input label="Your name" bind:value={demoName} placeholder="Enter your name" />

        <Button onclick={() => (demoGreeted = true)} disabled={!demoName}>Say hello</Button>

        {#if demoGreeted && demoName}
          <Badge intent="success">Hello {demoName}!</Badge>
        {/if}
      </div>
    </CodeExample>
  </section>

  <!-- Theme Customization -->
  <section class="mb-14">
    <h2 class="text-text-primary mb-6 text-2xl font-bold tracking-tight">
      Theme customization<span class="pipe" aria-hidden="true">|</span>
    </h2>

    <p class="text-text-secondary mb-6 max-w-2xl leading-relaxed">
      Urbicon UI uses Tailwind 4's
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs">@theme</code>
      directive for customization. Override design tokens to match your brand — every component follows
      them automatically.
    </p>

    <CodeExample
      title="Custom Theme"
      code={themeCustomizationExample}
      language="css"
      preview={false}
    />
  </section>

  <!-- Next Steps -->
  <section class="mb-14">
    <h2 class="text-text-primary mb-6 text-2xl font-bold tracking-tight">
      Next steps<span class="pipe" aria-hidden="true">|</span>
    </h2>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card href={resolve('/blocks')} class="group h-full">
        <h3 class="text-text-primary group-hover:text-primary mb-2 font-semibold transition-colors">
          Explore components
        </h3>
        <p class="text-text-secondary mb-4 text-sm leading-relaxed">
          Browse all available components with live examples and detailed API documentation.
        </p>
        <span
          class="text-text-tertiary group-hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          View components
          <ArrowRightIcon class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Card>

      <Card href={resolve('/customization/tokens')} class="group h-full">
        <h3 class="text-text-primary group-hover:text-primary mb-2 font-semibold transition-colors">
          Design tokens
        </h3>
        <p class="text-text-secondary mb-4 text-sm leading-relaxed">
          Learn about the comprehensive design token system for colors, typography and spacing.
        </p>
        <span
          class="text-text-tertiary group-hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          View tokens
          <ArrowRightIcon class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Card>

      <Card class="h-full md:col-span-2">
        <h3 class="text-text-primary mb-2 font-semibold">Need help?</h3>
        <p class="text-text-secondary mb-4 text-sm leading-relaxed">
          Browse the source and report issues on Codeberg, or point your AI tooling at the llms.txt
          reference and MCP server.
        </p>
        <div class="flex gap-2">
          <a href={REPO_URL} target="_blank" rel="noopener">
            <Badge variant="soft" intent="primary">Codeberg</Badge>
          </a>
          <a href={resolve('/ai')}>
            <Badge variant="soft" intent="secondary">AI Tooling</Badge>
          </a>
        </div>
      </Card>
    </div>
  </section>

  <!-- Performance Tips -->
  <section class="mb-4">
    <h2 class="text-text-primary mb-6 text-2xl font-bold tracking-tight">
      Performance tips<span class="pipe" aria-hidden="true">|</span>
    </h2>

    <div class="space-y-3">
      <div
        class="border-border-subtle bg-surface-elevated flex gap-3 rounded-[var(--docs-radius-card,1rem)] border p-5"
      >
        <CheckCircleIcon class="text-success mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h3 class="text-text-primary font-semibold">Import only what you need</h3>
          <p class="text-text-secondary mt-1 text-sm leading-relaxed">
            <code class="bg-surface-base rounded-modify px-1.5 py-0.5 font-mono text-xs"
              >{"import { Button, Input } from '@urbicon-ui/blocks'"}</code
            > instead of importing everything.
          </p>
        </div>
      </div>

      <div
        class="border-border-subtle bg-surface-elevated flex gap-3 rounded-[var(--docs-radius-card,1rem)] border p-5"
      >
        <CheckCircleIcon class="text-success mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h3 class="text-text-primary font-semibold">Use design tokens</h3>
          <p class="text-text-secondary mt-1 text-sm leading-relaxed">
            Leverage CSS custom properties for consistent theming and better performance.
          </p>
        </div>
      </div>

      <div
        class="border-border-subtle bg-surface-elevated flex gap-3 rounded-[var(--docs-radius-card,1rem)] border p-5"
      >
        <CheckCircleIcon class="text-success mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h3 class="text-text-primary font-semibold">Progressive enhancement</h3>
          <p class="text-text-secondary mt-1 text-sm leading-relaxed">
            Start with simple components and add complexity only when needed.
          </p>
        </div>
      </div>
    </div>
  </section>
</div>
