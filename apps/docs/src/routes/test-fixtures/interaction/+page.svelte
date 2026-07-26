<script lang="ts">
  // Visual-regression fixture for INTERACTION states — the axis the resting
  // fixture (/test-fixtures/primitives) is blind to. It renders every primitive
  // at rest, so the 2026-07-25 interaction-token wave changed four visible
  // things and moved 0 of 52 shots; verification had to happen in a throwaway
  // computed-style probe instead.
  //
  // Two deliberate differences from the resting fixture:
  //
  // 1. Every group is rendered TWICE — once on `surface-base`, once inside an
  //    elevated Card. A hover/focus fill that collapses onto its backdrop is
  //    invisible only on the surface it collides with, so a fixture that knows
  //    one surface cannot see the collision at all. `hover:bg-surface-subtle`
  //    read correctly on the page and was dead on every elevated surface for
  //    exactly this reason (fixed 2026-07-26).
  // 2. `ghost` variants are present. The resting fixture covers
  //    outlined/filled/error/disabled only — so even a hover column added to it
  //    would have missed that bug, which lived entirely in `ghost`.
  //
  // The states themselves are forced via CDP `CSS.forcePseudoState` from
  // e2e/visual-regression-interaction.spec.ts, not by moving a real pointer —
  // see the spec for why.
  import {
    Button,
    Card,
    Checkbox,
    Input,
    RadioGroup,
    RadioItem,
    Select,
    Tab,
    TabItem,
    TabPanel,
    Textarea
  } from '@urbicon-ui/blocks';
  import type { Snippet } from 'svelte';

  const selectOptions = [
    { label: 'Germany', value: 'de' },
    { label: 'France', value: 'fr' }
  ];
</script>

<svelte:head>
  <title>Interaction-State Visual-Regression Fixtures</title>
  <style>
    /* Same rationale as the resting fixture: `transition: none` (not duration:0)
       so a forced :hover never captures a mid-flight frame. */
    *,
    *::before,
    *::after {
      transition: none !important;
      animation: none !important;
    }
  </style>
</svelte:head>

<!-- Each group is defined once and rendered on both surfaces, so the two halves
     of a shot can never drift apart. -->
{#snippet fields()}
  <div class="grid grid-cols-2 gap-3">
    <Input label="Ghost" value="ghost" variant="ghost" />
    <Input label="Filled" value="filled" variant="filled" />
    <Input label="Outlined" value="outlined" variant="outlined" />
    <Select label="Ghost" value="de" options={selectOptions} variant="ghost" />
    <Select label="Filled" value="fr" options={selectOptions} variant="filled" />
    <Textarea label="Ghost" value="ghost textarea" variant="ghost" rows={2} />
  </div>
{/snippet}

{#snippet choices()}
  <div class="flex flex-wrap items-start gap-6">
    <Checkbox label="Ghost" variant="ghost" intent="primary" />
    <Checkbox label="Filled" variant="filled" intent="primary" />
    <Checkbox label="Outlined" variant="outlined" intent="primary" />
    <!-- `variant` lives on the group, not the item, so the two rungs need two groups. -->
    <RadioGroup label="Ghost" value="" variant="ghost">
      <RadioItem value="a" label="One" />
      <RadioItem value="b" label="Two" />
    </RadioGroup>
    <RadioGroup label="Filled" value="" variant="filled">
      <RadioItem value="a" label="One" />
      <RadioItem value="b" label="Two" />
    </RadioGroup>
  </div>
{/snippet}

{#snippet nav()}
  <div class="space-y-4">
    <Tab variant="enclosed" defaultValue="a">
      {#snippet tabs()}
        <TabItem value="a">Enclosed</TabItem>
        <TabItem value="b">Second</TabItem>
      {/snippet}
      {#snippet panels()}
        <TabPanel value="a"><span class="text-text-secondary text-sm">Panel A</span></TabPanel>
        <TabPanel value="b"><span class="text-text-secondary text-sm">Panel B</span></TabPanel>
      {/snippet}
    </Tab>
    <Tab variant="pills" defaultValue="a">
      {#snippet tabs()}
        <TabItem value="a">Pills</TabItem>
        <TabItem value="b">Second</TabItem>
      {/snippet}
      {#snippet panels()}
        <TabPanel value="a"><span class="text-text-secondary text-sm">Panel A</span></TabPanel>
        <TabPanel value="b"><span class="text-text-secondary text-sm">Panel B</span></TabPanel>
      {/snippet}
    </Tab>
  </div>
{/snippet}

{#snippet actions()}
  <div class="flex flex-wrap items-center gap-3">
    <Button variant="filled" intent="primary">Filled</Button>
    <Button variant="outlined" intent="primary">Outlined</Button>
    <Button variant="ghost" intent="primary">Ghost</Button>
    <Button variant="text" intent="primary">Text</Button>
    <Button variant="filled" intent="danger">Danger</Button>
  </div>
{/snippet}

{#snippet onBothSurfaces(group: Snippet)}
  <div class="space-y-4">
    <div class="bg-surface-base rounded-contain p-4">
      {@render group()}
    </div>
    <Card variant="elevated" padding="md">
      {@render group()}
    </Card>
  </div>
{/snippet}

<div class="bg-surface-base min-h-screen w-full p-8" data-testid="interaction-fixtures">
  <div class="mx-auto max-w-3xl space-y-10">
    <section data-testid="vr-ix-field" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Fields</h2>
      {@render onBothSurfaces(fields)}
    </section>

    <section data-testid="vr-ix-choice" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Choice</h2>
      {@render onBothSurfaces(choices)}
    </section>

    <section data-testid="vr-ix-nav" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Navigation</h2>
      {@render onBothSurfaces(nav)}
    </section>

    <section data-testid="vr-ix-action" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Actions</h2>
      {@render onBothSurfaces(actions)}
    </section>
  </div>
</div>
