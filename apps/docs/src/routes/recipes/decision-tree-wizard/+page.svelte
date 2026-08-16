<script lang="ts">
  import {
    Alert,
    Button,
    Card,
    RadioGroup,
    RadioItem,
    Stepper,
    StepperStep
  } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  // One object holds every answer. The step list, the recommendation and the
  // Next gate all derive from it, so revising an earlier answer reshapes the
  // flow with no cleanup code.
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

  // The full route is declared once; skipIf filters it whenever answers
  // change. Pick a single fuel and the hybrid step leaves the rail, the count
  // and the flow, with no navigation code running.
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

  // Every branch matches fuelType before it reads a hybrid answer, so a value
  // left behind by a hidden step (switch hybrid to single and hybridSplit
  // stays set) never reaches the result.
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

  // Gates the Next button only: the current step's answer must exist.
  // Back never validates.
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

  const recipeCode = `<\script lang="ts">
  import {
    Alert,
    Button,
    Card,
    RadioGroup,
    RadioItem,
    Stepper,
    StepperStep
  } from '@urbicon-ui/blocks';

  // One object holds every answer. The step list, the recommendation and the
  // Next gate all derive from it, so revising an earlier answer reshapes the
  // flow with no cleanup code.
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

  // The full route is declared once; skipIf filters it whenever answers
  // change. Pick a single fuel and the hybrid step leaves the rail, the count
  // and the flow, with no navigation code running.
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

  // Every branch matches fuelType before it reads a hybrid answer, so a value
  // left behind by a hidden step (switch hybrid to single and hybridSplit
  // stays set) never reaches the result.
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
    /* … the remaining hybrid paths (estimate, manual) follow the same shape … */
    return null;
  });

  // Gates the Next button only: the current step's answer must exist.
  // Back never validates.
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
<\/script>

<!-- Centre it in your page's own layout; the card caps its own width. -->
<div class="w-full max-w-3xl">
  <Card variant="elevated" padding="lg">
    <div class="space-y-6">
      <!-- The rail only shows position (clickable stays off): the buttons below
           are the one way to move, so the canNext gate cannot be bypassed. -->
      <Stepper activeStep={currentStep}>
        {#each steps as step (step.id)}
          <StepperStep label={step.title} description={step.description} />
        {/each}
      </Stepper>

      <div>
        {#if steps[currentStep]?.id === 'fuelType'}
          <h3 class="text-text-primary mb-3 text-base font-semibold">Which fuel configuration?</h3>
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
        {/if}
      </div>

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
</div>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="HeatingSetupPage.svelte"
      description="Pick `Hybrid` in the fuel step and the rail gains a fourth step; the recommendation at the end follows your answer path."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="w-full max-w-3xl">
        <Card variant="elevated" padding="lg">
          <div class="space-y-6">
            <Stepper activeStep={currentStep}>
              {#each steps as step (step.id)}
                <StepperStep label={step.title} description={step.description} />
              {/each}
            </Stepper>

            <div>
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
                <h3 class="text-text-primary mb-3 text-base font-semibold">
                  System recommendation
                </h3>
                <Alert intent={recommendation.intent} variant="soft" title={recommendation.method}>
                  {recommendation.reason}
                </Alert>
              {/if}
            </div>

            <div class="flex justify-between">
              <Button
                intent="neutral"
                variant="outlined"
                onclick={back}
                disabled={currentStep === 0}
              >
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
      </div>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Three decisions">
    <NoteList>
      <Note title="A hidden step keeps its answer">
        <p>
          Answer the fuel step with hybrid, set the split, then go back and choose single fuel: the
          split step leaves the rail, but <code class="text-text-primary">answers.hybridSplit</code>
          keeps its value. The recipe tolerates the leftover instead of clearing it. Every
          <code class="text-text-primary">recommendation</code> branch matches on
          <code class="text-text-primary">fuelType</code> before it reads a hybrid answer, so a
          stale key never reaches the result; clearing it would take an
          <code class="text-text-primary">$effect</code> that repeats the
          <code class="text-text-primary">skipIf</code> condition in a second place, and two copies of
          one condition drift apart.
        </p>
      </Note>
      <Note title="Back never validates">
        <p>
          <code class="text-text-primary">canNext</code> disables Next while the current step's
          answer is missing; Back stops only at the first step. Validation gates progress, never
          retreat: revising an earlier answer is how you leave a wrong path. Later answers stay in
          <code class="text-text-primary">answers</code>, so Next re-enables from them on the way
          forward.
        </p>
      </Note>
      <Note title="The step index is not shareable state">
        <p>
          <code class="text-text-primary">currentStep</code> indexes the filtered list, so what it
          points at depends on the answers: the third step is the hybrid split on one path and the
          recommendation on the other. A bookmarked
          <code class="text-text-primary">?step=2</code> restores none of that. When a draft must
          survive a refresh, persist <code class="text-text-primary">answers</code> and reopen at the
          first unanswered step; the rail re-derives from the answers alone.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
