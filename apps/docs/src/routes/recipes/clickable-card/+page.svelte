<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Card, Badge, Avatar, ArrowRightIcon, UsersIcon, BuildingIcon } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  let lastClickedUser = $state<string | null>(null);

  const users = [
    { id: '1', name: 'Anna Schulz', role: 'Administration' },
    { id: '2', name: 'Bernd Krüger', role: 'Accounting' },
    { id: '3', name: 'Cara Lentz', role: 'Caretaker' }
  ];
</script>

<SeoMeta
  title="Clickable Card Recipe"
  description="Card as a clickable element — href, onclick, clickable. With anti-pattern comparison."
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
    <div class="space-y-8">
      <div>
        <p class="text-text-primary mb-3 text-sm font-semibold">
          Dashboard tile with navigation (<code class="text-text-tertiary text-xs">href</code>)
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <Card variant="outlined" padding="md" href="#revenue" mint="translate">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-text-tertiary text-xs font-medium">Revenue</p>
                <p class="text-text-primary mt-1 text-2xl font-semibold tabular-nums">€42,150</p>
                <p class="text-success mt-1 text-xs">+12.4% vs. last month</p>
              </div>
              <ArrowRightIcon class="text-text-tertiary h-4 w-4" />
            </div>
          </Card>
          <Card variant="outlined" padding="md" href="#buildings" mint="translate">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-text-tertiary text-xs font-medium">Properties</p>
                <p class="text-text-primary mt-1 text-2xl font-semibold tabular-nums">12</p>
                <p class="text-text-tertiary mt-1 text-xs">3 in progress</p>
              </div>
              <BuildingIcon class="text-text-tertiary h-4 w-4" />
            </div>
          </Card>
        </div>
      </div>

      <div>
        <p class="text-text-primary mb-3 text-sm font-semibold">
          List card with action (<code class="text-text-tertiary text-xs">onclick</code>)
        </p>
        <div class="space-y-2">
          {#each users as user (user.id)}
            <Card variant="outlined" padding="sm" onclick={() => (lastClickedUser = user.name)}>
              <div class="flex items-center gap-3">
                <Avatar name={user.name} size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="text-text-primary text-sm font-medium">{user.name}</p>
                  <p class="text-text-tertiary text-xs">{user.role}</p>
                </div>
                <ArrowRightIcon class="text-text-tertiary h-4 w-4" />
              </div>
            </Card>
          {/each}
        </div>
        {#if lastClickedUser}
          <p class="text-text-tertiary mt-3 text-sm">
            Last clicked: <span class="text-text-primary font-medium">{lastClickedUser}</span>
          </p>
        {/if}
      </div>

      <div>
        <p class="text-text-primary mb-3 text-sm font-semibold">
          Navigation tile with icon (<code class="text-text-tertiary text-xs">href</code> + icon)
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <Card variant="elevated" padding="md" href="#tenants">
            <div class="flex flex-col items-start gap-3">
              <span
                class="bg-primary-subtle text-primary grid h-10 w-10 place-items-center rounded-lg"
              >
                <UsersIcon class="h-5 w-5" />
              </span>
              <div>
                <p class="text-text-primary text-sm font-semibold">Tenants</p>
                <p class="text-text-tertiary text-xs">38 active</p>
              </div>
            </div>
          </Card>
          <Card variant="elevated" padding="md" href="#units">
            <div class="flex flex-col items-start gap-3">
              <span
                class="bg-success-subtle text-success grid h-10 w-10 place-items-center rounded-lg"
              >
                <BuildingIcon class="h-5 w-5" />
              </span>
              <div>
                <p class="text-text-primary text-sm font-semibold">Apartments</p>
                <p class="text-text-tertiary text-xs">42 managed</p>
              </div>
            </div>
          </Card>
          <Card variant="elevated" padding="md" href="#invoices">
            <div class="flex flex-col items-start gap-3">
              <span
                class="bg-warning-subtle text-warning-emphasis grid h-10 w-10 place-items-center rounded-lg"
              >
                <ArrowRightIcon class="h-5 w-5" />
              </span>
              <div>
                <p class="text-text-primary text-sm font-semibold">Invoices</p>
                <p class="text-text-tertiary text-xs">5 open</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
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
        title="Stat tile with href (renders as <a>)"
        preview={false}
        language="svelte"
        code={`<Card variant="outlined" padding="md" href="/revenue" mint="translate">
  <div class="flex items-start justify-between">
    <div>
      <p class="text-text-tertiary text-xs font-medium">Revenue</p>
      <p class="text-text-primary text-2xl font-semibold tabular-nums">€42,150</p>
      <p class="text-success text-xs">+12.4% vs. last month</p>
    </div>
    <ArrowRightIcon class="text-text-tertiary h-4 w-4" />
  </div>
</Card>`}
      />

      <CodeExample
        title="List card with onclick (renders as <button>)"
        preview={false}
        language="svelte"
        code={`<Card
  variant="outlined"
  padding="sm"
  onclick={() => navigateTo(user.id)}
>
  <div class="flex items-center gap-3">
    <Avatar name={user.name} size="sm" />
    <div class="min-w-0 flex-1">
      <p class="text-text-primary text-sm font-medium">{user.name}</p>
      <p class="text-text-tertiary text-xs">{user.role}</p>
    </div>
  </div>
</Card>`}
      />

      <CodeExample
        title="Delegate click without onclick (clickable prop)"
        preview={false}
        language="svelte"
        code={`<!-- Render Card as a <button> without it carrying a handler itself —
     for patterns where a wrapper component intercepts clicks (e.g. a
     selection picker bound across multiple Card children).
     Don't nest it inside an outer <a> — that produces
     <a><button> nesting (an a11y violation). -->
<Card variant="outlined" padding="md" clickable>
  ...
</Card>`}
      />
    </div>
  </Section>

  <Section id="anti-pattern" title="Anti-pattern: wrapping Card in <a>">
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="border-danger/30 bg-danger-subtle rounded-lg border p-4">
        <p class="text-danger-emphasis mb-2 text-xs font-semibold tracking-wide uppercase">Don't</p>
        <pre class="text-text-primary mb-3 text-xs whitespace-pre-wrap"><code
            >{`<a href="/revenue">
  <Card variant="outlined" padding="md">
    Content
  </Card>
</a>`}</code
          ></pre>
        <ul class="text-text-secondary list-disc space-y-1 pl-4 text-xs">
          <li>
            Card keeps <code class="text-text-primary">elementType="div"</code> — no hover/focus styles
          </li>
          <li>Inner inputs/links produce nested interactive elements (a11y violation)</li>
          <li>Two tab stops (outer a + card content) instead of one</li>
          <li>Screen readers announce "link, region, …" twice</li>
        </ul>
      </div>
      <div class="border-success/30 bg-success-subtle rounded-lg border p-4">
        <p class="text-success-emphasis mb-2 text-xs font-semibold tracking-wide uppercase">Do</p>
        <pre class="text-text-primary mb-3 text-xs whitespace-pre-wrap"><code
            >{`<Card
  variant="outlined"
  padding="md"
  href="/revenue"
>
  Content
</Card>`}</code
          ></pre>
        <ul class="text-text-secondary list-disc space-y-1 pl-4 text-xs">
          <li>
            Card renders directly as <code class="text-text-primary">&lt;a&gt;</code>
          </li>
          <li>Hover/focus styles apply automatically</li>
          <li>One tab stop, one element for screen readers</li>
          <li>No conflicts with inner buttons (stop bubbling where needed)</li>
        </ul>
      </div>
    </div>
  </Section>

  <Section id="best-practices" title="Best Practices">
    <Card variant="outlined">
      <div class="divide-border-subtle divide-y">
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">
            href for navigation, onclick for actions
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            Routes, detail pages → <code class="text-text-primary">href</code>. Opening a modal,
            changing a selection, server actions → <code class="text-text-primary">onclick</code>.
            That way Cmd-click "open in new tab" works as expected.
          </p>
        </div>
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">
            Inner buttons: <code class="text-text-primary">stopPropagation</code>
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            If the card contains a secondary button (e.g. "Favorite"), end the button's
            <code class="text-text-primary">onclick</code>
            with <code class="text-text-primary">event.stopPropagation()</code>
            — otherwise the card fires too.
          </p>
        </div>
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">
            mint="translate" for a gentle hover animation
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            <code class="text-text-primary">mint="translate"</code> lifts the card slightly on
            hover;
            <code class="text-text-primary">mint="glow"</code> adds a subtle glow.
            <code class="text-text-primary">prefers-reduced-motion</code> is respected.
          </p>
        </div>
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">
            <code class="text-text-primary">clickable</code> for delegated click handlers
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            When click behavior is handled by a wrapper component and the card should render as a
            real button without carrying an
            <code class="text-text-primary">onclick</code> itself — set
            <code class="text-text-primary">clickable</code> without href/onclick. The card then
            renders as
            <code class="text-text-primary">&lt;button type="button"&gt;</code> with interactive
            styles. Don't combine it with an outer <code>&lt;a&gt;</code> or inner buttons —
            <code>&lt;a&gt;&lt;Card clickable&gt;</code> produces nested interactive elements.
          </p>
        </div>
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">No "decorative hover"</p>
          <p class="text-text-secondary mt-1 text-sm">
            Card deliberately has no mode with hover styles but no click source. A pointer cursor
            plus a lift animation on a passive element violates WCAG 3.2 Predictable. If the card
            sits inside an outer <code>&lt;a&gt;</code>, move the
            <code>href</code> onto the card (see the anti-pattern section).
          </p>
        </div>
      </div>
    </Card>
  </Section>
</div>
