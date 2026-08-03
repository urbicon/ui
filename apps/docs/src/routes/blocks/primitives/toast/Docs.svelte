<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Kbd, toaster } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let counter = $state(0);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="All Intents"
      description="Each intent maps to a semantic icon and border color for instant recognition."
      code={`toaster.info('New message', { description: 'You have a notification.' });
toaster.success('Payment received', { description: '$42.00 from Acme Inc.' });
toaster.warning('Disk space low', { description: '92% of storage used.' });
toaster.danger('Deploy failed', { description: 'Build error on line 42.' });
toaster.add({ title: 'Reminder', intent: 'neutral', description: 'Stand-up in 5 min.' });`}
      isolate
      previewClass="flex flex-wrap items-center justify-center gap-3 py-4"
    >
      <Button
        size="sm"
        intent="primary"
        onclick={() => toaster.info('New message', { description: 'You have a notification.' })}
      >
        Info
      </Button>
      <Button
        size="sm"
        intent="success"
        onclick={() =>
          toaster.success('Payment received', { description: '$42.00 from Acme Inc.' })}
      >
        Success
      </Button>
      <Button
        size="sm"
        intent="warning"
        onclick={() => toaster.warning('Disk space low', { description: '92% of storage used.' })}
      >
        Warning
      </Button>
      <Button
        size="sm"
        intent="danger"
        onclick={() => toaster.danger('Deploy failed', { description: 'Build error on line 42.' })}
      >
        Danger
      </Button>
      <Button
        size="sm"
        intent="neutral"
        variant="outlined"
        onclick={() =>
          toaster.add({
            title: 'Reminder',
            intent: 'neutral',
            description: 'Stand-up in 5 min.'
          })}
      >
        Neutral
      </Button>
    </CodeExample>

    <CodeExample
      title="Title Only"
      description="Compact toasts without a description for brief confirmations."
      code={`toaster.success('Copied to clipboard');
toaster.info('Link shared');`}
      isolate
      previewClass="flex flex-wrap items-center justify-center gap-3 py-4"
    >
      <Button
        size="sm"
        intent="success"
        variant="outlined"
        onclick={() => toaster.success('Copied to clipboard')}
      >
        Copy
      </Button>
      <Button
        size="sm"
        intent="primary"
        variant="outlined"
        onclick={() => toaster.info('Link shared')}
      >
        Share
      </Button>
    </CodeExample>

    <CodeExample
      title="Progress Bar"
      description="An animated bar counts down the remaining duration. Compare with and without to see the difference."
      code={`// With progress bar (default)
toaster.success('Uploading…', { duration: 6000, showProgress: true });

// Without progress bar
toaster.success('Uploaded', { duration: 6000, showProgress: false });`}
      isolate
      previewClass="flex flex-wrap items-center justify-center gap-3 py-4"
    >
      <Button
        size="sm"
        intent="success"
        onclick={() =>
          toaster.success('Uploading…', {
            description: 'Watch the progress bar at the bottom.',
            duration: 6000,
            showProgress: true
          })}
      >
        With Progress
      </Button>
      <Button
        size="sm"
        intent="success"
        variant="outlined"
        onclick={() =>
          toaster.success('Uploaded', {
            description: 'No progress bar on this one.',
            duration: 6000,
            showProgress: false
          })}
      >
        Without Progress
      </Button>
    </CodeExample>

    <CodeExample
      title="Custom Duration"
      description="Set duration in milliseconds. Use 0 for persistent toasts that require manual dismissal."
      code={`// Quick flash – 2 seconds
toaster.success('Auto-saved', { duration: 2000 });

// Persistent – must be dismissed manually
toaster.danger('Action required', {
  description: 'Please review the error log.',
  duration: 0
});`}
      isolate
      previewClass="flex flex-wrap items-center justify-center gap-3 py-4"
    >
      <Button
        size="sm"
        variant="outlined"
        onclick={() => toaster.success('Auto-saved', { duration: 2000 })}
      >
        Quick (2s)
      </Button>
      <Button
        size="sm"
        intent="danger"
        variant="outlined"
        onclick={() =>
          toaster.danger('Action required', {
            description: 'Please review the error log.',
            duration: 0
          })}
      >
        Persistent
      </Button>
    </CodeExample>

    <CodeExample
      title="Non-Dismissible"
      description="Remove the close button for toasts that should only auto-dismiss."
      code={`toaster.info('Syncing…', {
  description: 'Please wait.',
  dismissible: false,
  duration: 3000
});`}
      isolate
      previewClass="flex justify-center py-4"
    >
      <Button
        size="sm"
        variant="outlined"
        onclick={() =>
          toaster.info('Syncing…', {
            description: 'Please wait.',
            dismissible: false,
            duration: 3000
          })}
      >
        Non-Dismissible
      </Button>
    </CodeExample>

    <CodeExample
      title="Programmatic Dismiss & Clear"
      description="toaster.add() returns a toast ID for targeted dismissal. toaster.clear() removes everything."
      code={`const id = toaster.success('Uploading…', { duration: 0 });

// Later…
toaster.dismiss(id);

// Or remove everything
toaster.clear();`}
      isolate
      previewClass="flex flex-wrap items-center justify-center gap-3 py-4"
    >
      <Button
        size="sm"
        intent="success"
        variant="outlined"
        onclick={() => {
          counter++;
          toaster.success(`Upload #${counter}`, {
            description: 'This one sticks around.',
            duration: 0
          });
        }}
      >
        Add Persistent
      </Button>
      <Button size="sm" intent="danger" variant="outlined" onclick={() => toaster.clear()}>
        Clear All
      </Button>
    </CodeExample>

    <CodeExample
      title="Document Editor"
      description="A real-world pattern: contextual toasts triggered by app actions."
      code={`<Button onclick={() => toaster.success('Saved', {
  description: 'Draft saved at ' + new Date().toLocaleTimeString()
})}>Save Draft</Button>`}
      isolate
      previewClass="flex justify-center py-4"
    >
      <div
        class="bg-surface-elevated border-border-subtle flex w-full max-w-sm flex-col gap-3 rounded-xl border p-5"
      >
        <h3 class="text-text-primary text-sm font-semibold">Document Editor</h3>
        <div class="bg-surface-base border-border-subtle h-20 rounded-lg border p-3">
          <p class="text-text-tertiary text-xs italic">Start typing your document…</p>
        </div>
        <div class="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onclick={() =>
              toaster.warning('Unsaved changes', {
                description: 'You have unsaved changes. Save before leaving.'
              })}
          >
            Discard
          </Button>
          <Button
            size="sm"
            intent="primary"
            onclick={() =>
              toaster.success('Saved', {
                description: 'Draft saved at ' + new Date().toLocaleTimeString()
              })}
          >
            Save Draft
          </Button>
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Store API ─── -->

<Section marker="02" id="store-api" title="Store API">
  <div class="space-y-8">
    <CodeExample
      title="Toaster Store API"
      description="All methods on the toaster singleton."
      code={`import { toaster } from '@urbicon-ui/blocks';

// Shorthand methods – set intent automatically
toaster.info(title, opts?)      // intent: 'primary'
toaster.success(title, opts?)   // intent: 'success'
toaster.warning(title, opts?)   // intent: 'warning'
toaster.danger(title, opts?)    // intent: 'danger'

// Full control via add()
toaster.add({
  intent: 'success',
  title: 'Done',
  description: 'All tasks completed.',
  duration: 5000,        // ms, 0 = persistent
  dismissible: true,     // show close button
  showProgress: true     // animated progress bar
}); // → returns toast ID

// Manage toasts
toaster.dismiss(id);  // remove one by ID
toaster.clear();      // remove all`}
      language="typescript"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="slotClasses Override"
      description="Override individual toast slots for a branded look without going fully unstyled."
      code={`<Toaster slotClasses={{
  toast: 'border-2 border-violet-500/30 shadow-lg shadow-violet-500/10',
  title: 'text-violet-400 font-bold',
  icon: 'text-violet-400'
}} />`}
      language="svelte"
      preview={false}
    />

    <p class="text-text-secondary text-sm leading-relaxed">
      The <code class="text-text-primary">Toaster</code> is one instance per app, so its
      <code class="text-text-primary">slotClasses</code>
      already act globally; a <code class="text-text-primary">BlocksProvider</code> preset (<code
        class="text-text-primary">presets.Toaster</code
      >, applied via
      <code class="text-text-primary">preset</code>) is mainly useful for sharing a skin between
      apps or switching skins per surface. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Live Region">
      <p>
        The Toaster container uses
        <code class="text-text-primary">aria-live="polite"</code> with
        <code class="text-text-primary">aria-relevant="additions removals"</code>. Screen readers
        announce new toasts without interrupting the current task.
      </p>
    </Note>
    <Note title="Alert Role">
      <p>
        Each individual toast is rendered with
        <code class="text-text-primary">role="alert"</code>, ensuring assistive technologies surface
        the notification promptly.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Dismiss buttons are focusable via
        <Kbd keys="Tab" />
        and activate with
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />. The dismiss button has an
        <code class="text-text-primary">aria-label="Dismiss"</code>.
      </p>
    </Note>
    <Note title="Focus Management">
      <p>
        Toasts use <code class="text-text-primary">pointer-events-none</code> on the container so they
        never block interaction with the underlying page. Only the dismiss button within each toast captures
        pointer events.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        Fly transitions use the system's <code class="text-text-primary">duration</code> tokens. The progress
        bar animation uses a linear timing function that remains functional under reduced motion preferences.
      </p>
    </Note>
  </NoteList>
</Section>
