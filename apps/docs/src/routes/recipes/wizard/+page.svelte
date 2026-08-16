<script lang="ts">
  import {
    Alert,
    Button,
    Card,
    Checkbox,
    Input,
    Progress,
    RadioGroup,
    RadioItem,
    Select,
    Stepper,
    StepperStep,
    Textarea
  } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

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

  // What the current step requires, nothing else: Next stays disabled until
  // this passes, and on the last step it holds Submit until the terms are
  // accepted.
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

  const recipeCode = `<\script lang="ts">
  import {
    Alert,
    Button,
    Card,
    Checkbox,
    Input,
    Progress,
    RadioGroup,
    RadioItem,
    Select,
    Stepper,
    StepperStep,
    Textarea
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

  // What the current step requires, nothing else: Next stays disabled until
  // this passes, and on the last step it holds Submit until the terms are
  // accepted.
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
<\/script>

<!-- Centre it in your page's own layout; the card caps its own width. -->
<div class="w-full max-w-xl">
  <Card variant="elevated" padding="lg">
    <Progress value={progress} size="sm" intent="primary" class="mb-6" />

    <!-- The rail only shows position: steps are not clickable, so the gated
         Next is the only way forward. -->
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
      <div class="mt-8 space-y-5">
        {#if step === 0}
          <Input label="Full Name" bind:value={fullName} required placeholder="Jane Doe" />
          <Input label="Email" type="email" bind:value={email} required placeholder="jane@example.com" />
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
          <Card variant="quiet" padding="sm">
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
                <dd class="text-text-primary font-medium">{planLabels[plan] ?? '—'}</dd>
              </div>
              <div class="flex justify-between">
                <dt>Region</dt>
                <dd class="text-text-primary font-medium">
                  {regionOptions.find((o) => o.value === region)?.label ?? '—'}
                </dd>
              </div>
            </dl>
          </Card>
          <Checkbox label="I agree to the terms and conditions" bind:checked={agreedToTerms} />
        {/if}
      </div>

      <div class="mt-6 flex justify-between">
        <Button variant="ghost" intent="neutral" onclick={back} disabled={step === 0}>Back</Button>
        <Button intent="primary" onclick={next} disabled={!canNext}>
          {step < 2 ? 'Next' : 'Submit'}
        </Button>
      </div>
    {/if}
  </Card>
</div>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="SignupPage.svelte"
      description="Fill a step to unlock `Next`; `Back` keeps everything you typed."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="w-full max-w-xl">
        <Card variant="elevated" padding="lg">
          <Progress value={progress} size="sm" intent="primary" class="mb-6" />

          <!-- The rail only shows position: steps are not clickable, so the
               gated Next is the only way forward. -->
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
            <div class="mt-8 space-y-5">
              {#if step === 0}
                <Input label="Full Name" bind:value={fullName} required placeholder="Jane Doe" />
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
                <Card variant="quiet" padding="sm">
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
                      <dd class="text-text-primary font-medium">{planLabels[plan] ?? '—'}</dd>
                    </div>
                    <div class="flex justify-between">
                      <dt>Region</dt>
                      <dd class="text-text-primary font-medium">
                        {regionOptions.find((o) => o.value === region)?.label ?? '—'}
                      </dd>
                    </div>
                  </dl>
                </Card>
                <Checkbox
                  label="I agree to the terms and conditions"
                  bind:checked={agreedToTerms}
                />
              {/if}
            </div>

            <div class="mt-6 flex justify-between">
              <Button variant="ghost" intent="neutral" onclick={back} disabled={step === 0}>
                Back
              </Button>
              <Button intent="primary" onclick={next} disabled={!canNext}>
                {step < 2 ? 'Next' : 'Submit'}
              </Button>
            </div>
          {/if}
        </Card>
      </div>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="The gate is the button, not the fields">
        <p>
          Each step folds its requirements into <code class="text-text-primary">canNext</code>, and
          the disabled Next is where the user meets it. No field carries an
          <code class="text-text-primary">error</code>, because presence is all this wizard checks.
          When a step checks shape instead (an email format, a minimum length), hold the message
          back until there is input, as the
          <a class="text-primary hover:underline" href={resolve('/recipes/login')}>Login Form</a>
          recipe does, and fold that field's validity into
          <code class="text-text-primary">canNext</code> so the button and the message never disagree.
        </p>
      </Note>
      <Note title="Back costs nothing because the page owns the values">
        <p>
          Moving between steps unmounts the fields you leave, but every value lives in the page, not
          in the fields: Back returns to a filled step, and the review step reads the same variables
          straight into its summary. There is no store and nothing to collect on submit; the whole
          wizard is one component holding eight
          <code class="text-text-primary">$state</code> variables.
        </p>
      </Note>
    </NoteList>

    <p class="text-text-secondary mt-6 text-sm">
      The three steps here run in a fixed order. When an answer decides what the next step even
      asks, derive the steps from the answers instead:
      <a class="text-primary hover:underline" href={resolve('/recipes/decision-tree-wizard')}
        >Decision Tree Wizard</a
      >
      builds its flow that way.
    </p>
  </Section>
</RecipeShell>
