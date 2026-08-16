<script lang="ts">
  import { Button, ConfirmDialog, Input } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';
  // The hook is a real sibling file, shown from source (?raw): the code panel
  // cannot drift from it, and Vite's dependency scanner — which resolves the
  // `.svelte`-suffixed import it regex-finds inside the recipeCode literal —
  // lands on an existing module instead of failing the whole scan with ENOENT.
  import guardCode from './use-unsaved-guard.svelte.ts?raw';

  let originalName = $state('Sunset Heights');
  let name = $state('Sunset Heights');
  let dirty = $derived(name !== originalName);

  let showConfirm = $state(false);
  let resolveLeave: ((proceed: boolean) => void) | null = null;

  // Stand-in for a save call: the draft becomes the new baseline.
  function save() {
    originalName = name;
  }

  function reset() {
    name = originalName;
  }

  // The guard calls this instead of navigating. The dialog's three exits
  // resolve the promise: Cancel with false, the other two with true after
  // clearing the dirty state.
  function askUser(): Promise<boolean> {
    showConfirm = true;
    return new Promise((resolve) => (resolveLeave = resolve));
  }

  // A docs page cannot navigate away from itself, so `leave` replays the
  // guard's decision against a mocked navigation. PropertyForm.svelte in the
  // code below wires the same state and handlers to the real thing.
  async function leave() {
    if (!dirty) {
      navigate();
      return;
    }
    if (await askUser()) navigate();
  }

  function navigate() {
    alert('Navigated away (mock)');
  }

  function saveAndLeave() {
    save();
    resolveLeave?.(true);
    resolveLeave = null;
  }

  function discardAndLeave() {
    reset();
    showConfirm = false;
    resolveLeave?.(true);
    resolveLeave = null;
  }

  function cancelLeave() {
    resolveLeave?.(false);
    resolveLeave = null;
  }

  const recipeCode = `<\script lang="ts">
  import { goto } from '$app/navigation';
  import { Button, ConfirmDialog, Input } from '@urbicon-ui/blocks';
  import { useUnsavedGuard } from './use-unsaved-guard.svelte';

  let originalName = $state('Sunset Heights');
  let name = $state('Sunset Heights');
  let dirty = $derived(name !== originalName);

  let showConfirm = $state(false);
  let resolveLeave: ((proceed: boolean) => void) | null = null;

  // Stand-in for your save call: the draft becomes the new baseline.
  function save() {
    originalName = name;
  }

  function reset() {
    name = originalName;
  }

  // The guard calls this instead of navigating. The dialog's three exits
  // resolve the promise: Cancel with false, the other two with true after
  // clearing the dirty state.
  function askUser(): Promise<boolean> {
    showConfirm = true;
    return new Promise((resolve) => (resolveLeave = resolve));
  }

  useUnsavedGuard({ isDirty: () => dirty, confirm: askUser });

  // The page's own way out. Any navigation trips the guard the same way: a
  // sidebar link, the back button, this goto. (The demo mocks this with an
  // alert; a docs page cannot leave itself.)
  function leave() {
    goto('/properties');
  }

  function saveAndLeave() {
    save();
    resolveLeave?.(true);
    resolveLeave = null;
  }

  function discardAndLeave() {
    reset();
    showConfirm = false;
    resolveLeave?.(true);
    resolveLeave = null;
  }

  function cancelLeave() {
    resolveLeave?.(false);
    resolveLeave = null;
  }
<\/script>

<!-- Lay it out in your page's own column; the cap keeps the field readable. -->
<div class="w-full max-w-md space-y-6">
  <Input
    label="Property name"
    bind:value={name}
    helper={dirty ? 'Unsaved changes' : 'No changes'}
    intent={dirty ? 'warning' : 'default'}
  />

  <div class="flex flex-wrap items-center gap-3">
    <Button intent="primary" onclick={leave}>Leave</Button>
    <Button intent="neutral" variant="outlined" onclick={save}>Save</Button>
    <Button intent="neutral" variant="ghost" onclick={reset}>Reset</Button>
  </div>
</div>

<ConfirmDialog
  bind:open={showConfirm}
  title="Unsaved changes"
  description="You have changes that haven't been saved yet. Save and continue, or cancel?"
  intent="warning"
  confirmLabel="Save and leave"
  cancelLabel="Cancel"
  onConfirm={saveAndLeave}
  onCancel={cancelLeave}
>
  <!-- The third exit. ConfirmDialog ships two buttons; extra actions render
       as children. -->
  <button
    type="button"
    class="text-danger hover:text-danger-emphasis text-sm underline-offset-2 hover:underline"
    onclick={discardAndLeave}
  >
    Discard changes and leave anyway
  </button>
</ConfirmDialog>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <div class="space-y-10">
      <CodeExample
        title="PropertyForm.svelte"
        description="Edit the name, then `Leave`: the dialog steps in only while the field holds an unsaved edit. An alert stands in for the navigation."
        code={recipeCode}
        language="svelte"
        headingLevel={2}
      >
        <div class="w-full max-w-md space-y-6">
          <Input
            label="Property name"
            bind:value={name}
            helper={dirty ? 'Unsaved changes' : 'No changes'}
            intent={dirty ? 'warning' : 'default'}
          />

          <div class="flex flex-wrap items-center gap-3">
            <Button intent="primary" onclick={leave}>Leave</Button>
            <Button intent="neutral" variant="outlined" onclick={save}>Save</Button>
            <Button intent="neutral" variant="ghost" onclick={reset}>Reset</Button>
          </div>
        </div>

        <ConfirmDialog
          bind:open={showConfirm}
          title="Unsaved changes"
          description="You have changes that haven't been saved yet. Save and continue, or cancel?"
          intent="warning"
          confirmLabel="Save and leave"
          cancelLabel="Cancel"
          onConfirm={saveAndLeave}
          onCancel={cancelLeave}
        >
          <button
            type="button"
            class="text-danger hover:text-danger-emphasis text-sm underline-offset-2 hover:underline"
            onclick={discardAndLeave}
          >
            Discard changes and leave anyway
          </button>
        </ConfirmDialog>
      </CodeExample>

      <CodeExample
        title="use-unsaved-guard.svelte.ts"
        description="The other file: `PropertyForm.svelte` imports it as a sibling — move it to `$lib` once more forms need it."
        code={guardCode}
        preview={false}
        language="typescript"
        headingLevel={2}
      />
    </div>
  </Section>

  <Section id="decisions" title="Three decisions">
    <NoteList>
      <Note title="A recipe, not a component">
        <p>
          The guard is app state end to end: what counts as dirty, what saving means, where discard
          resets to, which route the retry goes to. A library
          <code class="text-text-primary">&lt;UnsavedChangesGuard&gt;</code> would wrap five lines of
          setup in coupling to all four, so the pattern ships as this page plus the hook. You may not
          need either: a schema that tolerates saving on every change (settings, notes) can auto-save,
          and the question disappears. The guard is for forms where saving is an explicit step.
        </p>
      </Note>
      <Note title="Three exits, not two">
        <p>
          A two-button dialog forces a bad choice: commit whatever is in the form, or stay on the
          page. The third path, discarding, is the one people reach for when the edit was
          exploratory, so it rides in as
          <code class="text-text-primary">ConfirmDialog</code> children. It renders as a quiet danger-coloured
          link rather than a third button on purpose: it throws work away, and the footer pair should
          stay the obvious pick.
        </p>
      </Note>
      <Note title="The browser owns the leaving prompt">
        <p>
          Browsers stopped rendering custom text on tab close years ago: on a
          <code class="text-text-primary">'leave'</code> navigation the most an app gets is
          <code class="text-text-primary">nav.cancel()</code>, which arms the generic native
          confirmation. The three-exit dialog is therefore only possible for navigations the router
          owns, and the hook bails on <code class="text-text-primary">'leave'</code> so the dialog cannot
          open underneath the native prompt. It is also why the demo mocks navigation with an alert: a
          docs page cannot leave itself to show the real interception.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
