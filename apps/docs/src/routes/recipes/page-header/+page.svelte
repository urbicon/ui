<script lang="ts">
  import { Breadcrumb, Button, Tab, TabItem } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  let activeTab = $state('overview');

  // Three demos, one per page type. The former fourth (a form-page header) was
  // the detail header minus the trail at a lower heading level: the action pair
  // lives in the detail demo, the level rule in the decisions note.
  //
  // The demos render <h2> where the snippets say <h1>: the docs page has its
  // h1 in the shell header, and the recipe's first rule (one h1 per page)
  // binds this page too.

  const recipeCode = `<\script lang="ts">
  import { Button } from '@urbicon-ui/blocks';
<\/script>

<!-- The top of your page's content column; the page owns the gap below it. -->
<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
  <div class="min-w-0 flex-1">
    <p class="text-text-tertiary mb-1 text-xs font-medium tracking-wide uppercase">
      Property management
    </p>
    <h1 class="text-text-primary text-3xl font-semibold tracking-tight">Apartments</h1>
    <!-- The subtitle narrows the scope; drop the <p> when it would only repeat the title. -->
    <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
      Master data of all managed apartments: addresses, occupancy, last inspection.
    </p>
  </div>
  <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
    <Button intent="primary">New apartment</Button>
  </div>
</header>`;

  const detailCode = `<\script lang="ts">
  import { Breadcrumb, Button } from '@urbicon-ui/blocks';
<\/script>

<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
  <div class="min-w-0 flex-1">
    <div class="mb-2">
      <Breadcrumb items={[{ label: 'Buildings', href: '#' }, { label: 'Sunset Heights' }]} />
    </div>
    <h1 class="text-text-primary text-3xl font-semibold tracking-tight">Sunset Heights</h1>
    <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
      18 apartments · 4 floors · built 1987.
    </p>
  </div>
  <!-- flex-wrap lets the action pair break to a second line instead of squeezing the title. -->
  <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
    <Button variant="ghost" intent="neutral">Archive</Button>
    <Button intent="primary">Edit</Button>
  </div>
</header>`;

  const tabCode = `<\script lang="ts">
  import { Button, Tab, TabItem } from '@urbicon-ui/blocks';

  let activeTab = $state('overview');
<\/script>

<!-- The same row as the list header, wrapped so the Tab strip joins it inside <header>. -->
<header class="flex flex-col gap-4">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
    <div class="min-w-0 flex-1">
      <h1 class="text-text-primary text-3xl font-semibold tracking-tight">Settings</h1>
      <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
        Manage your account, billing, and team preferences.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
      <Button variant="outlined" intent="neutral">Export</Button>
    </div>
  </div>
  <!-- The strip is part of the header; the panels it switches are the page body below. -->
  <Tab bind:value={activeTab} variant="line">
    {#snippet tabs()}
      <TabItem value="overview">Overview</TabItem>
      <TabItem value="billing">Billing</TabItem>
      <TabItem value="team">Team</TabItem>
    {/snippet}
  </Tab>
</header>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <div class="space-y-10">
      <CodeExample
        title="ListPageHeader.svelte"
        description="Narrow the window below 640px and the action row drops below the title."
        code={recipeCode}
        language="svelte"
        headingLevel={2}
      >
        <header
          class="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
        >
          <div class="min-w-0 flex-1">
            <p class="text-text-tertiary mb-1 text-xs font-medium tracking-wide uppercase">
              Property management
            </p>
            <h2 class="text-text-primary text-3xl font-semibold tracking-tight">Apartments</h2>
            <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
              Master data of all managed apartments: addresses, occupancy, last inspection.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Button intent="primary">New apartment</Button>
          </div>
        </header>
      </CodeExample>

      <CodeExample
        title="DetailPageHeader.svelte"
        description="The `Breadcrumb` sits in the eyebrow's place, and a ghost Archive button joins the primary action."
        code={detailCode}
        language="svelte"
        headingLevel={2}
      >
        <header
          class="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
        >
          <div class="min-w-0 flex-1">
            <div class="mb-2">
              <Breadcrumb
                items={[{ label: 'Buildings', href: '#' }, { label: 'Sunset Heights' }]}
              />
            </div>
            <h2 class="text-text-primary text-3xl font-semibold tracking-tight">Sunset Heights</h2>
            <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
              18 apartments · 4 floors · built 1987.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Button variant="ghost" intent="neutral">Archive</Button>
            <Button intent="primary">Edit</Button>
          </div>
        </header>
      </CodeExample>

      <CodeExample
        title="TabPageHeader.svelte"
        description="Click through the tabs: the strip belongs to the header, the panels it switches do not."
        code={tabCode}
        language="svelte"
        headingLevel={2}
      >
        <header class="flex w-full flex-col gap-4">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div class="min-w-0 flex-1">
              <h2 class="text-text-primary text-3xl font-semibold tracking-tight">Settings</h2>
              <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
                Manage your account, billing, and team preferences.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
              <Button variant="outlined" intent="neutral">Export</Button>
            </div>
          </div>
          <Tab bind:value={activeTab} variant="line">
            {#snippet tabs()}
              <TabItem value="overview">Overview</TabItem>
              <TabItem value="billing">Billing</TabItem>
              <TabItem value="team">Team</TabItem>
            {/snippet}
          </Tab>
        </header>
      </CodeExample>
    </div>
  </Section>

  <Section id="decisions" title="Three decisions">
    <NoteList>
      <Note title="One h1 per page">
        <p>
          The snippets write <code class="text-text-primary">&lt;h1&gt;</code> because this header
          is usually the page's top heading. Inside a
          <code class="text-text-primary">Dialog</code> or
          <code class="text-text-primary">Drawer</code>, or on a route whose layout already renders
          the h1, drop to <code class="text-text-primary">&lt;h2&gt;</code> and take the type a step
          down (<code class="text-text-primary">text-2xl</code>). The demos above render h2 for the
          same reason: this docs page brings its own h1.
        </p>
      </Note>
      <Note title="Eyebrow or breadcrumb, not both">
        <p>
          Both sit in the slot above the title. The eyebrow is a category label ("Property
          management"): context that does not navigate. The
          <code class="text-text-primary">Breadcrumb</code> is a trail of routes you can step back through.
          The list header carries the eyebrow, the detail header the trail; stacked, two lines would name
          the same context twice. Reach for the breadcrumb only when every ancestor is a real page.
        </p>
      </Note>
      <Note title="Why this stays markup">
        <p>
          Nothing here computes: the header renders what the page already knows, and its one piece
          of state, the tab value, is page state it merely displays. A wrapper component would hide
          the markup without saving any logic, and it would fix the structure at the spots where
          pages differ most: a status <code class="text-text-primary">Badge</code> beside the title,
          a filter <code class="text-text-primary">Input</code> in the action row. Copy the variant that
          matches your page and edit it in place.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
