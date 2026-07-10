<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import {
    Stepper,
    StepperStep,
    Card,
    RadioGroup,
    RadioItem,
    Button,
    Alert,
    Badge
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  // Example: system setup for heating-cost billing software
  // — Question A: fuel configuration
  // — Question B: heat meters installed?
  // — Question C (only if A == 'hybrid'): how is the hybrid share determined?
  // — Review: the system suggests a method

  let answers = $state<{
    fuelType?: 'single' | 'hybrid';
    hasMeter?: 'yes' | 'no';
    hybridSplit?: 'meter' | 'estimate' | 'manual';
  }>({});
  let currentStep = $state(0);

  type StepDef = {
    id: string;
    title: string;
    description: string;
    skipIf?: () => boolean;
  };

  const steps = $derived.by<StepDef[]>(() => {
    const all: StepDef[] = [
      { id: 'fuelType', title: 'Fuel', description: 'Energy source configuration' },
      { id: 'hasMeter', title: 'Heat meters', description: 'Check installation' },
      {
        id: 'hybridSplit',
        title: 'Hybrid split',
        description: 'Determine the share',
        skipIf: () => answers.fuelType !== 'hybrid'
      },
      { id: 'review', title: 'Recommendation', description: 'System suggestion' }
    ];
    return all.filter((s) => !s.skipIf?.());
  });

  const recommendation = $derived.by(() => {
    if (answers.fuelType === 'single' && answers.hasMeter === 'yes') {
      return {
        method: 'HeizKV § 7 — consumption-based (metered values)',
        intent: 'success' as const,
        reason:
          'A single-fuel system with meters allows direct consumption metering per residential unit.'
      };
    }
    if (answers.fuelType === 'single' && answers.hasMeter === 'no') {
      return {
        method: 'HeizKV § 9a — estimate by living area',
        intent: 'warning' as const,
        reason:
          'Without meters, consumption cannot be measured. Area-based estimate with a correction factor.'
      };
    }
    if (answers.fuelType === 'hybrid' && answers.hybridSplit === 'meter') {
      return {
        method: 'HeizKV § 9 (2) — hybrid with separate metering',
        intent: 'success' as const,
        reason: 'Separate metering per energy source allows a correct split.'
      };
    }
    if (answers.fuelType === 'hybrid' && answers.hybridSplit === 'estimate') {
      return {
        method: 'HeizKV § 9 (3) — hybrid with flat-rate split',
        intent: 'warning' as const,
        reason: 'Flat-rate split without separate metering — higher uncertainty.'
      };
    }
    if (answers.fuelType === 'hybrid' && answers.hybridSplit === 'manual') {
      return {
        method: 'HeizKV § 11 — manual split (approval required)',
        intent: 'danger' as const,
        reason: 'A manual split requires tenant consent and possibly regulatory approval.'
      };
    }
    return null;
  });

  const canNext = $derived.by(() => {
    const currentId = steps[currentStep]?.id;
    if (currentId === 'fuelType') return answers.fuelType !== undefined;
    if (currentId === 'hasMeter') return answers.hasMeter !== undefined;
    if (currentId === 'hybridSplit') return answers.hybridSplit !== undefined;
    if (currentId === 'review') return true;
    return false;
  });

  function next() {
    if (currentStep < steps.length - 1) currentStep += 1;
  }
  function back() {
    if (currentStep > 0) currentStep -= 1;
  }
  function reset() {
    answers = {};
    currentStep = 0;
  }
</script>

<SeoMeta
  title="Decision Tree Wizard Recipe"
  description="Stepper wizard with dynamically changing steps and an auto-recommendation."
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
    <Card variant="outlined">
      <div class="space-y-6 p-6">
        <Stepper bind:activeStep={currentStep}>
          {#each steps as step (step.id)}
            <StepperStep label={step.title} description={step.description} />
          {/each}
        </Stepper>

        <Card variant="outlined" padding="md">
          {#if steps[currentStep]?.id === 'fuelType'}
            <h3 class="text-text-primary mb-3 text-base font-semibold">
              Which fuel configuration?
            </h3>
            <RadioGroup bind:value={answers.fuelType} name="fuelType">
              <RadioItem value="single" label="Single fuel (gas, oil, or heat pump)" />
              <RadioItem value="hybrid" label="Hybrid (e.g. gas + heat pump combined)" />
            </RadioGroup>
          {:else if steps[currentStep]?.id === 'hasMeter'}
            <h3 class="text-text-primary mb-3 text-base font-semibold">
              Are heat meters installed in each residential unit?
            </h3>
            <RadioGroup bind:value={answers.hasMeter} name="hasMeter">
              <RadioItem value="yes" label="Yes, in every unit" />
              <RadioItem value="no" label="No, no meters installed" />
            </RadioGroup>
          {:else if steps[currentStep]?.id === 'hybridSplit'}
            <h3 class="text-text-primary mb-3 text-base font-semibold">
              How is the hybrid share determined?
            </h3>
            <RadioGroup bind:value={answers.hybridSplit} name="hybridSplit">
              <RadioItem value="meter" label="Separate metering per energy source" />
              <RadioItem value="estimate" label="Flat-rate split (e.g. 70/30)" />
              <RadioItem value="manual" label="Manual split with approval" />
            </RadioGroup>
          {:else if steps[currentStep]?.id === 'review' && recommendation}
            <h3 class="text-text-primary mb-3 text-base font-semibold">System recommendation</h3>
            <Alert intent={recommendation.intent} variant="soft" title={recommendation.method}>
              {recommendation.reason}
            </Alert>
            <details class="mt-4">
              <summary class="text-text-tertiary cursor-pointer text-xs">
                Show answer path
              </summary>
              <pre
                class="bg-surface-subtle text-text-secondary mt-2 overflow-x-auto rounded-md p-3 text-xs">{JSON.stringify(
                  answers,
                  null,
                  2
                )}</pre>
            </details>
          {/if}
        </Card>

        <div class="flex justify-between">
          <Button intent="neutral" variant="outlined" onclick={back} disabled={currentStep === 0}>
            Back
          </Button>
          {#if currentStep === steps.length - 1}
            <Button intent="primary" onclick={reset}>Start over</Button>
          {:else}
            <Button intent="primary" onclick={next} disabled={!canNext}>Next</Button>
          {/if}
        </div>
      </div>
    </Card>
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

  <Section id="code" title="Code skeleton">
    <CodeExample
      title="DecisionTreeWizard.svelte"
      preview={false}
      language="svelte"
      code={`<script lang="ts">
  import { Stepper, StepperStep, Card, RadioGroup, RadioItem, Button, Alert } from '@urbicon-ui/blocks';

  let answers = $state<{ fuelType?: string; hasMeter?: string; hybridSplit?: string }>({});
  let currentStep = $state(0);

  // Step 3 is skipped when answer 1 != "hybrid"
  const steps = $derived.by(() => {
    const all = [
      { id: 'fuelType',    title: 'Fuel' },
      { id: 'hasMeter',    title: 'Meters' },
      { id: 'hybridSplit', title: 'Hybrid share', skipIf: () => answers.fuelType !== 'hybrid' },
      { id: 'review',      title: 'Recommendation' }
    ];
    return all.filter((s) => !s.skipIf?.());
  });

  // Auto-recommendation based on the answer path
  const recommendation = $derived.by(() => {
    if (answers.fuelType === 'single' && answers.hasMeter === 'yes') return 'HeizKV § 7';
    if (answers.fuelType === 'single' && answers.hasMeter === 'no')  return 'HeizKV § 9a';
    if (answers.fuelType === 'hybrid' && answers.hybridSplit === 'meter') return 'HeizKV § 9 (2)';
    return null;
  });

  const canNext = $derived.by(() => {
    const id = steps[currentStep]?.id;
    if (id === 'fuelType')    return !!answers.fuelType;
    if (id === 'hasMeter')    return !!answers.hasMeter;
    if (id === 'hybridSplit') return !!answers.hybridSplit;
    return true;
  });
</scr` +
        `ipt>

<Stepper bind:activeStep={currentStep}>
  {#each steps as step (step.id)}
    <StepperStep label={step.title} />
  {/each}
</Stepper>

<Card>
  {#if steps[currentStep]?.id === 'fuelType'}
    <RadioGroup bind:value={answers.fuelType} name="fuelType">
      <RadioItem value="single" label="Single fuel" />
      <RadioItem value="hybrid" label="Hybrid" />
    </RadioGroup>
  {:else if steps[currentStep]?.id === 'review'}
    <Alert intent="success" title="Recommendation">{recommendation}</Alert>
  {/if}
</Card>

<div class="flex justify-between">
  <Button onclick={() => currentStep--} disabled={currentStep === 0}>Back</Button>
  <Button onclick={() => currentStep++} disabled={!canNext}>Next</Button>
</div>`}
    />
  </Section>

  <Section id="best-practices" title="Best Practices">
    <Card variant="outlined">
      <div class="divide-border-subtle divide-y">
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Don't put answers in URL params</h4>
          <p class="text-text-secondary mt-1 text-sm">
            Wizard state is usually ephemeral — URL state would affect bookmarks or refreshes in
            unexpected ways. Only opt in with `?step=2` or similar when explicitly desired.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">
            $derived instead of imperative skip logic
          </h4>
          <p class="text-text-secondary mt-1 text-sm">
            The steps array is filtered at render time via `$derived.by`. As soon as an answer
            changes, the next step is (de)activated automatically — no manual `goto()` or event
            listeners.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Auto-recommendation in the review</h4>
          <p class="text-text-secondary mt-1 text-sm">
            The last step shows not just the answers but also the derived recommendation. Optionally
            the user can override it — add a "Choose a different one?" toggle for that.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Back navigation always allowed</h4>
          <p class="text-text-secondary mt-1 text-sm">
            Forward may be locked while the current answer is missing. Back must never block —
            otherwise the user can't escape a dead end.
          </p>
        </div>
      </div>
    </Card>
  </Section>
</div>
