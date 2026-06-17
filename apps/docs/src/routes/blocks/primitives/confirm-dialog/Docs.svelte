<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { ConfirmDialog, Button } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: true, order: 1 },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: { include: true },
    meta: { title: 'ConfirmDialog Component', showToc: true }
  };

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
<Button intent="danger" onclick={() => (open = true)}>Delete</Button>
<ConfirmDialog
  bind:open
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
      description="When onConfirm returns a promise the dialog disables both buttons, blocks dismissal, shows a spinner on the confirm button, then auto-closes on success."
      code={`<ConfirmDialog
  bind:open
  title="Submit report?"
  description="Network call may take a moment."
  intent="primary"
  confirmLabel="Submit"
  onConfirm={async () => { await api.submit(); }}
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
  <div class="prose prose-sm max-w-none">
    <p>
      <code>intent</code> drives both the dialog accent strip and the confirm-button colour. The
      <code>neutral</code> intent upgrades the confirm button to <code>primary</code> for visual
      affordance — override via <code>confirmIntent</code> if your design system needs different tones.
    </p>
    <p>
      For confirmations with richer markup (a list of consequences, a typed-confirmation field),
      pass content through the default <code>children</code> snippet — it renders below the
      <code>description</code>.
    </p>
  </div>
</Section>

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="prose prose-sm max-w-none">
    <ul>
      <li>
        Inherits focus trap, Escape-to-cancel, and backdrop-click-to-cancel from the underlying
        <code>Dialog</code>. While an async <code>onConfirm</code> is pending all three are disabled so
        the user cannot navigate away mid-action.
      </li>
      <li>
        The cancel/confirm buttons are real <code>&lt;button&gt;</code> elements — keyboard navigation
        (Tab, Enter, Space) works without extra wiring.
      </li>
      <li>
        Default labels resolve via <code>bt('button.confirm')</code> /
        <code>bt('button.cancel')</code>
        — translate them through the <code>i18n</code> package, or override per-call via
        <code>confirmLabel</code> / <code>cancelLabel</code>.
      </li>
    </ul>
  </div>
</Section>
