<!-- urbicon-ignore raw-tailwind-color — the Customization demo paints the alert into a terminal
     look with `class` + `slotClasses`: it keeps the alert's radius tier, padding and behaviour,
     and only the black surface, the accent bar and the monospace text are raw — a terminal look
     the token palette has no equivalent for. Every other section on this page stays under the
     rule. -->
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
    <p class="text-text-secondary text-sm leading-relaxed">
      An Alert takes an <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">intent</code>, a
      <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">title</code> and its message as
      children. The <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">icon</code> and
      <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">actions</code> snippets and the dismiss
      button are opt-in.
    </p>

    <CodeExample
      title="With Icon"
      description="An Alert draws no icon on its own. Pass the icon snippet and pick one that matches the intent."
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
      description="The actions snippet holds buttons for an inline confirmation, keeping the user in context instead of opening a modal."
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
      description="dismissible shows the close button and onDismiss fires when it is clicked. The Alert does not remove itself, so keep it in an if-block and clear your own flag when onDismiss runs, as this demo does."
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
  <div class="space-y-6">
    <CodeExample
      title="Terminal log"
      description="class paints the surface and slotClasses the title and message. The alert keeps its radius tier, padding and behaviour. Raw colours because a terminal's black surface, green/red accent and monospace text have no token equivalent."
      isolate
      previewClass="flex flex-col gap-3 max-w-lg"
    >
      <Alert
        class="border-l-4 border-emerald-500 bg-neutral-950 font-mono"
        slotClasses={{
          title: 'font-bold text-emerald-400',
          description: 'text-xs text-neutral-400'
        }}
        title="[OK] Build succeeded"
      >
        Compiled 847 modules in 1.2s · 0 warnings · 0 errors
      </Alert>
      <Alert
        class="border-l-4 border-red-500 bg-neutral-950 font-mono"
        slotClasses={{
          title: 'font-bold text-red-400',
          description: 'text-xs text-neutral-400'
        }}
        title="[ERR] Process exited"
      >
        SIGTERM received · pid 4821 · exit code 137
      </Alert>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        Renders with <code class="text-text-primary">role="alert"</code>, an assertive live region:
        a screen reader announces the alert as soon as it is added to the page. Add it in response
        to the event, so the announcement lands when the status actually changes. Dismissible alerts
        get a close button with a localized label.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        The dismiss button is focusable via
        <Kbd keys="Tab" />
        and activates with
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />.
      </p>
    </Note>
  </NoteList>
</Section>
