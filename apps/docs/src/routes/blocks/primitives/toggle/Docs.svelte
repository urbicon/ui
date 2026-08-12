<!-- urbicon-ignore raw-tailwind-color — the Customization demo hangs an indigo→violet gradient
     off the track's checked state, a night-sky fill the token palette has no equivalent for.
     It is the only raw colour on the page; every other section stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Kbd, MoonIcon, SunIcon, Toggle } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let darkMode = $state(true);
  let emailDigest = $state(true);
  let readReceipts = $state(false);
  let notifications = $state(true);
  let saved = $state<string | null>(null);

  function handleSubmit(event: SubmitEvent) {
    const data = new FormData(event.currentTarget as HTMLFormElement);
    event.preventDefault();
    saved = [...data.keys()].join(', ') || 'nothing';
  }
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Notification preferences"
      description="`onCheckedChange` receives the new boolean right after the user flips a switch, which is where persisting it belongs. It rides the input's change event, so a `checked` value you assign in code moves the switch without calling it."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <div
        class="bg-surface-elevated border-border-subtle w-full overflow-hidden rounded-2xl border"
      >
        <div class="border-border-subtle border-b px-5 py-3">
          <h3 class="text-text-primary text-sm font-semibold">Notification Preferences</h3>
          <p class="text-text-tertiary text-xs">Manage how you receive updates</p>
        </div>
        <div class="divide-border-subtle divide-y px-5">
          <div class="py-3">
            <Toggle
              bind:checked={notifications}
              label="Push Notifications"
              helper="Receive alerts on your device"
            />
          </div>
          <div class="py-3">
            <Toggle
              bind:checked={emailDigest}
              label="Email Digest"
              helper="Weekly summary of your activity"
            />
          </div>
          <div class="py-3">
            <Toggle
              bind:checked={readReceipts}
              label="Read Receipts"
              helper="Let others know when you've seen their messages"
            />
          </div>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Submitted with a form"
      description="`name` submits the switch as `value` (`on` by default) for as long as it is on. An off switch stays out of the `FormData` altogether, so read the presence of the key rather than a true or false."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <form class="flex w-full flex-col gap-3" onsubmit={handleSubmit}>
        <Toggle name="beta" label="Join the beta channel" />
        <Toggle name="telemetry" label="Share anonymous usage data" checked />
        <Button type="submit" size="sm" class="self-start">Save</Button>
        <p class="text-text-tertiary text-xs">
          Submitted keys: <code class="text-text-primary">{saved ?? 'nothing yet'}</code>
        </p>
      </form>
    </CodeExample>

    <CodeExample
      title="Mint micro-interactions"
      description="The effect listens on the track, so it wants the pointer over the switch itself and stays quiet while the pointer is on the label text. A device without hover never sees it at all."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <Toggle mint="glow" label="Glow on hover" checked intent="success" />
      <Toggle mint={['scale', 'glow']} label="Scale and glow together" checked intent="danger" />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Night-sky track"
      description="Track and thumb both carry a `data-state` of `checked` or `unchecked`, so the gradient hangs off the on-state instead of a ternary in your markup."
      isolate
      previewClass="flex justify-center"
    >
      <div
        class="bg-surface-elevated border-border-subtle inline-flex items-center gap-4 rounded-xl border px-5 py-3"
      >
        <SunIcon size={20} class="text-text-secondary" />
        <Toggle
          bind:checked={darkMode}
          aria-label="Dark mode"
          intent="neutral"
          size="lg"
          slotClasses={{
            track:
              'data-[state=checked]:border-transparent data-[state=checked]:bg-linear-to-r data-[state=checked]:from-indigo-600 data-[state=checked]:to-violet-700 data-[state=checked]:shadow-lg data-[state=checked]:shadow-indigo-500/30'
          }}
        />
        <MoonIcon size={20} class="text-text-secondary" />
      </div>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      If every switch in the app should share a track treatment, set it once as a
      <code class="text-text-primary">defaults</code> entry for
      <code class="text-text-primary">Toggle</code> on a
      <code class="text-text-primary">BlocksProvider</code>. A
      <code class="text-text-primary">preset</code> is the opt-in variant of the same thing: it
      reaches only the switches that name it through their
      <code class="text-text-primary">preset</code> prop.
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

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        The input is a checkbox with <code class="text-text-primary">role="switch"</code> and an
        <code class="text-text-primary">aria-checked</code> that follows the state. A
        <code class="text-text-primary">label</code> names it, helper and error text reach it
        through
        <code class="text-text-primary">aria-describedby</code>, and an
        <code class="text-text-primary">error</code> sets
        <code class="text-text-primary">aria-invalid</code>. Where a design carries no visible text,
        the switch falls back to a translated generic name, so pass your own
        <code class="text-text-primary">aria-label</code> instead.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" /> to focus, <Kbd keys="Space" /> to toggle. The focus ring shows for keyboard
        users only and sits on the track.
      </p>
    </Note>
    <Note title="Reduced motion">
      <p>
        Every Mint effect is switched off under
        <code class="text-text-primary">prefers-reduced-motion</code>, and the thumb slide collapses
        to a millisecond along with every other duration token.
      </p>
    </Note>
    <Note>
      {#snippet titleSnippet()}
        Don't wrap with <code>&lt;label&gt;</code>
      {/snippet}
      <p>
        Toggle renders its own associated <code class="text-text-primary">&lt;label&gt;</code>
        around track and text, and HTML has no meaning for a second one wrapped around that. Give the
        switch its text through the <code class="text-text-primary">label</code> prop instead.
      </p>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <div class="border-danger/30 bg-danger-subtle rounded-lg border p-3">
          <p class="text-danger-emphasis mb-1 text-xs font-semibold tracking-wide uppercase">
            Don't
          </p>
          <pre class="text-text-primary text-xs"><code
              >&lt;label&gt;
  Notifications
  &lt;Toggle /&gt;
&lt;/label&gt;</code
            ></pre>
        </div>
        <div class="border-success/30 bg-success-subtle rounded-lg border p-3">
          <p class="text-success-emphasis mb-1 text-xs font-semibold tracking-wide uppercase">Do</p>
          <pre class="text-text-primary text-xs"><code
              >&lt;Toggle label="Notifications"
        helper="Email + push" /&gt;</code
            ></pre>
        </div>
      </div>
    </Note>
  </NoteList>
</Section>
