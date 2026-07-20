<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Alert, Button } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let dismissedSoft = $state(false);
  let dismissedInline = $state(false);

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['title', 'variant', 'intent', 'size', 'dismissible'],
        defaults: { variant: 'soft', intent: 'primary', size: 'md' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Alert Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="With Icon"
      description="Use the `icon` snippet to convey intent visually alongside the title and message."
      isolate
      previewClass="flex flex-col gap-3 max-w-lg"
    >
      <Alert intent="success" title="Deployment complete">
        {#snippet icon()}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-5 w-5"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clip-rule="evenodd"
            />
          </svg>
        {/snippet}
        Build #347 deployed to production in 42 seconds.
      </Alert>
      <Alert intent="danger" title="Build failed">
        {#snippet icon()}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-5 w-5"
          >
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clip-rule="evenodd"
            />
          </svg>
        {/snippet}
        TypeScript compilation failed with 3 errors. Check the logs for details.
      </Alert>
    </CodeExample>

    <CodeExample
      title="With Actions"
      description="Alerts can include action buttons for immediate user response."
      isolate
      previewClass="flex flex-col gap-3 max-w-lg"
    >
      <Alert intent="warning" title="Unsaved changes">
        {#snippet icon()}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-5 w-5"
          >
            <path
              fill-rule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clip-rule="evenodd"
            />
          </svg>
        {/snippet}
        You have unsaved changes that will be lost if you navigate away.
        {#snippet actions()}
          <Button size="sm" variant="ghost" intent="warning">Discard</Button>
          <Button size="sm" variant="filled" intent="warning">Save now</Button>
        {/snippet}
      </Alert>
      <Alert intent="danger" variant="inline" title="Delete workspace?">
        This action cannot be undone. All projects and data will be permanently removed.
        {#snippet actions()}
          <Button size="sm" variant="ghost" intent="neutral">Cancel</Button>
          <Button size="sm" variant="filled" intent="danger">Delete</Button>
        {/snippet}
      </Alert>
    </CodeExample>

    <CodeExample
      title="Dismissible"
      description="Click the close button to dismiss – click Reset to bring them back."
      isolate
      previewClass="flex flex-col gap-3 max-w-lg"
    >
      {#if !dismissedSoft}
        <Alert
          intent="primary"
          title="Welcome back!"
          dismissible
          onDismiss={() => (dismissedSoft = true)}
        >
          You have 5 unread notifications since your last visit.
        </Alert>
      {/if}
      {#if !dismissedInline}
        <Alert
          intent="success"
          variant="inline"
          title="Trial activated"
          dismissible
          onDismiss={() => (dismissedInline = true)}
        >
          Your 14-day Pro trial starts now. No credit card required.
        </Alert>
      {/if}
      {#if dismissedSoft || dismissedInline}
        <Button
          size="sm"
          variant="ghost"
          intent="neutral"
          onclick={() => {
            dismissedSoft = false;
            dismissedInline = false;
          }}
        >
          Reset dismissed alerts
        </Button>
      {/if}
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Gradient Banner"
      description="Use slotClasses to create eye-catching promotional banners."
      isolate
      previewClass="flex flex-col gap-3 max-w-lg"
    >
      <Alert
        title="🚀 New: AI Copilot"
        slotClasses={{
          base: 'bg-linear-to-r from-violet-600 to-indigo-600 text-white border-none shadow-lg shadow-violet-500/25',
          title: 'text-white',
          description: 'text-white/85'
        }}
      >
        Intelligent code suggestions powered by your codebase context.
        {#snippet actions()}
          <Button
            unstyled
            class="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30"
          >
            Try it free
          </Button>
        {/snippet}
      </Alert>
      <Alert
        title="🎉 Black Friday"
        slotClasses={{
          base: 'bg-linear-to-r from-amber-500 to-orange-500 text-white border-none shadow-lg shadow-amber-500/25',
          title: 'text-white',
          description: 'text-white/85'
        }}
      >
        50% off all Pro plans. Offer ends Monday.
      </Alert>
    </CodeExample>

    <CodeExample
      title="Glassmorphism"
      description="Translucent alerts over rich backgrounds."
      isolate
      previewClass="flex flex-col gap-3 rounded-xl bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 py-8"
    >
      <Alert
        unstyled
        title="Upload complete"
        class="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-xl"
        slotClasses={{
          title: 'font-semibold text-white',
          description: 'text-sm text-white/75 mt-1'
        }}
      >
        12 files processed successfully.
      </Alert>
      <Alert
        unstyled
        title="Connection lost"
        class="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-xl"
        slotClasses={{
          title: 'font-semibold text-white',
          description: 'text-sm text-white/75 mt-1'
        }}
        dismissible
      >
        Reconnecting automatically…
      </Alert>
    </CodeExample>

    <CodeExample
      title="Terminal / Monospace"
      description="Developer-friendly alerts with a terminal aesthetic."
      isolate
      previewClass="flex flex-col gap-3 max-w-lg"
    >
      <Alert
        unstyled
        class="flex gap-3 rounded-none border-l-4 border-emerald-500 bg-neutral-950 px-4 py-3 font-mono"
        slotClasses={{
          title: 'text-sm font-bold text-emerald-400',
          description: 'text-xs text-neutral-400 mt-1'
        }}
        title="[OK] Build succeeded"
      >
        Compiled 847 modules in 1.2s · 0 warnings · 0 errors
      </Alert>
      <Alert
        unstyled
        class="flex gap-3 rounded-none border-l-4 border-red-500 bg-neutral-950 px-4 py-3 font-mono"
        slotClasses={{
          title: 'text-sm font-bold text-red-400',
          description: 'text-xs text-neutral-400 mt-1'
        }}
        title="[ERR] Process exited"
      >
        SIGTERM received · pid 4821 · exit code 137
      </Alert>
    </CodeExample>

    <CodeExample
      title="Accent Border"
      description="Minimal left-border style that works well in content-heavy layouts."
      isolate
      previewClass="flex flex-col gap-3 max-w-lg"
    >
      <Alert
        unstyled
        class="border-primary bg-surface-elevated rounded-modify flex gap-3 border-l-4 px-4 py-3"
        slotClasses={{
          title: 'text-sm font-semibold text-text-primary',
          description: 'text-sm text-text-secondary mt-0.5'
        }}
        title="Tip"
      >
        Use keyboard shortcuts to speed up your workflow. Press <kbd
          class="bg-surface-base border-border-subtle rounded-modify border px-1 py-0.5 text-xs font-medium"
          >⌘K</kbd
        > to open the command palette.
      </Alert>
      <Alert
        unstyled
        class="border-warning bg-surface-elevated rounded-modify flex gap-3 border-l-4 px-4 py-3"
        slotClasses={{
          title: 'text-sm font-semibold text-text-primary',
          description: 'text-sm text-text-secondary mt-0.5'
        }}
        title="Deprecation notice"
      >
        The <code class="text-text-primary bg-surface-base rounded px-1 py-0.5 text-xs">v1</code>
        API will be removed in the next major release. Migrate to
        <code class="text-text-primary bg-surface-base rounded-modify px-1 py-0.5 text-xs">v2</code> before
        March 2026.
      </Alert>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      Recurring promotional looks like the gradient banners belong in a
      <code class="text-text-primary">BlocksProvider</code> preset (<code class="text-text-primary"
        >presets.Alert</code
      >): registered once, applied per instance via <code class="text-text-primary">preset</code> —
      instead of repeating <code class="text-text-primary">slotClasses</code> at every call site.
      See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Renders with <code class="text-text-primary">role="alert"</code>, ensuring screen readers
          announce the content as a live region. Dismissible alerts include a close button with
          <code class="text-text-primary">aria-label="Dismiss"</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The dismiss button is focusable via
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          and activates with
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >. Focus-visible ring follows the component's intent color for clear contrast.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Transition durations use the <code class="text-text-primary">--blocks-duration-fast</code>
          token, which is automatically shortened when
          <code class="text-text-primary">prefers-reduced-motion</code> is enabled.
        </p>
      </div>
    </div>
  </div>
</Section>
