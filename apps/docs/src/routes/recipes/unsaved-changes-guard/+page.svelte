<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Card, Badge, Input, Button, ConfirmDialog, Alert } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  let originalName = 'Sunset Heights';
  let name = $state(originalName);
  let dirty = $derived(name !== originalName);

  let showConfirm = $state(false);
  let pendingAction = $state<(() => void) | null>(null);

  function attemptLeave(action: () => void) {
    if (dirty) {
      pendingAction = action;
      showConfirm = true;
    } else {
      action();
    }
  }

  function discardAndLeave() {
    name = originalName;
    pendingAction?.();
    pendingAction = null;
  }

  function saveAndLeave() {
    originalName = name;
    showConfirm = false;
    pendingAction?.();
    pendingAction = null;
  }

  function cancelLeave() {
    showConfirm = false;
    pendingAction = null;
  }
</script>

<SeoMeta
  title="Unsaved Changes Guard Recipe"
  description="Guards against data loss when leaving a page — ConfirmDialog + beforeunload + beforeNavigate."
/>

<div class="mx-auto max-w-5xl px-6 py-12">
  <header class="mb-10">
    <a
      href={resolve('/recipes')}
      class="text-text-tertiary hover:text-text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
    >
      ← Back to Recipes
    </a>
    <h1 class="text-text-primary mb-3 text-4xl font-bold">{recipeMeta.title}</h1>
    <p class="text-text-secondary text-lg">{recipeMeta.description}</p>
  </header>

  <div class="mb-8 flex flex-wrap gap-2">
    {#each usedComponents as comp (comp)}
      <Badge variant="soft" intent="primary">{comp}</Badge>
    {/each}
  </div>

  <Section id="preview" title="Live Preview">
    <Card variant="outlined">
      <div class="space-y-6 p-6">
        <Alert intent="info" variant="soft">
          <strong>Demo:</strong> Change the name and click "Leave" — the dialog only appears when the
          field has unsaved changes.
        </Alert>

        <Input
          label="Property name"
          bind:value={name}
          helper={dirty ? 'Unsaved changes' : 'No changes'}
          intent={dirty ? 'warning' : 'default'}
        />

        <div class="flex flex-wrap items-center gap-3">
          <Button
            intent="primary"
            onclick={() => attemptLeave(() => alert('Navigated away (mock)'))}
          >
            Leave
          </Button>
          <Button intent="neutral" variant="outlined" onclick={() => (originalName = name)}>
            Save
          </Button>
          <Button intent="neutral" variant="ghost" onclick={() => (name = originalName)}>
            Reset
          </Button>
        </div>
      </div>
    </Card>

    <ConfirmDialog
      bind:open={showConfirm}
      title="Unsaved changes"
      description="You have changes that haven't been saved yet. Save and continue, or cancel?"
      intent="warning"
      onCancel={cancelLeave}
      confirmLabel="Save and leave"
      cancelLabel="Cancel"
      onConfirm={saveAndLeave}
    >
      <button
        type="button"
        class="text-danger hover:text-danger-emphasis text-sm underline-offset-2 hover:underline"
        onclick={discardAndLeave}
      >
        Discard changes and leave anyway
      </button>
    </ConfirmDialog>
  </Section>

  <Section id="features" title="Features">
    <Card variant="outlined">
      <ul class="divide-border-subtle divide-y">
        {#each features as feature (feature)}
          <li class="text-text-secondary px-4 py-3 text-sm">{feature}</li>
        {/each}
      </ul>
    </Card>
  </Section>

  <Section id="code" title="Code">
    <div class="space-y-6">
      <CodeExample
        title="lib/use-unsaved-guard.svelte.ts"
        preview={false}
        language="typescript"
        code={`import { onDestroy } from 'svelte';
import { beforeNavigate, type Navigation } from '$app/navigation';

export interface UnsavedGuardOptions {
  /** Reactive getter — true when unsaved changes exist. */
  isDirty: () => boolean;
  /** Called before navigating; should return true when it is OK to proceed. */
  confirm: () => Promise<boolean>;
}

/**
 * Mounts beforeNavigate (SvelteKit) + window.beforeunload (browser),
 * so the app protects unsaved changes before leaving.
 *
 * @example
 * \`\`\`ts
 * let dirty = $derived(name !== originalName);
 * useUnsavedGuard({ isDirty: () => dirty, confirm: askUser });
 * \`\`\`
 */
export function useUnsavedGuard(opts: UnsavedGuardOptions): void {
  // 1) SvelteKit-internal navigation
  beforeNavigate(async (nav: Navigation) => {
    if (!opts.isDirty()) return;
    if (nav.cancel === undefined) return; // SSR / non-cancellable
    nav.cancel();
    const proceed = await opts.confirm();
    if (proceed && nav.to) {
      // User confirmed — re-trigger navigation
      window.location.href = nav.to.url.href;
    }
  });

  // 2) Browser-level: close, refresh, external link
  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (!opts.isDirty()) return;
    e.preventDefault();
    // Modern browsers ignore the message — just need preventDefault + returnValue
    e.returnValue = '';
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);
    onDestroy(() => window.removeEventListener('beforeunload', handleBeforeUnload));
  }
}`}
      />

      <CodeExample
        title="Usage in a form page"
        preview={false}
        language="svelte"
        code={`<script lang="ts">
  import { ConfirmDialog, Input, Button } from '@urbicon-ui/blocks';
  import { useUnsavedGuard } from '$lib/use-unsaved-guard.svelte';

  let originalName = $state('Sunset Heights');
  let name = $state(originalName);
  let dirty = $derived(name !== originalName);

  let dialogOpen = $state(false);
  let resolveDialog: ((proceed: boolean) => void) | null = null;

  function askUser(): Promise<boolean> {
    dialogOpen = true;
    return new Promise<boolean>((resolve) => {
      resolveDialog = resolve;
    });
  }

  function onConfirm() {
    // user wants to save then proceed → save first
    originalName = name;
    dialogOpen = false;
    resolveDialog?.(true);
    resolveDialog = null;
  }

  function onDiscard() {
    // user wants to discard → reset, then proceed
    name = originalName;
    dialogOpen = false;
    resolveDialog?.(true);
    resolveDialog = null;
  }

  function onCancel() {
    dialogOpen = false;
    resolveDialog?.(false);
    resolveDialog = null;
  }

  useUnsavedGuard({ isDirty: () => dirty, confirm: askUser });
</scr` +
          `ipt>

<Input label="Property name" bind:value={name} />

<ConfirmDialog
  bind:open={dialogOpen}
  title="Unsaved changes"
  description="What do you want to do with the changes?"
  intent="warning"
  confirmLabel="Save and leave"
  cancelLabel="Cancel"
  {onConfirm}
  {onCancel}
>
  <button
    type="button"
    class="text-danger text-sm hover:underline"
    onclick={onDiscard}
  >
    Discard changes and leave anyway
  </button>
</ConfirmDialog>`}
      />
    </div>
  </Section>

  <Section id="best-practices" title="Best Practices">
    <Card variant="outlined">
      <div class="divide-border-subtle divide-y">
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Three actions instead of two</h4>
          <p class="text-text-secondary mt-1 text-sm">
            <strong>Save and leave</strong>, <strong>Discard</strong>,
            <strong>Cancel</strong> — the common mistake is leaving out "Discard". That forces the user
            to either save (even broken data) or not navigate at all. Three clear paths solve it.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">dirty flag from a real diff</h4>
          <p class="text-text-secondary mt-1 text-sm">
            <code class="text-text-primary">dirty</code> should come from a comparison against the
            original state, not from a manual flag. Otherwise you risk false positives (the user
            types something and deletes it again → no diff, but the flag is still true).
            <code class="text-text-primary">$derived(name !== originalName)</code> is robust.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">
            Don't overload browser beforeunload
          </h4>
          <p class="text-text-secondary mt-1 text-sm">
            Modern browsers no longer show app-specific text for
            <code class="text-text-primary">beforeunload</code> — just a generic "Do you really want
            to leave this page?". So <code class="text-text-primary">beforeunload</code> is only a fallback
            for browser close/refresh. The more important protection is the app's own ConfirmDialog on
            internal route changes.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Auto-save as an alternative</h4>
          <p class="text-text-secondary mt-1 text-sm">
            If the schema allows auto-save (settings, profile, notes), it spares you the whole
            guard. The guard is needed when saving is explicit (wizard with submit, form with
            validation). Ask yourself: would auto-save break the user's workflow? If not → no guard
            needed.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">
            Why a recipe instead of a component?
          </h4>
          <p class="text-text-secondary mt-1 text-sm">
            The guard is app state, not a UI pattern: dirty tracking, save action, discard action,
            and the beforeNavigate integration are all app-specific. A UIB component
            <code class="text-text-primary">&lt;UnsavedChangesGuard&gt;</code> would only offer convenience
            for 5 lines of setup — at noticeably more coupling. Recipe + use hook is the clean separation.
          </p>
        </div>
      </div>
    </Card>
  </Section>
</div>
