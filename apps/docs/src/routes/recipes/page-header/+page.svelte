<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { Breadcrumb, Button, Card, Tab, TabItem } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const { features } = recipeMeta;

  let activeTab = $state('overview');
</script>

<SeoMeta
  title="Page Header Recipe"
  description="Top-of-page heading composition with eyebrow, title, subtitle, and actions — pure Tailwind, no component needed."
/>

<div class="mx-auto max-w-5xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <Section id="preview" title="Live Preview">
    <div class="space-y-10">
      <div>
        <p class="text-text-primary mb-3 text-sm font-semibold">List page</p>
        <Card variant="outlined" padding="md">
          <header class="mb-6 flex flex-col gap-4 sm:mb-8">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div class="min-w-0 flex-1">
                <p class="text-text-tertiary mb-1 text-xs font-medium tracking-wide uppercase">
                  Property management
                </p>
                <h2 class="text-text-primary text-3xl font-semibold tracking-tight">Apartments</h2>
                <p
                  class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base"
                >
                  Master data of all managed apartments — addresses, occupancy, last inspection.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Button intent="primary">New apartment</Button>
              </div>
            </div>
          </header>
        </Card>
      </div>

      <div>
        <p class="text-text-primary mb-3 text-sm font-semibold">Detail page with breadcrumb</p>
        <Card variant="outlined" padding="md">
          <header class="mb-6 flex flex-col gap-4 sm:mb-8">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div class="min-w-0 flex-1">
                <div class="mb-2">
                  <Breadcrumb
                    items={[{ label: 'Buildings', href: '#' }, { label: 'Sunset Heights' }]}
                  />
                </div>
                <p class="text-text-tertiary mb-1 text-xs font-medium tracking-wide uppercase">
                  Building 12
                </p>
                <h2 class="text-text-primary text-3xl font-semibold tracking-tight">
                  Sunset Heights
                </h2>
                <p
                  class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base"
                >
                  18 apartments · 4 floors · occupied since 1987.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Button variant="ghost" intent="neutral">Archive</Button>
                <Button intent="primary">Edit</Button>
              </div>
            </div>
          </header>
        </Card>
      </div>

      <div>
        <p class="text-text-primary mb-3 text-sm font-semibold">Tab page</p>
        <Card variant="outlined" padding="md">
          <header class="mb-6 flex flex-col gap-4 sm:mb-8">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div class="min-w-0 flex-1">
                <h2 class="text-text-primary text-3xl font-semibold tracking-tight">Settings</h2>
                <p
                  class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base"
                >
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
        </Card>
      </div>

      <div>
        <p class="text-text-primary mb-3 text-sm font-semibold">Form page (h2 inside dialog)</p>
        <Card variant="outlined" padding="md">
          <header class="mb-6 flex flex-col gap-4 sm:mb-8">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div class="min-w-0 flex-1">
                <h3 class="text-text-primary text-2xl font-semibold tracking-tight">
                  Invite a new member
                </h3>
                <p
                  class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base"
                >
                  They'll receive an email with a link to join your workspace.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Button variant="ghost" intent="neutral">Cancel</Button>
                <Button intent="primary">Send invite</Button>
              </div>
            </div>
          </header>
        </Card>
      </div>
    </div>
  </Section>

  <Section id="features" title="Features">
    <RecipeFeatures {features} />
  </Section>

  <Section id="code" title="Code">
    <CodeExample
      title="List-page header"
      preview={false}
      language="svelte"
      code={`<header class="mb-6 flex flex-col gap-4 sm:mb-8">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
    <div class="min-w-0 flex-1">
      <p class="text-text-tertiary mb-1 text-xs font-medium tracking-wide uppercase">
        Property management
      </p>
      <h1 class="text-text-primary text-3xl font-semibold tracking-tight">Apartments</h1>
      <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
        Master data of all managed apartments.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
      <Button intent="primary" onclick={openCreate}>New apartment</Button>
    </div>
  </div>
</header>`}
    />

    <CodeExample
      title="Detail-page header with Breadcrumb"
      preview={false}
      language="svelte"
      code={`<header class="mb-6 flex flex-col gap-4 sm:mb-8">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
    <div class="min-w-0 flex-1">
      <div class="mb-2">
        <Breadcrumb items={[
          { label: 'Buildings', href: '/buildings' },
          { label: 'Sunset Heights' }
        ]} />
      </div>
      <p class="text-text-tertiary mb-1 text-xs font-medium tracking-wide uppercase">Building 12</p>
      <h1 class="text-text-primary text-3xl font-semibold tracking-tight">Sunset Heights</h1>
      <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
        18 apartments · 4 floors · occupied since 1987.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
      <Button variant="ghost" intent="neutral">Archive</Button>
      <Button intent="primary">Edit</Button>
    </div>
  </div>
</header>`}
    />

    <CodeExample
      title="Tab-page header — heading row + Tab strip"
      preview={false}
      language="svelte"
      code={`<header class="mb-6 flex flex-col gap-4 sm:mb-8">
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
  <Tab bind:value={activeTab} variant="line">
    {#snippet tabs()}
      <TabItem value="overview">Overview</TabItem>
      <TabItem value="billing">Billing</TabItem>
      <TabItem value="team">Team</TabItem>
    {/snippet}
  </Tab>
</header>`}
    />

    <CodeExample
      title="Form-page header — h2 for nested context"
      preview={false}
      language="svelte"
      code={`<!-- Inside a Dialog, Drawer, or any context that already has an outer <h1>: -->
<header class="mb-6 flex flex-col gap-4 sm:mb-8">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
    <div class="min-w-0 flex-1">
      <h2 class="text-text-primary text-2xl font-semibold tracking-tight">
        Invite a new member
      </h2>
      <p class="text-text-secondary mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-base">
        They'll receive an email with a link to join your workspace.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
      <Button variant="ghost" intent="neutral" onclick={onCancel}>Cancel</Button>
      <Button intent="primary" onclick={onSubmit}>Send invite</Button>
    </div>
  </div>
</header>`}
    />
  </Section>

  <Section id="best-practices" title="Best Practices">
    <Card variant="outlined">
      <div class="divide-border-subtle divide-y">
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">Pick the right heading level</p>
          <p class="text-text-secondary mt-1 text-sm">
            Use <code class="text-text-primary">&lt;h1&gt;</code> when the header is the single
            top-of-page heading. Drop to
            <code class="text-text-primary">&lt;h2&gt;</code> when you're inside a Dialog, Drawer, or
            a route that already has an outer h1 — a page should have exactly one h1.
          </p>
        </div>
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">
            Actions on the right, wrapping below on narrow viewports
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            <code class="text-text-primary">flex-col gap-4 sm:flex-row sm:justify-between</code>
            gives you the responsive default: heading + actions stack on mobile, sit side-by-side from
            <code class="text-text-primary">sm:</code> upward. The actions container uses
            <code class="text-text-primary">flex-wrap</code>
            so two-button groups don't push the heading off-screen.
          </p>
        </div>
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">Eyebrow vs. Breadcrumb — pick one</p>
          <p class="text-text-secondary mt-1 text-sm">
            Eyebrow ("Property management") is a category label; Breadcrumb is a navigation trail.
            Use eyebrow for context that doesn't navigate; use Breadcrumb when each ancestor is a
            real route. Stacking both above the title is visually noisy — pick the one that earns
            its weight.
          </p>
        </div>
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">
            Subtitle should describe the page, not repeat the title
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            "Apartments — list of apartments" is filler. A good subtitle either narrows the scope
            ("…managed by your team this quarter") or tells the user what they can do here. If you
            can't write a useful one, leave it out.
          </p>
        </div>
        <div class="px-4 py-3">
          <p class="text-text-primary text-sm font-semibold">
            Why this is a recipe, not a component
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            The header is pure layout composition with zero state, zero variants, and zero
            behaviour. Wrapping it in a component would hide the markup from the consumer without
            saving any logic — and would lock the structure when projects routinely need small
            variations (different eyebrow position, a status pill next to the title, a custom action
            row). Copy the snippet that matches your page; adapt it in place.
          </p>
        </div>
      </div>
    </Card>
  </Section>
</div>
