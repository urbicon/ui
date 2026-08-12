<!-- urbicon-ignore raw-tailwind-color — the Customization demo tints the checkbox into a neon
     look with `slotClasses`: it keeps the box's radius tier, focus ring and check-draw
     animation, and only the gradient fill, glow and border are raw — a violet→fuchsia glow the
     token palette has no equivalent for. Every other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Checkbox, Kbd } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let tasks = $state([
    { id: 'tokens', label: 'Design system tokens', done: true },
    { id: 'variants', label: 'Component variants', done: true },
    { id: 'docs', label: 'Documentation pages', done: false },
    { id: 'audit', label: 'Accessibility audit', done: false }
  ]);
  const doneCount = $derived(tasks.filter((t) => t.done).length);

  // Select-all example: a parent summarises a group of child scopes. Two of four
  // start granted, so the parent opens in the indeterminate (mixed) state.
  const scopes = ['Repositories', 'Issues', 'Pull requests', 'Discussions'];
  let granted = $state<string[]>(['Issues', 'Pull requests']);

  let consentError = $state('');
  let consented = $state(false);

  function handleConsent(event: SubmitEvent) {
    event.preventDefault();
    const accepted = new FormData(event.currentTarget as HTMLFormElement).get('terms') === 'on';
    consentError = accepted ? '' : 'Accept the terms to continue';
    consented = accepted;
  }
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Task list"
      description="`bind:checked` writes every click straight back into your data, and `onCheckedChange` runs alongside it with the new boolean. Both hear the user only, so assigning `checked` in your own code stays silent."
      isolate
      previewClass="flex justify-center"
    >
      <div
        class="border-border-subtle bg-surface-elevated flex w-full max-w-sm flex-col gap-1 rounded-2xl border p-4"
      >
        {#each tasks as task (task.id)}
          <Checkbox bind:checked={task.done} label={task.label} />
        {/each}
        <p class="text-text-tertiary mt-2 text-xs">{doneCount} of {tasks.length} done</p>
      </div>
    </CodeExample>

    <CodeExample
      title="Select all"
      description="A click on the mixed box turns everything on, the next one turns it all off. The click clears `indeterminate` on its own, so keep deriving that flag from your data rather than toggling it."
      isolate
      previewClass="flex justify-center"
    >
      {@const allGranted = granted.length === scopes.length}
      {@const someGranted = granted.length > 0 && !allGranted}
      <div
        class="border-border-subtle bg-surface-elevated flex w-full max-w-sm flex-col gap-2 rounded-2xl border p-4"
      >
        <Checkbox
          label="All scopes"
          checked={allGranted}
          indeterminate={someGranted}
          onCheckedChange={(on) => (granted = on ? [...scopes] : [])}
        />
        <div class="border-border-subtle ml-6 flex flex-col gap-2 border-l pl-4">
          {#each scopes as scope (scope)}
            <Checkbox
              label={scope}
              checked={granted.includes(scope)}
              onCheckedChange={(on) =>
                (granted = on ? [...granted, scope] : granted.filter((s) => s !== scope))}
            />
          {/each}
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Consent in a form"
      description="`name` submits the box as `value` (`on` unless you set your own), and only while it is checked. An unchecked box is absent from the `FormData` altogether, so `data.get('terms')` comes back `null` rather than `off`. `error` takes the helper text's place, reddens the message and sets `aria-invalid`."
      isolate
      previewClass="flex justify-center"
    >
      <form class="flex w-full max-w-sm flex-col gap-3" onsubmit={handleConsent}>
        <Checkbox
          name="terms"
          label="I accept the terms of service"
          helper="You can withdraw your consent at any time."
          error={consentError}
        />
        <Button type="submit" size="sm" class="self-start">Continue</Button>
        {#if consented}
          <p class="text-success text-xs">Consent recorded.</p>
        {/if}
      </form>
    </CodeExample>
  </div>
</Section>

<!-- ─── Micro-Interactions ─── -->

<Section marker id="mint" title="Micro-Interactions (Mint)">
  <div class="space-y-8">
    <CodeExample
      title="Two presets at once"
      description="The effect plays on the box, and a click-triggered preset like `bounce` also fires when the click lands on the label text. A single preset is a string, an array runs them together."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <Checkbox mint="glow" label="Glow on hover" checked intent="success" />
      <Checkbox mint={['scale', 'glow']} label="Scale and glow together" checked intent="danger" />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Neon gradient"
      description="The box carries a `data-state` of `unchecked`, `checked` or `indeterminate`, and that is what this gradient keys off. Radius tier, focus ring and check-draw animation keep coming from the defaults underneath."
      isolate
      previewClass="flex min-h-28 flex-col justify-center gap-3 rounded-xl bg-neutral-950 px-8 py-6"
    >
      {@const neon = {
        box: 'border-white/25 bg-transparent text-white group-hover:border-white/40 data-[state=checked]:border-transparent data-[state=checked]:bg-linear-to-br data-[state=checked]:from-violet-500 data-[state=checked]:to-fuchsia-500 data-[state=checked]:shadow-[0_0_14px_rgba(217,70,239,0.65)]',
        label: 'text-white/90'
      }}
      <Checkbox checked label="Notify me about new releases" slotClasses={neon} />
      <Checkbox label="Join the beta program" slotClasses={neon} />
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
    <Note title="Native semantics">
      <p>
        The control is a real <code class="text-text-primary">&lt;input type="checkbox"&gt;</code>,
        so it brings the form and assistive-technology behaviour with it:
        <code class="text-text-primary">name</code> and
        <code class="text-text-primary">value</code> reach
        <code class="text-text-primary">FormData</code> while the box is checked, and
        <code class="text-text-primary">required</code> is the native constraint, browser message
        included. <code class="text-text-primary">indeterminate</code> additionally sets
        <code class="text-text-primary">aria-checked="mixed"</code>.
      </p>
    </Note>
    <Note title="Labels and descriptions">
      <p>
        The whole row is a <code class="text-text-primary">&lt;label&gt;</code>, so a click on the
        text toggles the box. The <code class="text-text-primary">label</code> prop fills that text,
        and where a design leaves it out, an <code class="text-text-primary">aria-label</code>
        passed to the component reaches the input and names it. Helper or error text links to the input
        through <code class="text-text-primary">aria-describedby</code>: an
        <code class="text-text-primary">error</code> takes the helper's place, sets
        <code class="text-text-primary">aria-invalid</code> and is the one announced through
        <code class="text-text-primary">role="alert"</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" /> to focus, <Kbd keys="Space" /> to toggle. The focus ring shows for keyboard
        users only.
      </p>
    </Note>
  </NoteList>
</Section>
