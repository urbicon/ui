<!-- urbicon-ignore raw-tailwind-color — the 11 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Alert,
    Button,
    CheckCircleIcon,
    DangerCircleIcon,
    Kbd,
    WarningTriangleIcon
  } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let dismissedSoft = $state(false);
  let dismissedInline = $state(false);
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="With Icon"
      description="Use the `icon` snippet to convey intent visually alongside the title and message."
      isolate
      previewClass="flex flex-col gap-3 max-w-lg"
    >
      <Alert intent="success" title="Deployment complete">
        {#snippet icon()}
          <CheckCircleIcon class="h-5 w-5" />
        {/snippet}
        Build #347 deployed to production in 42 seconds.
      </Alert>
      <Alert intent="danger" title="Build failed">
        {#snippet icon()}
          <DangerCircleIcon class="h-5 w-5" />
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
          <WarningTriangleIcon class="h-5 w-5" />
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

<Section marker id="customization" title="Customization">
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
        Use keyboard shortcuts to speed up your workflow. Press <Kbd keys="⌘K" /> to open the command
        palette.
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

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        Renders with <code class="text-text-primary">role="alert"</code>, ensuring screen readers
        announce the content as a live region. Dismissible alerts include a close button with
        <code class="text-text-primary">aria-label="Dismiss"</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        The dismiss button is focusable via
        <Kbd keys="Tab" />
        and activates with
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />. Focus-visible ring follows the component's intent color for clear
        contrast.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        Transition durations use the <code class="text-text-primary">--blocks-duration-fast</code>
        token, which is automatically shortened when
        <code class="text-text-primary">prefers-reduced-motion</code> is enabled.
      </p>
    </Note>
  </NoteList>
</Section>
