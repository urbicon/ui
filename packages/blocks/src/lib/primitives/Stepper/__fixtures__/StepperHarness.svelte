<script lang="ts">
  // Test-only composition harness for Stepper — its StepperStep children claim
  // their index through StepperContext (registerStep), so the interaction test
  // mounts a real composition. Under __fixtures__/ so it is excluded from the
  // published package and never collected as a test file. Not exported from the
  // barrel.
  import type { StepperProps } from '../index';
  import Stepper from '../Stepper.svelte';
  import StepperStep from '../StepperStep.svelte';

  type Step = { label: string; disabled?: boolean };

  let {
    steps = [{ label: 'Account' }, { label: 'Profile' }, { label: 'Review' }] as Step[],
    ...stepperProps
  }: Partial<StepperProps> & { steps?: Step[] } = $props();
</script>

<Stepper {...stepperProps}>
  {#each steps as step (step.label)}
    <StepperStep label={step.label} disabled={step.disabled} />
  {/each}
</Stepper>
