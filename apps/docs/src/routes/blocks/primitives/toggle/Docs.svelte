<!-- urbicon-ignore raw-tailwind-color — the 21 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, MoonIcon, SunIcon, Toggle } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let darkMode = $state(true);
  let autoSave = $state(true);
  let readReceipts = $state(false);
  let notifications = $state(true);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Notification Preferences"
      description="A realistic settings card with interactive toggles — the canonical pattern for preferences, account settings, and feature flags."
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
              intent="primary"
            />
          </div>
          <div class="py-3">
            <Toggle
              bind:checked={autoSave}
              label="Email Digest"
              helper="Weekly summary of your activity"
              intent="primary"
            />
          </div>
          <div class="py-3">
            <Toggle
              bind:checked={readReceipts}
              label="Read Receipts"
              helper="Let others know when you've seen their messages"
              intent="primary"
            />
          </div>
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Micro-Interactions ─── -->

<Section marker="02" id="mint" title="Micro-Interactions (Mint)">
  <div class="space-y-8">
    <CodeExample
      title="Mint Presets"
      description="Hover over each toggle to see the micro-interaction effect."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <Toggle mint="scale" label="Scale on hover" checked />
      <Toggle mint="glow" label="Glow on hover" checked intent="success" />
      <Toggle mint={['scale', 'glow']} label="Combined scale + glow" checked intent="danger" />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Gradient Tracks"
      description="Override the track slot with custom gradients for brand-specific controls."
      isolate
      previewClass="flex flex-col gap-4"
    >
      <Toggle
        checked
        label="Premium Mode"
        slotClasses={{
          track:
            'bg-linear-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25 border-transparent'
        }}
      />
      <Toggle
        checked
        label="Eco Mode"
        slotClasses={{
          track:
            'bg-linear-to-r from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/25 border-transparent'
        }}
      />
      <Toggle
        checked
        label="Sunset Mode"
        slotClasses={{
          track:
            'bg-linear-to-r from-orange-500 to-rose-500 shadow-lg shadow-orange-500/25 border-transparent'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Dark Mode Switch"
      description="A realistic dark mode toggle with icon-like styling."
      isolate
      previewClass="flex justify-center"
    >
      <div
        class="bg-surface-elevated border-border-subtle inline-flex items-center gap-4 rounded-xl border px-5 py-3"
      >
        <SunIcon size={20} class="text-text-secondary" />
        <Toggle
          bind:checked={darkMode}
          intent="neutral"
          size="lg"
          slotClasses={{
            track: darkMode
              ? 'bg-linear-to-r from-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/30 border-transparent'
              : ''
          }}
        />
        <MoonIcon size={20} class="text-text-secondary" />
      </div>
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Strip all defaults and rebuild with a monospace terminal aesthetic. Uses data-state for conditional styling."
      isolate
      previewClass="flex flex-col gap-4 rounded-lg bg-neutral-950 p-6"
    >
      <Toggle
        unstyled
        checked
        label="SYSTEM_ACTIVE"
        slotClasses={{
          control:
            'inline-flex cursor-pointer items-center gap-3 font-mono text-sm text-emerald-400 select-none',
          track:
            'relative h-6 w-12 rounded border border-emerald-500/50 bg-emerald-950/50 transition-colors data-[state=checked]:bg-emerald-500/20 data-[state=checked]:border-emerald-400',
          thumb:
            'absolute left-0.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 rounded-sm bg-emerald-500 transition-all data-[state=checked]:translate-x-6 data-[state=checked]:shadow-[0_0_12px_rgba(16,185,129,0.6)]'
        }}
      />
      <Toggle
        unstyled
        label="NETWORK_IO"
        slotClasses={{
          control:
            'inline-flex cursor-pointer items-center gap-3 font-mono text-sm text-emerald-300 select-none',
          track:
            'relative h-6 w-12 rounded border border-emerald-500/30 bg-emerald-950/30 transition-colors data-[state=checked]:bg-emerald-500/20 data-[state=checked]:border-emerald-400',
          thumb:
            'absolute left-0.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 rounded-sm bg-emerald-500/40 transition-all data-[state=checked]:translate-x-6 data-[state=checked]:bg-emerald-500 data-[state=checked]:shadow-[0_0_12px_rgba(16,185,129,0.6)]'
        }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A brand track treatment reused across settings belongs in a <code class="text-text-primary"
        >BlocksProvider</code
      >
      preset (<code class="text-text-primary">presets.Toggle</code>), applied via
      <code class="text-text-primary">preset</code>
      — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        Renders with <code class="text-text-primary">role="switch"</code> and
        <code class="text-text-primary">aria-checked</code> that updates automatically. Labels are
        associated via <code class="text-text-primary">id</code>, and helper text is linked through
        <code class="text-text-primary">aria-describedby</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" />
        to focus,
        <Kbd keys="Space" />
        to toggle. The focus ring uses
        <code class="text-text-primary">peer-focus-visible:</code> to relay the hidden input's focus state
        onto the visible track.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        The thumb slide animation and all Mint effects are suppressed when
        <code class="text-text-primary">prefers-reduced-motion</code> is enabled.
      </p>
    </Note>
    <Note>
      {#snippet titleSnippet()}
        Don't wrap with <code>&lt;label&gt;</code>
      {/snippet}
      <p>
        Toggle already renders a correctly associated <code class="text-text-primary"
          >&lt;label&gt;</code
        >
        internally. Wrapping it in another <code class="text-text-primary">&lt;label&gt;</code> creates
        nested label semantics — clicks on the outer label may not toggle the switch reliably across browsers,
        and screen readers can announce the label twice.
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
