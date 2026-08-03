<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { r } from '$lib/route';
  import {
    Stepper,
    StepperStep,
    Input,
    Select,
    RadioGroup,
    RadioItem,
    Textarea,
    Checkbox,
    Button,
    Card,
    Progress,
    Alert
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { componentLinks } from '$lib/component-links';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';

  const { components: usedComponents, features } = recipeMeta;

  // --- Wizard state ---
  let step = $state(0);
  let submitted = $state(false);

  // Step 0: Account
  let fullName = $state('');
  let email = $state('');

  // Step 1: Preferences
  let plan = $state('');
  let region = $state<string | null>(null);

  // Step 2: Review
  let notes = $state('');
  let agreedToTerms = $state(false);

  const regionOptions = [
    { label: 'United States', value: 'us' },
    { label: 'Europe', value: 'eu' },
    { label: 'Asia Pacific', value: 'asia' }
  ];

  const planLabels: Record<string, string> = {
    starter: 'Starter',
    pro: 'Professional',
    enterprise: 'Enterprise'
  };

  let progress = $derived(submitted ? 100 : Math.round((step / 3) * 100));

  let canNext = $derived.by(() => {
    if (step === 0) return fullName.trim() !== '' && email.trim() !== '';
    if (step === 1) return plan !== '' && region !== null;
    if (step === 2) return agreedToTerms;
    return false;
  });

  function next() {
    if (step < 2) {
      step += 1;
    } else if (canNext) {
      submitted = true;
    }
  }

  function back() {
    if (step > 0) step -= 1;
  }

  function reset() {
    step = 0;
    submitted = false;
    fullName = '';
    email = '';
    plan = '';
    region = null;
    notes = '';
    agreedToTerms = false;
  }

  const recipeCode =
    `<script lang="ts">
  import {
    Stepper, StepperStep, Input, Select, RadioGroup, RadioItem,
    Textarea, Checkbox, Button, Card, Progress, Alert
  } from '@urbicon-ui/blocks';

  let step = $state(0);
  let submitted = $state(false);

  // Step 0: Account
  let fullName = $state('');
  let email = $state('');

  // Step 1: Preferences
  let plan = $state('');
  let region = $state<string | null>(null);

  // Step 2: Review
  let notes = $state('');
  let agreedToTerms = $state(false);

  const regionOptions = [
    { label: 'United States', value: 'us' },
    { label: 'Europe', value: 'eu' },
    { label: 'Asia Pacific', value: 'asia' }
  ];

  const planLabels: Record<string, string> = {
    starter: 'Starter',
    pro: 'Professional',
    enterprise: 'Enterprise'
  };

  let progress = $derived(submitted ? 100 : Math.round((step / 3) * 100));

  let canNext = $derived.by(() => {
    if (step === 0) return fullName.trim() !== '' && email.trim() !== '';
    if (step === 1) return plan !== '' && region !== null;
    if (step === 2) return agreedToTerms;
    return false;
  });

  function next() {
    if (step < 2) step += 1;
    else if (canNext) submitted = true;
  }

  function back() {
    if (step > 0) step -= 1;
  }

  function reset() {
    step = 0;
    submitted = false;
    fullName = '';
    email = '';
    plan = '';
    region = null;
    notes = '';
    agreedToTerms = false;
  }
</scr` +
    `ipt>

<div class="mx-auto max-w-xl p-8">
  <Progress value={progress} size="sm" intent="primary" class="mb-6" />

  <Stepper bind:activeStep={step} orientation="horizontal">
    <StepperStep label="Account" description="Personal info" />
    <StepperStep label="Preferences" description="Your choices" />
    <StepperStep label="Review" description="Confirm details" />
  </Stepper>

  {#if submitted}
    <div class="mt-8">
      <Alert intent="success" variant="soft" title="All done!">
        Your wizard has been submitted successfully.
      </Alert>
      <Button variant="outlined" intent="neutral" onclick={reset} class="mt-4">
        Start Over
      </Button>
    </div>
  {:else}
    <Card class="mt-8">
      <div class="space-y-5 p-6">
        {#if step === 0}
          <Input label="Full Name" bind:value={fullName} required
            placeholder="Jane Doe" />
          <Input label="Email" type="email" bind:value={email} required
            placeholder="jane@example.com" />
        {:else if step === 1}
          <RadioGroup bind:value={plan} label="Choose a plan">
            <RadioItem value="starter" label="Starter"
              description="For individuals and side projects" />
            <RadioItem value="pro" label="Professional"
              description="For growing teams" />
            <RadioItem value="enterprise" label="Enterprise"
              description="For large organizations" />
          </RadioGroup>
          <Select label="Region" options={regionOptions}
            bind:value={region} placeholder="Select a region" />
        {:else}
          <Textarea label="Additional Notes" bind:value={notes}
            autoResize showCounter maxlength={500}
            placeholder="Anything else we should know?" />
          <div class="bg-surface-subtle rounded-lg p-4">
            <h4 class="text-text-primary mb-2 text-sm font-semibold">
              Summary
            </h4>
            <dl class="text-text-secondary space-y-1 text-sm">
              <div class="flex justify-between">
                <dt>Name</dt><dd>{fullName}</dd>
              </div>
              <div class="flex justify-between">
                <dt>Email</dt><dd>{email}</dd>
              </div>
              <div class="flex justify-between">
                <dt>Plan</dt><dd>{planLabels[plan] ?? '—'}</dd>
              </div>
              <div class="flex justify-between">
                <dt>Region</dt>
                <dd>{regionOptions.find((o) => o.value === region)?.label ?? '—'}</dd>
              </div>
            </dl>
          </div>
          <Checkbox label="I agree to the terms and conditions"
            bind:checked={agreedToTerms} />
        {/if}
      </div>
    </Card>

    <div class="mt-6 flex justify-between">
      <Button variant="ghost" intent="neutral"
        onclick={back} disabled={step === 0}>Back</Button>
      <Button intent="primary" onclick={next}
        disabled={!canNext}>
        {step < 2 ? 'Next' : 'Submit'}
      </Button>
    </div>
  {/if}
</div>`;
</script>

<SeoMeta title="Multi-Step Wizard Recipe" description={recipeMeta.description} />

<div class="mx-auto max-w-6xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <!-- Live Preview (2 cols) -->
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <div
          class="border-border-subtle bg-surface-base mt-4 overflow-hidden rounded-xl border shadow-[var(--blocks-shadow-md)]"
        >
          <div class="mx-auto max-w-xl p-8">
            <Progress value={progress} size="sm" intent="primary" class="mb-6" />

            <Stepper bind:activeStep={step} orientation="horizontal">
              <StepperStep label="Account" description="Personal info" />
              <StepperStep label="Preferences" description="Your choices" />
              <StepperStep label="Review" description="Confirm details" />
            </Stepper>

            {#if submitted}
              <div class="mt-8">
                <Alert intent="success" variant="soft" title="All done!">
                  Your wizard has been submitted successfully.
                </Alert>
                <Button variant="outlined" intent="neutral" onclick={reset} class="mt-4">
                  Start Over
                </Button>
              </div>
            {:else}
              <Card class="mt-8">
                <div class="space-y-5 p-6">
                  {#if step === 0}
                    <Input
                      label="Full Name"
                      bind:value={fullName}
                      required
                      placeholder="Jane Doe"
                    />
                    <Input
                      label="Email"
                      type="email"
                      bind:value={email}
                      required
                      placeholder="jane@example.com"
                    />
                  {:else if step === 1}
                    <RadioGroup bind:value={plan} label="Choose a plan">
                      <RadioItem
                        value="starter"
                        label="Starter"
                        description="For individuals and side projects"
                      />
                      <RadioItem value="pro" label="Professional" description="For growing teams" />
                      <RadioItem
                        value="enterprise"
                        label="Enterprise"
                        description="For large organizations"
                      />
                    </RadioGroup>
                    <Select
                      label="Region"
                      options={regionOptions}
                      bind:value={region}
                      placeholder="Select a region"
                    />
                  {:else}
                    <Textarea
                      label="Additional Notes"
                      bind:value={notes}
                      autoResize
                      showCounter
                      maxlength={500}
                      placeholder="Anything else we should know?"
                    />
                    <div class="bg-surface-subtle rounded-lg p-4">
                      <h3 class="text-text-primary mb-2 text-sm font-semibold">Summary</h3>
                      <dl class="text-text-secondary space-y-1 text-sm">
                        <div class="flex justify-between">
                          <dt>Name</dt>
                          <dd class="text-text-primary font-medium">{fullName}</dd>
                        </div>
                        <div class="flex justify-between">
                          <dt>Email</dt>
                          <dd class="text-text-primary font-medium">{email}</dd>
                        </div>
                        <div class="flex justify-between">
                          <dt>Plan</dt>
                          <dd class="text-text-primary font-medium">
                            {planLabels[plan] ?? '\u2014'}
                          </dd>
                        </div>
                        <div class="flex justify-between">
                          <dt>Region</dt>
                          <dd class="text-text-primary font-medium">
                            {regionOptions.find((o) => o.value === region)?.label ?? '\u2014'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <Checkbox
                      label="I agree to the terms and conditions"
                      bind:checked={agreedToTerms}
                    />
                  {/if}
                </div>
              </Card>

              <div class="mt-6 flex justify-between">
                <Button variant="ghost" intent="neutral" onclick={back} disabled={step === 0}>
                  Back
                </Button>
                <Button intent="primary" onclick={next} disabled={!canNext}>
                  {step < 2 ? 'Next' : 'Submit'}
                </Button>
              </div>
            {/if}
          </div>
        </div>
      </Section>
    </div>

    <!-- Sidebar -->
    <div class="space-y-8">
      <Section id="features" title="Key Features" headingLevel={3}>
        <ul class="space-y-2">
          {#each features as feature (feature)}
            <li class="text-text-secondary flex items-start gap-2 text-sm">
              <svg
                class="text-success mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                /></svg
              >
              {feature}
            </li>
          {/each}
        </ul>
      </Section>

      <Section id="components" title="Components Used" headingLevel={3}>
        <div class="space-y-2">
          {#each usedComponents as comp (comp)}
            <a
              href={r(componentLinks[comp] ?? '#')}
              class="text-text-secondary hover:bg-surface-hover hover:text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <svg
                class="text-primary h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 7l5 5-5 5M6 12h12"
                /></svg
              >
              {comp}
            </a>
          {/each}
        </div>
      </Section>
    </div>
  </div>

  <!-- Source Code -->
  <div class="mt-12">
    <CodeExample
      title="Multi-Step Wizard Recipe"
      code={recipeCode}
      language="svelte"
      preview={false}
    />
  </div>
</div>
