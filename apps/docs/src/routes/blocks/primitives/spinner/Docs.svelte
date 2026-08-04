<!-- urbicon-ignore raw-tailwind-color — the 3 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Badge, Card, CheckIcon, Spinner } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="In a list"
      description="The two places a list needs a spinner: on a single row while its action runs and the rest of the list stays interactive, and at the foot of the list while the next page is fetched."
      isolate
      previewClass="flex flex-col items-center gap-6 max-w-sm w-full mx-auto"
    >
      <div
        class="border-border-subtle bg-surface-elevated divide-border-subtle w-full divide-y rounded-2xl border"
      >
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="text-text-primary flex-1 text-sm">design-tokens.md</span>
          <Badge intent="success" size="sm" variant="soft">Synced</Badge>
        </div>
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="text-text-primary flex-1 text-sm">components.tsx</span>
          <Spinner size="sm" intent="primary" label="Syncing components.tsx" />
        </div>
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="text-text-primary flex-1 text-sm">accessibility-audit.md</span>
          <Badge intent="neutral" size="sm" variant="soft">Queued</Badge>
        </div>
      </div>

      <div class="border-border-subtle bg-surface-elevated w-full rounded-2xl border p-4">
        <ul class="space-y-2.5">
          <li class="text-text-primary text-sm">Item 1 — Loaded</li>
          <li class="text-text-primary text-sm">Item 2 — Loaded</li>
          <li class="text-text-primary text-sm">Item 3 — Loaded</li>
        </ul>
        <div class="border-border-subtle mt-4 flex items-center justify-center gap-2 border-t pt-4">
          <Spinner size="sm" variant="dots" intent="primary" />
          <span class="text-text-tertiary text-xs">Loading more…</span>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Color inheritance"
      description="Use `intent='current'` so the spinner picks up the surrounding text color via `currentColor` — ideal inside coloured surfaces, badges, or alerts where a fixed intent would clash."
      isolate
      previewClass="flex flex-wrap items-center gap-4"
    >
      <div
        class="text-success-emphasis bg-success/15 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
      >
        <Spinner size="xs" intent="current" />
        Deploying
      </div>
      <div
        class="text-warning-emphasis bg-warning/15 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
      >
        <Spinner size="xs" intent="current" />
        Retrying
      </div>
      <div
        class="text-danger-emphasis bg-danger/15 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
      >
        <Spinner size="xs" intent="current" />
        Rolling back
      </div>
    </CodeExample>

    <CodeExample
      title="Content Loading Overlay"
      description="Frosted glass overlay with centered spinner for in-place content loading."
      isolate
      previewClass="flex justify-center w-full"
    >
      <div class="relative w-full max-w-sm overflow-hidden">
        <Card padding="lg">
          <div class="space-y-3 opacity-30 select-none" aria-hidden="true">
            <div class="bg-surface-subtle rounded-modify h-4 w-3/4"></div>
            <div class="bg-surface-subtle rounded-modify h-4 w-full"></div>
            <div class="bg-surface-subtle rounded-modify h-4 w-5/6"></div>
            <div class="bg-surface-subtle rounded-modify mt-4 h-8 w-1/3"></div>
          </div>
        </Card>
        <div
          class="bg-surface-base/60 rounded-contain absolute inset-0 z-[var(--z-docked)] flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
        >
          <Spinner size="lg" intent="primary" variant="ring" />
          <p class="text-text-secondary text-sm font-medium">Loading content…</p>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Status Pipeline"
      description="Spinners as part of a multi-step processing flow."
      isolate
      previewClass="flex justify-center w-full"
    >
      <div class="flex w-full max-w-md flex-col gap-4">
        <div class="flex items-center gap-3">
          <div
            class="bg-success/15 text-success flex h-8 w-8 items-center justify-center rounded-full"
          >
            <CheckIcon size={16} />
          </div>
          <span class="text-text-secondary text-sm">Files uploaded</span>
          <Badge intent="success" size="sm" variant="soft" class="ml-auto">Done</Badge>
        </div>
        <div class="flex items-center gap-3">
          <Spinner size="lg" intent="primary" variant="bars" speed="fast" />
          <span class="text-text-primary text-sm font-medium">Processing data…</span>
          <Badge intent="primary" size="sm" variant="soft" pulse class="ml-auto">Active</Badge>
        </div>
        <div class="flex items-center gap-3">
          <div
            class="bg-surface-subtle text-text-tertiary flex h-8 w-8 items-center justify-center rounded-full"
          >
            <span class="text-xs font-bold">3</span>
          </div>
          <span class="text-text-tertiary text-sm">Deploy to production</span>
          <Badge intent="neutral" size="sm" variant="soft" class="ml-auto">Pending</Badge>
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Slot Overrides"
      description="Use slotClasses to restyle individual parts without unstyled mode."
      isolate
      previewClass="flex items-center gap-8"
    >
      <Spinner
        size="xl"
        slotClasses={{
          svgCircle: 'opacity-10',
          svgPath: 'fill-current drop-shadow-[0_0_6px_currentColor]'
        }}
      />
      <Spinner variant="dots" size="xl" intent="success" slotClasses={{ dot: 'rounded-none' }} />
      <Spinner variant="bars" size="xl" intent="danger" slotClasses={{ bar: 'rounded-full' }} />
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Drop all defaults and build a completely unique indicator."
      isolate
      previewClass="flex items-center gap-10 rounded-xl bg-neutral-950 px-10 py-8"
    >
      <Spinner
        unstyled
        class="relative inline-flex h-10 w-10 items-center justify-center"
        slotClasses={{
          svg: 'w-full h-full animate-spin [animation-duration:0.8s]',
          svgCircle: 'opacity-0',
          svgPath: 'fill-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]'
        }}
        label="Syncing"
      />
      <Spinner
        variant="dots"
        unstyled
        class="inline-flex h-10 items-center gap-2"
        slotClasses={{
          dots: 'flex items-center gap-2',
          dot: 'h-2.5 w-2.5 rounded-full bg-emerald-400 animate-bounce [animation-duration:0.8s] shadow-[0_0_8px_rgba(52,211,153,0.5)]'
        }}
        label="Connecting"
      />
      <Spinner
        variant="bars"
        unstyled
        class="inline-flex h-10 items-center"
        slotClasses={{
          bars: 'flex items-center gap-1',
          bar: 'w-1 h-7 rounded-full bg-violet-400 [animation-name:spinner-bars] [animation-duration:0.7s] [animation-timing-function:ease-in-out] [animation-iteration-count:infinite] [&:nth-child(1)]:delay-[-0.36s] [&:nth-child(2)]:delay-[-0.24s] [&:nth-child(3)]:delay-[-0.12s] shadow-[0_0_8px_rgba(167,139,250,0.5)]'
        }}
        label="Analyzing"
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A branded loader used across the app belongs in a <code class="text-text-primary"
        >BlocksProvider</code
      >
      preset (<code class="text-text-primary">presets.Spinner</code>), applied via
      <code class="text-text-primary">preset</code>
      — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Screen Reader">
      <p>
        Uses <code class="text-text-primary">role="status"</code> with
        <code class="text-text-primary">aria-label</code> from the
        <code class="text-text-primary">label</code> prop (defaults to "Loading…"). The
        <code class="text-text-primary">aria-live="polite"</code> region announces loading state without
        interrupting the user.
      </p>
    </Note>
    <Note title="Visibility">
      <p>
        When <code class="text-text-primary">visible={'{'}false}</code>, the spinner is removed from
        the DOM entirely — no visual output and no accessibility tree entry.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        All animations (spin, bounce, pulse, bars) respect
        <code class="text-text-primary">prefers-reduced-motion: reduce</code> via Tailwind's
        <code class="text-text-primary">motion-reduce:</code> variant. In reduced-motion mode the spinner
        still renders statically to indicate loading.
      </p>
    </Note>
    <Note title="Print">
      <p>
        Spinners are hidden from print output via a
        <code class="text-text-primary">@media print</code> rule.
      </p>
    </Note>
  </NoteList>
</Section>
