<script lang="ts">
  import { ArrowRightIcon, Avatar, BuildingIcon, Card } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  // What the list demo shows after a click — the recipe's stand-in for a real action.
  let lastClicked = $state<string | null>(null);

  const users = [
    { id: '1', name: 'Anna Schulz', role: 'Administration' },
    { id: '2', name: 'Bernd Krüger', role: 'Accounting' },
    { id: '3', name: 'Cara Lentz', role: 'Caretaker' }
  ];

  const recipeCode = `<\script lang="ts">
  import { ArrowRightIcon, BuildingIcon, Card } from '@urbicon-ui/blocks';
<\/script>

<!-- The width cap fits the docs stage — size the grid in your dashboard
     layout. The demo's links are fragments; your tiles take routes. -->
<div class="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
  <Card variant="elevated" padding="md" href="#revenue" mint="translate">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-text-tertiary text-xs font-medium">Revenue</p>
        <p class="text-text-primary mt-1 text-2xl font-semibold tabular-nums">€42,150</p>
        <p class="text-success mt-1 text-xs">+12.4% vs. last month</p>
      </div>
      <ArrowRightIcon size={16} class="text-text-tertiary" />
    </div>
  </Card>
  <Card variant="elevated" padding="md" href="#buildings" mint="translate">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-text-tertiary text-xs font-medium">Properties</p>
        <p class="text-text-primary mt-1 text-2xl font-semibold tabular-nums">12</p>
        <p class="text-text-tertiary mt-1 text-xs">3 in progress</p>
      </div>
      <BuildingIcon size={16} class="text-text-tertiary" />
    </div>
  </Card>
</div>`;

  const listCode = `<\script lang="ts">
  import { ArrowRightIcon, Avatar, Card } from '@urbicon-ui/blocks';

  // Stand-in for your action — open the user, start a selection; the demo
  // only records who was clicked.
  let lastClicked = $state<string | null>(null);

  const users = [
    { id: '1', name: 'Anna Schulz', role: 'Administration' },
    { id: '2', name: 'Bernd Krüger', role: 'Accounting' },
    { id: '3', name: 'Cara Lentz', role: 'Caretaker' }
  ];
<\/script>

<div class="w-full max-w-lg">
  <div class="space-y-2">
    {#each users as user (user.id)}
      <Card variant="quiet" padding="sm" onclick={() => (lastClicked = user.name)}>
        <div class="flex items-center gap-3">
          <Avatar name={user.name} size="sm" />
          <div class="min-w-0 flex-1">
            <p class="text-text-primary text-sm font-medium">{user.name}</p>
            <p class="text-text-tertiary text-xs">{user.role}</p>
          </div>
          <ArrowRightIcon size={16} class="text-text-tertiary" />
        </div>
      </Card>
    {/each}
  </div>
  {#if lastClicked}
    <p class="text-text-tertiary mt-3 text-sm">
      Last clicked: <span class="text-text-primary font-medium">{lastClicked}</span>
    </p>
  {/if}
</div>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <div class="space-y-10">
      <CodeExample
        title="DashboardTiles.svelte"
        description="Each tile renders as one `<a>`: hover lifts it, and Tab reaches it as a single stop."
        code={recipeCode}
        language="svelte"
        headingLevel={2}
      >
        <div class="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          <Card variant="elevated" padding="md" href="#revenue" mint="translate">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-text-tertiary text-xs font-medium">Revenue</p>
                <p class="text-text-primary mt-1 text-2xl font-semibold tabular-nums">€42,150</p>
                <p class="text-success mt-1 text-xs">+12.4% vs. last month</p>
              </div>
              <ArrowRightIcon size={16} class="text-text-tertiary" />
            </div>
          </Card>
          <Card variant="elevated" padding="md" href="#buildings" mint="translate">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-text-tertiary text-xs font-medium">Properties</p>
                <p class="text-text-primary mt-1 text-2xl font-semibold tabular-nums">12</p>
                <p class="text-text-tertiary mt-1 text-xs">3 in progress</p>
              </div>
              <BuildingIcon size={16} class="text-text-tertiary" />
            </div>
          </Card>
        </div>
      </CodeExample>

      <CodeExample
        title="TeamList.svelte"
        description="Click a card and the line below records it: `onclick` renders each card as a `<button>`."
        code={listCode}
        language="svelte"
        headingLevel={2}
      >
        <div class="w-full max-w-lg">
          <div class="space-y-2">
            {#each users as user (user.id)}
              <Card variant="quiet" padding="sm" onclick={() => (lastClicked = user.name)}>
                <div class="flex items-center gap-3">
                  <Avatar name={user.name} size="sm" />
                  <div class="min-w-0 flex-1">
                    <p class="text-text-primary text-sm font-medium">{user.name}</p>
                    <p class="text-text-tertiary text-xs">{user.role}</p>
                  </div>
                  <ArrowRightIcon size={16} class="text-text-tertiary" />
                </div>
              </Card>
            {/each}
          </div>
          {#if lastClicked}
            <p class="text-text-tertiary mt-3 text-sm">
              Last clicked: <span class="text-text-primary font-medium">{lastClicked}</span>
            </p>
          {/if}
        </div>
      </CodeExample>
    </div>
  </Section>

  <Section id="decisions" title="Where the click lives">
    <!--
      Raw <pre> in both panels, not CodeExample. The two snippets are one
      comparison read side by side, and a CodeExample brings a title bar, a
      language tag and a copy button each — three chrome elements per panel in a
      grid cell, and a copy button on the "Don't" half that invites exactly the
      thing this section warns against. The danger/success tints are meaning,
      not chrome: they are what tells the two halves apart at a glance.
    -->
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="border-danger/30 bg-danger-subtle rounded-contain border p-4">
        <p class="text-danger-emphasis mb-2 text-xs font-semibold tracking-wide uppercase">Don't</p>
        <pre class="text-text-primary mb-3 text-xs whitespace-pre-wrap"><code
            >{`<a href="/revenue">
  <Card variant="elevated" padding="md">
    Content
  </Card>
</a>`}</code
          ></pre>
        <ul class="text-text-secondary list-disc space-y-1 pl-4 text-xs">
          <li>
            The Card keeps rendering a <code class="text-text-primary">div</code>: hover, focus and
            mint styles wait for a click source, so the card shows none of them.
          </li>
          <li>
            A button or link inside the card now nests inside the outer
            <code class="text-text-primary">&lt;a&gt;</code> (invalid HTML, an a11y violation).
          </li>
        </ul>
      </div>
      <div class="border-success/30 bg-success-subtle rounded-contain border p-4">
        <p class="text-success-emphasis mb-2 text-xs font-semibold tracking-wide uppercase">Do</p>
        <pre class="text-text-primary mb-3 text-xs whitespace-pre-wrap"><code
            >{`<Card
  variant="elevated"
  padding="md"
  href="/revenue"
>
  Content
</Card>`}</code
          ></pre>
        <ul class="text-text-secondary list-disc space-y-1 pl-4 text-xs">
          <li>
            The card itself is the <code class="text-text-primary">&lt;a&gt;</code>: one element,
            one tab stop, hover and focus styles included.
          </li>
          <li>Cmd-click and middle-click open the route in a new tab, like on any link.</li>
        </ul>
      </div>
    </div>

    <NoteList class="mt-6">
      <Note title="href for routes, onclick for actions">
        <p>
          A destination takes <code class="text-text-primary">href</code>: the card renders as an
          <code class="text-text-primary">&lt;a&gt;</code>, and Cmd-click, middle-click and
          open-in-new-tab work as on any link. An action (open a dialog, pick an entry) takes
          <code class="text-text-primary">onclick</code>: the card renders as a
          <code class="text-text-primary">&lt;button type="button"&gt;</code>. The third case is
          <code class="text-text-primary">clickable</code>: it forces the button rendering without a
          handler, for a wrapper component that owns the click handling itself.
        </p>
      </Note>
      <Note title="No click source, no hover">
        <p>
          Card has no decorative-hover mode: a pointer cursor and a lift on a card that goes nowhere
          would promise an interaction that never comes (WCAG 3.2, Predictable). Hover, the focus
          ring and <code class="text-text-primary">mint</code> switch on together with
          <code class="text-text-primary">href</code>,
          <code class="text-text-primary">onclick</code>
          or <code class="text-text-primary">clickable</code>. When a passive card seems to need the
          interactive look, give it its click source; wrapping it in an
          <code class="text-text-primary">&lt;a&gt;</code> is the pattern the comparison above warns against.
        </p>
      </Note>
      <Note title="One target per card">
        <p>
          <code class="text-text-primary">href</code> and
          <code class="text-text-primary">onclick</code> turn the whole card into a single
          <code class="text-text-primary">&lt;a&gt;</code> or
          <code class="text-text-primary">&lt;button&gt;</code>, and HTML allows no interactive
          content inside either. A row that needs a secondary action (a "Favorite" button, a menu)
          keeps the Card passive and puts the targets inside it: the name becomes the link, the
          action a Button of its own.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
