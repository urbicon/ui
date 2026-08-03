<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { ConfirmDialog, Button } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let dangerOpen = $state(false);
  let asyncOpen = $state(false);

  async function fakeDelete() {
    await new Promise((r) => setTimeout(r, 1200));
  }
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Destructive confirmation"
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
      title="Async onConfirm — auto-loading"
      description="When onConfirm returns a promise the dialog disables both buttons, blocks dismissal, shows a spinner on the confirm button, then auto-closes on success. If the promise rejects the dialog stays open and re-enables for a retry — surface the failure via onError."
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
        onConfirm={fakeDelete}
      />
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-3">
    <p class="text-text-secondary text-sm leading-relaxed">
      <code class="text-text-primary">intent</code> drives both the dialog accent strip and the
      confirm-button colour. The <code class="text-text-primary">neutral</code> intent upgrades the
      confirm button to <code class="text-text-primary">primary</code> for visual affordance —
      override via <code class="text-text-primary">confirmIntent</code> if your design system needs different
      tones.
    </p>
    <p class="text-text-secondary text-sm leading-relaxed">
      For confirmations with richer markup (a list of consequences, a typed-confirmation field),
      pass content through the default <code class="text-text-primary">children</code> snippet — it
      renders below the <code class="text-text-primary">description</code>.
    </p>
    <p class="text-text-secondary text-sm leading-relaxed">
      ConfirmDialog is a pre-configured
      <a href={resolve('/blocks/primitives/dialog')} class="text-primary hover:underline">Dialog</a>
      and owns no styles of its own: <code class="text-text-primary">class</code>,
      <code class="text-text-primary">unstyled</code>,
      <code class="text-text-primary">slotClasses</code>, and
      <code class="text-text-primary">preset</code> are forwarded verbatim to the inner Dialog.
      <code class="text-text-primary">slotClasses</code> therefore takes the Dialog slot keys (<code
        class="text-text-primary">panel</code
      >, <code class="text-text-primary">header</code>,
      <code class="text-text-primary">title</code>, <code class="text-text-primary">body</code>,
      <code class="text-text-primary">footer</code>,
      <code class="text-text-primary">backdrop</code>, …), and presets are registered under the
      <code class="text-text-primary">presets.Dialog</code> key on
      <code class="text-text-primary">BlocksProvider</code> — a Dialog preset restyles both
      components. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Inherited from Dialog">
      <p>
        Focus trap, Escape-to-cancel and backdrop-click-to-cancel all come from the underlying
        <code class="text-text-primary">Dialog</code>. While an async
        <code class="text-text-primary">onConfirm</code> is pending all three are disabled, so the user
        cannot navigate away mid-action.
      </p>
    </Note>
    <Note title="Real buttons">
      <p>
        Cancel and confirm are actual <code class="text-text-primary">&lt;button&gt;</code> elements —
        keyboard navigation (Tab, Enter, Space) works without extra wiring.
      </p>
    </Note>
    <Note title="Translatable labels">
      <p>
        Default labels resolve via <code class="text-text-primary">bt('button.confirm')</code> /
        <code class="text-text-primary">bt('button.cancel')</code> — translate them through the
        <code class="text-text-primary">i18n</code> package, or override per call via
        <code class="text-text-primary">confirmLabel</code> /
        <code class="text-text-primary">cancelLabel</code>.
      </p>
    </Note>
  </NoteList>
</Section>
