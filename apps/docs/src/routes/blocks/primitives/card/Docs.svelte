<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Card, Badge, Button } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Choosing a variant"
      description="`quiet` is the default — a barely-tinted in-page zone, no border, no shadow. `outlined` adds a quiet outline when you need architectural delineation. `elevated` lifts the card with a shadow only. `floating` is for popover-family surfaces above arbitrary backgrounds."
      isolate
      previewClass="grid grid-cols-2 gap-4 max-w-2xl"
    >
      <Card variant="quiet">
        <p class="text-text-secondary text-sm">Quiet – subtle tint, default</p>
      </Card>
      <Card variant="outlined">
        <p class="text-text-secondary text-sm">Outlined – border only</p>
      </Card>
      <Card variant="elevated">
        <p class="text-text-secondary text-sm">Elevated – shadow only</p>
      </Card>
      <Card variant="floating">
        <p class="text-text-secondary text-sm">Floating – popover surface</p>
      </Card>
    </CodeExample>

    <CodeExample
      title="Stat tile"
      description="Compact KPI summary — pair a metric with a delta and trend hint."
      isolate
      previewClass="flex justify-center max-w-xs w-full mx-auto"
    >
      <Card padding="md">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Monthly Revenue
        </p>
        <p class="text-text-primary mt-2 text-3xl font-bold">$48,210</p>
        <div class="mt-2 flex items-center gap-2">
          <Badge size="xs" intent="success">+12.4%</Badge>
          <span class="text-text-tertiary text-xs">vs. last month</span>
        </div>
      </Card>
    </CodeExample>

    <CodeExample
      title="Profile card with header & footer"
      description="The `header` and `footer` snippets render in semantically appropriate positions. Set `dividers` to draw hairline separators between header, body and footer for a more structured look."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <Card variant="outlined" dividers>
        {#snippet header()}
          <div class="flex items-center gap-2">
            <span class="font-semibold">Project Update</span>
            <Badge size="xs" intent="success">New</Badge>
          </div>
        {/snippet}

        <p class="text-text-secondary text-sm">
          The latest build passed all 142 tests. Deployment is scheduled for Monday.
        </p>

        {#snippet footer()}
          <div class="flex justify-end gap-2">
            <Button variant="ghost" size="sm">Dismiss</Button>
            <Button variant="filled" intent="primary" size="sm">View Details</Button>
          </div>
        {/snippet}
      </Card>
    </CodeExample>

    <CodeExample
      title="Clickable navigation card"
      description="Set `href` to render as `<a>` or `onclick` to render as `<button>` — hover styles activate automatically. Pair with `mint=&quot;scale&quot;` for a subtle press affordance."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <Card href="#documentation" mint="scale">
        <div class="flex items-start gap-3">
          <div
            class="bg-primary/10 text-primary rounded-modify flex h-10 w-10 shrink-0 items-center justify-center font-semibold"
          >
            →
          </div>
          <div>
            <p class="text-text-primary font-semibold">Read the documentation</p>
            <p class="text-text-secondary mt-1 text-sm">
              Browse component APIs, design tokens, and integration guides.
            </p>
          </div>
        </div>
      </Card>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Gradient Feature Card"
      description="A bold hero card with gradient background and glass overlay."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <Card
        slotClasses={{
          base: 'bg-linear-to-br from-violet-600 to-indigo-700 text-white border-none shadow-xl shadow-violet-500/25'
        }}
        padding="lg"
      >
        <div class="space-y-3">
          <Badge
            unstyled
            class="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
          >
            Pro Feature
          </Badge>
          <h3 class="text-xl font-bold">Advanced Analytics</h3>
          <p class="text-sm text-white/80">
            Real-time dashboards, custom reports, and AI-powered insights for your team.
          </p>
          <Button
            unstyled
            class="mt-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition-all hover:bg-white/90"
          >
            Get Started
          </Button>
        </div>
      </Card>
    </CodeExample>

    <CodeExample
      title="Glass Pricing Card"
      description="Glassmorphism card over a colorful background."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-rose-500 via-fuchsia-500 to-indigo-500 px-8 py-10"
    >
      <Card
        unstyled
        class="w-72 rounded-2xl border border-white/20 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl"
      >
        <p class="text-sm font-medium tracking-wider text-white/70 uppercase">Premium</p>
        <p class="mt-2 text-4xl font-bold">
          $29<span class="text-lg font-normal text-white/60">/mo</span>
        </p>
        <ul class="mt-4 space-y-2 text-sm text-white/80">
          <li>✓ Unlimited projects</li>
          <li>✓ Priority support</li>
          <li>✓ Custom integrations</li>
        </ul>
        <Button
          unstyled
          class="mt-6 w-full rounded-xl bg-white py-2.5 text-center text-sm font-semibold text-fuchsia-600 transition-all hover:bg-white/90"
        >
          Subscribe
        </Button>
      </Card>
    </CodeExample>

    <CodeExample
      title="Dark Minimal"
      description="Sleek card with dark surface and accent border — useful on light page backgrounds where the contrast itself is the design."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <Card
        unstyled
        class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-[var(--blocks-shadow-lg)]"
      >
        <div class="flex items-start gap-4">
          <div
            class="bg-primary/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
          >
            ⚡
          </div>
          <div>
            <h4 class="font-semibold text-neutral-100">Lightning Fast</h4>
            <p class="mt-1 text-sm text-neutral-400">
              Zero-config bundling with sub-second hot reload and tree-shaking built in.
            </p>
          </div>
        </div>
      </Card>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A hero-card look reused across marketing surfaces belongs in a <code class="text-text-primary"
        >BlocksProvider</code
      >
      preset (<code class="text-text-primary">presets.Card</code>), applied via
      <code class="text-text-primary">preset</code>
      — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        Cards render as <code class="text-text-primary">&lt;div&gt;</code> by default. When
        <code class="text-text-primary">clickable</code>
        or
        <code class="text-text-primary">onclick</code> is set, the card renders as
        <code class="text-text-primary">&lt;button&gt;</code>. When
        <code class="text-text-primary">href</code> is provided, it becomes an
        <code class="text-text-primary">&lt;a&gt;</code>. Disabled cards set
        <code class="text-text-primary">aria-disabled</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Interactive cards are focusable via
        <kbd
          class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
          >Tab</kbd
        >
        and activate with
        <kbd
          class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
          >Enter</kbd
        >
        /
        <kbd
          class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
          >Space</kbd
        >. Non-interactive cards are skipped in the tab order.
      </p>
    </Note>
    <Note title="Structure">
      <p>
        Header and footer snippets are rendered in semantically appropriate positions. Use headings
        inside headers to create a scannable document outline for screen readers.
      </p>
    </Note>
  </NoteList>
</Section>
