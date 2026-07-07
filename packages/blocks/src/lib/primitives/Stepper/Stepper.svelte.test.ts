// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StepperHarness from './__fixtures__/StepperHarness.svelte';
import type { StepperProps } from './index';

// Interaction layer for Stepper — the opt-in clickable navigation: only
// non-active steps are role=button, `linear` restricts jumps to at most one step
// ahead, and goToStep drives activeStep + onStepChange + aria-current. StepperStep
// claims its index through context, so the test mounts a real composition
// (StepperHarness). Same stack as the Combobox pilot: svelte's own mount/unmount,
// @testing-library/dom + user-event, native vitest matchers.

type Step = { label: string; disabled?: boolean };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderStepper(props: Partial<StepperProps> & { steps?: Step[] } = {}) {
  const instance = mount(StepperHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

// aria-current="step" marks the active step's <li>; its text includes the label.
const activeStepText = () => document.querySelector('[aria-current="step"]')?.textContent ?? '';
const stepButton = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

describe('Stepper (component interaction)', () => {
  it('marks the active step with aria-current and renders all steps', () => {
    renderStepper({ activeStep: 0 });

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(activeStepText()).toContain('Account');
  });

  it('exposes no button role when not clickable (default)', () => {
    renderStepper({ activeStep: 1 });
    // Without `clickable`, steps are presentational — no role=button anywhere.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('clickable: navigates to a completed step, moving activeStep + aria-current + onStepChange', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    renderStepper({ activeStep: 1, clickable: true, onStepChange });

    // The completed step 0 is clickable; the active step 1 is not.
    await user.click(stepButton('Account'));

    expect(onStepChange).toHaveBeenCalledWith(0);
    expect(activeStepText()).toContain('Account');
  });

  it('clickable: the active step itself is not a button', () => {
    renderStepper({ activeStep: 1, clickable: true });
    // Account (complete) and Review (ahead, non-linear) are buttons; Profile
    // (active) is not.
    expect(screen.queryByRole('button', { name: /Profile/ })).toBeNull();
    expect(stepButton('Account')).toBeTruthy();
    expect(stepButton('Review')).toBeTruthy();
  });

  it('linear + clickable: only the next step ahead is reachable', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    renderStepper({ activeStep: 0, clickable: true, linear: true, onStepChange });

    // Step 1 (activeStep + 1) is clickable; step 2 is two ahead → not a button.
    expect(stepButton('Profile')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Review/ })).toBeNull();

    await user.click(stepButton('Profile'));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it('clickable: activates a completed step via the keyboard (Enter)', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    renderStepper({ activeStep: 2, clickable: true, onStepChange });

    const back = stepButton('Account');
    back.focus();
    await user.keyboard('{Enter}');

    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  it('does not navigate when the stepper is disabled', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    renderStepper({ activeStep: 1, clickable: true, disabled: true, onStepChange });

    // Disabled removes clickability, so there are no step buttons to click.
    expect(screen.queryByRole('button')).toBeNull();
    expect(onStepChange).not.toHaveBeenCalled();
    // Sanity: still a valid stepper with the original active step.
    expect(activeStepText()).toContain('Profile');
    await user.keyboard('{Enter}');
    expect(onStepChange).not.toHaveBeenCalled();
  });
});
