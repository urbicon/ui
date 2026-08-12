<!-- urbicon-ignore raw-tailwind-color — the 3 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Kbd, toaster } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let counter = $state(0);
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Toasts fire from the global <code class="text-text-primary">toaster</code> store, so render
    <code class="text-text-primary">&lt;Toaster /&gt;</code> once in your root layout first (its
    <code class="text-text-primary">placement</code> picks the screen corner, default
    <code class="text-text-primary">bottom-right</code>). Then call
    <code class="text-text-primary">toaster.success(title, options)</code> (or
    <code class="text-text-primary">.info</code> / <code class="text-text-primary">.warning</code> /
    <code class="text-text-primary">.danger</code>) from anywhere. Without a mounted
    <code class="text-text-primary">&lt;Toaster /&gt;</code> nothing appears.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Duration, progress and dismissal"
      description={`Three settings decide how long a toast lives and how it leaves: duration (0 keeps it up until the reader acts), showProgress, and dismissible={false} for toasts that may only auto-close.`}
      code={`// duration in ms – 0 keeps the toast up until the reader acts
toaster.success('Auto-saved', { duration: 2000 });
toaster.danger('Action required', {
  description: 'Please review the error log.',
  duration: 0
});

// showProgress draws the bar counting the remaining time down
toaster.success('Uploading…', { duration: 6000, showProgress: true });
toaster.success('Uploaded', { duration: 6000, showProgress: false });

// dismissible: false drops the close button – auto-close only
toaster.info('Syncing…', {
  description: 'Please wait.',
  dismissible: false,
  duration: 3000
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
      description="Fire the toast from the same handler that does the work, and pass the result into the description."
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

<Section marker id="store-api" title="Store API">
  <div class="space-y-8">
    <CodeExample
      title="Toaster Store API"
      description="All methods on the toaster singleton."
      code={`import { toaster } from '@urbicon-ui/blocks';

// Shorthand methods – set intent automatically
toaster.info(title, opts?)      // intent: 'info'
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
  showProgress: true,    // animated progress bar
  action: { label: 'Undo', onClick: (id) => restore(id) },  // primary button
  cancel: { label: 'Dismiss' }                              // secondary/quiet button
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

<Section marker id="customization" title="Customization">
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
      already act globally. A <code class="text-text-primary">BlocksProvider</code> preset (<code
        class="text-text-primary">presets.Toaster</code
      >, applied via
      <code class="text-text-primary">preset</code>) is mainly useful for sharing a skin between
      apps or switching skins per surface. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
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
    <Note title="Non-blocking">
      <p>
        Toasts use <code class="text-text-primary">pointer-events-none</code> on the container so they
        never block interaction with the underlying page. Only the toasts themselves capture pointer events,
        so the buttons inside them still work.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        Fly transitions use the system's <code class="text-text-primary">duration</code> tokens and are
        retuned under reduced motion. The countdown progress bar is hidden entirely (a bar that can't
        animate carries no information). Auto-dismiss timing is unchanged.
      </p>
    </Note>
  </NoteList>
</Section>
