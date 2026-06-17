<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Button, Badge, Card } from '@urbicon-ui/blocks';
  import { CodeExample } from '@urbicon-ui/docs';

  const installExample = `bun add @urbicon-ui/blocks`;

  const basicSetupExample = `/* app.css */
@import '@urbicon-ui/blocks/style/index.css';

/* Your custom styles here */`;

  const firstComponentExample =
    `<script>
  import { Button, Input, Badge } from '@urbicon-ui/blocks';
  
  let name = $state('');
</scr` +
    `ipt>

<div class="space-y-4">
  <Input 
    label="Your name" 
    bind:value={name} 
    placeholder="Enter your name" 
  />
  
  <Button onclick={() => alert(\`Hello \${name}!\`)}>
    Say Hello
  </Button>
  
  {#if name}
    <Badge intent="success">Welcome {name}!</Badge>
  {/if}
</div>`;

  const _svelteConfigExample = `// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: [vitePreprocess()],
  // ... other config
};`;

  const viteConfigExample = `// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [tailwindcss(), sveltekit()]
};`;

  const themeCustomizationExample = `/* app.css */
@import '@urbicon-ui/blocks/style/index.css';

@theme {
  /* Override default colors */
  --color-primary-500: oklch(0.6 0.2 280); /* Purple primary */
  --color-success-500: oklch(0.7 0.15 140); /* Custom green */
  
  /* Add custom colors */
  --color-brand-500: oklch(0.5 0.25 45); /* Orange brand color */
}

/* Custom component styles */
.my-custom-button {
  background: var(--color-brand-500);
  border-radius: var(--radius-xl);
}`;

  let demoName = $state('');
</script>

<SeoMeta
  title="Getting Started"
  description="Get started with Urbicon UI - installation, setup, and your first components. Built with Svelte 5 and Tailwind 4."
/>

<div class="mx-auto max-w-4xl px-6 py-12">
  <!-- Header -->
  <div class="mb-12">
    <h1 class="mb-4 text-4xl font-bold text-slate-900 dark:text-white">Getting Started</h1>
    <p class="text-xl text-slate-600 dark:text-slate-300">
      Get up and running with Urbicon UI in minutes. This guide covers installation, basic setup,
      and creating your first components.
    </p>
  </div>

  <!-- Prerequisites -->
  <section class="mb-12">
    <h2 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Prerequisites</h2>

    <div
      class="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20"
    >
      <h3 class="mb-3 font-semibold text-amber-900 dark:text-amber-100">Requirements</h3>
      <ul class="space-y-2 text-amber-800 dark:text-amber-200">
        <li>• <strong>Svelte 5.0+</strong> with runes support</li>
        <li>• <strong>Tailwind CSS 4.0+</strong> for styling</li>
        <li>• <strong>TypeScript</strong> (recommended)</li>
        <li>• <strong>Node.js 18+</strong> or <strong>Bun 1.0+</strong></li>
      </ul>
    </div>
  </section>

  <!-- Installation -->
  <section class="mb-12">
    <h2 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Installation</h2>

    <CodeExample title="Install Urbicon UI" code={installExample} language="bash" preview={false} />

    <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card padding="md">
        <h3 class="mb-2 font-semibold">📦 Package Managers</h3>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Works with npm, yarn, pnpm, and bun
        </p>
      </Card>
      <Card padding="md">
        <h3 class="mb-2 font-semibold">🌳 Tree Shaking</h3>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Only import what you use (~90% efficiency)
        </p>
      </Card>
    </div>
  </section>

  <!-- Basic Setup -->
  <section class="mb-12">
    <h2 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Basic Setup</h2>

    <div class="space-y-6">
      <div>
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          1. Import Design Tokens
        </h3>
        <CodeExample
          title="Import CSS Tokens"
          code={basicSetupExample}
          language="css"
          preview={false}
        />
      </div>

      <div>
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          2. Configure Tailwind (if not already setup)
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
  <section class="mb-12">
    <h2 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Your First Component</h2>

    <CodeExample title="Hello World Example" code={firstComponentExample}>
      <div class="w-full max-w-sm space-y-4">
        <div>
          <label
            for="demoName"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >Your name</label
          >
          <input
            id="demoName"
            bind:value={demoName}
            placeholder="Enter your name"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <Button onclick={() => alert(`Hello ${demoName}!`)}>Say Hello</Button>

        {#if demoName}
          <Badge intent="success">Welcome {demoName}!</Badge>
        {/if}
      </div>
    </CodeExample>
  </section>

  <!-- Theme Customization -->
  <section class="mb-12">
    <h2 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Theme Customization</h2>

    <p class="mb-6 text-slate-600 dark:text-slate-300">
      Urbicon UI uses Tailwind 4's new <code
        class="rounded bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">@theme</code
      >
      directive for easy customization. Override design tokens to match your brand.
    </p>

    <CodeExample
      title="Custom Theme"
      code={themeCustomizationExample}
      language="css"
      preview={false}
    />
  </section>

  <!-- Next Steps -->
  <section class="mb-12">
    <h2 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Next Steps</h2>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card href={resolve('/blocks')} class="group h-full">
        <h3
          class="mb-2 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white"
        >
          Explore Components
        </h3>
        <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Browse all available components with live examples and detailed API documentation.
        </p>
        <div class="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
          View Components
          <svg
            class="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </Card>

      <Card href={resolve('/customization/tokens')} class="group h-full">
        <h3
          class="mb-2 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white"
        >
          Design Tokens
        </h3>
        <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Learn about the comprehensive design token system for colors, typography, and spacing.
        </p>
        <div class="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
          View Tokens
          <svg
            class="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </Card>

      <Card>
        <h3 class="mb-2 font-semibold text-slate-900 dark:text-white">Need Help?</h3>
        <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Browse the source and report issues on Codeberg, or point your AI tooling at the llms.txt
          reference and MCP server.
        </p>
        <div class="flex gap-2">
          <a href="https://codeberg.org/urbicon/ui">
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
  <section class="mb-12">
    <h2 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Performance Tips</h2>

    <div class="space-y-4">
      <Card
        padding="md"
        class="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
      >
        <h3 class="mb-2 font-semibold text-green-900 dark:text-green-100">
          ✅ Import only what you need
        </h3>
        <p class="text-sm text-green-800 dark:text-green-200">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <code>{@html `import { Button, Input } from '@urbicon-ui/blocks'`}</code> instead of importing
          everything.
        </p>
      </Card>

      <Card
        padding="md"
        class="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
      >
        <h3 class="mb-2 font-semibold text-green-900 dark:text-green-100">✅ Use design tokens</h3>
        <p class="text-sm text-green-800 dark:text-green-200">
          Leverage CSS custom properties for consistent theming and better performance.
        </p>
      </Card>

      <Card
        padding="md"
        class="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
      >
        <h3 class="mb-2 font-semibold text-green-900 dark:text-green-100">
          ✅ Progressive enhancement
        </h3>
        <p class="text-sm text-green-800 dark:text-green-200">
          Start with simple components and add complexity only when needed.
        </p>
      </Card>
    </div>
  </section>
</div>
