<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { ConfirmDialog, Button, Kbd } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let dangerOpen = $state(false);
  let asyncOpen = $state(false);
  let brandedOpen = $state(false);

  async function fakeSubmit() {
    await new Promise((r) => setTimeout(r, 1200));
  }
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Destructive confirmation"
      description="bind:open drives visibility. onConfirm runs the action and the dialog closes itself. onCancel runs on cancel, backdrop click, or Escape."
      code={`<` +
        `script>
  let confirmOpen = $state(false);
<` +
        `/script>
<Button intent="danger" onclick={() => (confirmOpen = true)}>Delete</Button>
<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete project?"
  description="This cannot be undone."
  intent="danger"
  confirmLabel="Delete"
  onConfirm={() => deleteProject()}
/>`}
      language="svelte"
    >
      <Button intent="danger" onclick={() => (dangerOpen = true)}>Delete</Button>
      <ConfirmDialog
        bind:open={dangerOpen}
        title="Delete project?"
        description="This cannot be undone."
        intent="danger"
        confirmLabel="Delete"
      />
    </CodeExample>

    <CodeExample
      title="Async onConfirm"
      description="When onConfirm returns a promise the dialog disables both buttons, blocks dismissal, shows a spinner on the confirm button, then auto-closes on success. If the promise rejects the dialog stays open and re-enables for a retry. Surface the failure via onError."
      code={`<ConfirmDialog
  bind:open
  title="Submit report?"
  description="Network call may take a moment."
  intent="primary"
  confirmLabel="Submit"
  onConfirm={async () => { await api.submit(); }}
  onError={() => toaster.danger('Could not submit report')}
/>`}
      language="svelte"
    >
      <Button onclick={() => (asyncOpen = true)}>Submit report</Button>
      <ConfirmDialog
        bind:open={asyncOpen}
        title="Submit report?"
        description="Network call may take a moment (1.2 s simulated)."
        intent="primary"
        confirmLabel="Submit"
        onConfirm={fakeSubmit}
      />
    </CodeExample>
  </div>
</Section>

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Accented panel"
      description="slotClasses reaches through to the inner Dialog. Giving the panel slot an opaque surface token plus a primary border keeps the body text at full contrast, while the primary intent already tints the title and confirm button. The panel's radius tier, centering and focus trap stay intact."
      code={`<ConfirmDialog
  bind:open
  title="Publish release?"
  description="Version 2.0 goes live for everyone."
  intent="primary"
  confirmLabel="Publish"
  slotClasses={{ panel: 'bg-surface-elevated border-primary' }}
/>`}
      language="svelte"
    >
      <Button onclick={() => (brandedOpen = true)}>Publish release</Button>
      <ConfirmDialog
        bind:open={brandedOpen}
        title="Publish release?"
        description="Version 2.0 goes live for everyone."
        intent="primary"
        confirmLabel="Publish"
        slotClasses={{ panel: 'bg-surface-elevated border-primary' }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      <code class="text-text-primary">intent</code> colours the header title and the confirm button
      together. A <code class="text-text-primary">neutral</code> intent upgrades the confirm button
      to
      <code class="text-text-primary">primary</code>. Override just the button with
      <code class="text-text-primary">confirmIntent</code>. For a richer body (a list of
      consequences, a typed-confirmation field) pass a
      <code class="text-text-primary">children</code> snippet, which renders below the
      <code class="text-text-primary">description</code>.
    </p>

    <p class="text-text-secondary text-sm leading-relaxed">
      ConfirmDialog is a pre-configured
      <a href={resolve('/blocks/primitives/dialog')} class="text-primary hover:underline">Dialog</a>
      and owns no styles, so <code class="text-text-primary">class</code>,
      <code class="text-text-primary">unstyled</code>,
      <code class="text-text-primary">slotClasses</code> and
      <code class="text-text-primary">preset</code> forward to it verbatim. Its
      <code class="text-text-primary">slotClasses</code> takes the Dialog slot keys, and a preset
      registered under the <code class="text-text-primary">Dialog</code> key restyles both.
    </p>

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

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Inherited from Dialog">
      <p>
        Focus trap, Escape-to-cancel and backdrop-click-to-cancel all come from the underlying
        <code class="text-text-primary">Dialog</code>. While an async
        <code class="text-text-primary">onConfirm</code> is pending, Escape and backdrop dismissal are
        disabled and the close button is hidden, so the user cannot dismiss the dialog mid-action. The
        focus trap stays active throughout.
      </p>
    </Note>
    <Note title="Real buttons">
      <p>
        Cancel and confirm are actual <code class="text-text-primary">&lt;button&gt;</code>
        elements, so keyboard navigation (<Kbd keys="Tab" />, <Kbd keys="Enter" />, <Kbd
          keys="Space"
        />) works without extra wiring.
      </p>
    </Note>
    <Note title="Translatable labels">
      <p>
        Default labels resolve via <code class="text-text-primary">bt('button.confirm')</code> /
        <code class="text-text-primary">bt('button.cancel')</code>. Translate them through the
        <code class="text-text-primary">i18n</code> package, or override per call via
        <code class="text-text-primary">confirmLabel</code> /
        <code class="text-text-primary">cancelLabel</code>.
      </p>
    </Note>
  </NoteList>
</Section>
