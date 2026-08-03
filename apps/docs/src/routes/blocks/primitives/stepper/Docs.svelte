<!-- urbicon-ignore raw-tailwind-color — the 17 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Badge, Button, Kbd, Stepper, StepperStep } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let interactiveStep = $state(0);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Checkout wizard"
      description="Bound activeStep with Back/Next navigation — the canonical multi-step form pattern."
      isolate
    >
      <div class="flex w-full flex-col gap-4">
        <div class="flex items-center gap-2">
          <span class="text-text-tertiary text-xs font-medium">Active step:</span>
          <Badge size="xs" intent="primary" variant="soft">{interactiveStep + 1} / 4</Badge>
        </div>
        <Stepper bind:activeStep={interactiveStep} clickable>
          <StepperStep label="Account" description="Create account" />
          <StepperStep label="Profile" description="Your details" />
          <StepperStep label="Preferences" description="Customize" optional />
          <StepperStep label="Done" description="All set" />
        </Stepper>
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="outlined"
            disabled={interactiveStep === 0}
            onclick={() => (interactiveStep = Math.max(0, interactiveStep - 1))}
          >
            Back
          </Button>
          <Button
            size="sm"
            disabled={interactiveStep === 3}
            onclick={() => (interactiveStep = Math.min(3, interactiveStep + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Mixed per-step states"
      description="Override auto-derived states with error or warning for individual steps — e.g. a checkout where payment failed but shipping needs review."
      isolate
    >
      <Stepper activeStep={2}>
        <StepperStep label="Account" description="Completed" />
        <StepperStep label="Payment" description="Card declined" state="error" />
        <StepperStep label="Shipping" description="Verify address" state="warning" />
        <StepperStep label="Review" description="Final check" />
      </Stepper>
    </CodeExample>

    <CodeExample
      title="Optional steps in onboarding"
      description="Mark non-required steps with the optional flag — users see an 'Optional' hint and can skip them."
      isolate
    >
      <Stepper activeStep={1}>
        <StepperStep label="Account" description="Required" />
        <StepperStep label="Avatar" description="Upload photo" optional />
        <StepperStep label="Bio" description="Tell us about you" optional />
        <StepperStep label="Finish" description="Complete setup" />
      </Stepper>
    </CodeExample>
  </div>
</Section>

<!-- ─── Vertical ─── -->

<Section marker="02" id="vertical" title="Vertical Stepper">
  <div class="space-y-8">
    <CodeExample
      title="Vertical with content per step"
      description="Vertical orientation exposes a content slot per step — useful for inline instructions or embedded forms."
      isolate
      previewClass="flex flex-col gap-4 max-w-md w-full"
    >
      <Stepper activeStep={1} orientation="vertical">
        <StepperStep label="Create Account" description="Enter your email and password">
          <div class="bg-surface-elevated border-border-subtle rounded-contain border p-4">
            <p class="text-text-secondary text-sm">
              Enter your credentials to create a new account. We'll send a verification email to
              confirm your address.
            </p>
          </div>
        </StepperStep>
        <StepperStep label="Personal Info" description="Tell us about yourself">
          <div class="bg-surface-elevated border-border-subtle rounded-contain border p-4">
            <p class="text-text-secondary text-sm">
              Fill in your name, date of birth, and contact information. This helps us personalize
              your experience.
            </p>
          </div>
        </StepperStep>
        <StepperStep label="Preferences" description="Customize your experience" optional>
          <div class="bg-surface-elevated border-border-subtle rounded-contain border p-4">
            <p class="text-text-secondary text-sm">
              Choose your notification preferences, language, and theme settings.
            </p>
          </div>
        </StepperStep>
        <StepperStep label="Complete" description="Review and finish" />
      </Stepper>
    </CodeExample>

    <CodeExample
      title="Vertical with error state"
      description="A failed step blocks progress until resolved — surface the error inline via the step content slot."
      isolate
      previewClass="flex flex-col gap-4 max-w-md w-full"
    >
      <Stepper activeStep={2} orientation="vertical">
        <StepperStep label="Account Created" description="Email verified" />
        <StepperStep label="Payment Failed" description="Card was declined" state="error">
          <div class="border-danger/20 bg-danger/5 rounded-contain border p-4">
            <p class="text-danger text-sm font-medium">
              Your card ending in •••• 4242 was declined. Please update your payment method.
            </p>
          </div>
        </StepperStep>
        <StepperStep label="Ship Order" description="Awaiting payment" />
      </Stepper>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="slotClasses Override"
      description="Restyle individual slots — indicator color, label styling, separator thickness."
      isolate
    >
      <Stepper
        activeStep={1}
        slotClasses={{
          separator: 'h-1 rounded-none'
        }}
      >
        <StepperStep label="Draft" description="Write content" />
        <StepperStep label="Review" description="Get feedback" />
        <StepperStep label="Publish" description="Go live" />
      </Stepper>
    </CodeExample>

    <CodeExample
      title="Dark Glassmorphism"
      description="Fully custom frosted-glass stepper with unstyled mode."
      isolate
      previewClass="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 w-full"
    >
      <Stepper
        unstyled
        activeStep={1}
        class="flex w-full items-center [&>li:last-child_[data-stepper-separator]]:hidden"
      >
        <StepperStep
          unstyled
          label="Design"
          slotClasses={{
            stepItem: 'flex items-center [&:not(:last-child)]:flex-1',
            step: 'flex items-center gap-2.5 shrink-0',
            indicator:
              'flex size-9 items-center justify-center rounded-full text-sm font-semibold bg-white/25 text-white backdrop-blur-md border-2 border-white/30',
            label: 'text-sm font-medium text-white/90',
            separator: 'h-0.5 flex-1 mx-3 bg-white/20 rounded-full'
          }}
        />
        <StepperStep
          unstyled
          label="Develop"
          slotClasses={{
            stepItem: 'flex items-center [&:not(:last-child)]:flex-1',
            step: 'flex items-center gap-2.5 shrink-0',
            indicator:
              'flex size-9 items-center justify-center rounded-full text-sm font-semibold bg-white/40 text-white backdrop-blur-md border-2 border-white/50 shadow-lg shadow-white/10',
            label: 'text-sm font-semibold text-white',
            separator: 'h-0.5 flex-1 mx-3 bg-white/20 rounded-full'
          }}
        />
        <StepperStep
          unstyled
          label="Deploy"
          slotClasses={{
            stepItem: 'flex items-center',
            step: 'flex items-center gap-2.5 shrink-0',
            indicator:
              'flex size-9 items-center justify-center rounded-full text-sm font-semibold bg-white/10 text-white/50 backdrop-blur-md border-2 border-white/15',
            label: 'text-sm font-medium text-white/50',
            separator: 'hidden'
          }}
        />
      </Stepper>
    </CodeExample>

    <CodeExample
      title="Terminal Progress"
      description="Monospace hacker aesthetic."
      isolate
      previewClass="rounded-2xl bg-neutral-950 p-8 w-full"
    >
      <Stepper
        unstyled
        activeStep={2}
        class="flex w-full items-center font-mono [&>li:last-child_[data-stepper-separator]]:hidden"
      >
        <StepperStep
          unstyled
          label="BUILD"
          slotClasses={{
            stepItem: 'flex items-center [&:not(:last-child)]:flex-1',
            step: 'flex items-center gap-2 shrink-0',
            indicator:
              'flex size-7 items-center justify-center rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
            label: 'text-xs text-emerald-300 tracking-wider',
            separator: 'h-px flex-1 mx-3 bg-emerald-500/20'
          }}
        />
        <StepperStep
          unstyled
          label="TEST"
          slotClasses={{
            stepItem: 'flex items-center [&:not(:last-child)]:flex-1',
            step: 'flex items-center gap-2 shrink-0',
            indicator:
              'flex size-7 items-center justify-center rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
            label: 'text-xs text-emerald-300 tracking-wider',
            separator: 'h-px flex-1 mx-3 bg-emerald-500/20'
          }}
        />
        <StepperStep
          unstyled
          label="DEPLOY"
          slotClasses={{
            stepItem: 'flex items-center [&:not(:last-child)]:flex-1',
            step: 'flex items-center gap-2 shrink-0',
            indicator:
              'flex size-7 items-center justify-center rounded text-xs font-bold bg-emerald-500 text-neutral-950 border border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]',
            label: 'text-xs text-emerald-300 tracking-wider font-bold',
            separator: 'h-px flex-1 mx-3 bg-emerald-500/20'
          }}
        />
        <StepperStep
          unstyled
          label="MONITOR"
          slotClasses={{
            stepItem: 'flex items-center',
            step: 'flex items-center gap-2 shrink-0',
            indicator:
              'flex size-7 items-center justify-center rounded text-xs font-bold bg-transparent text-neutral-400 border border-neutral-600',
            label: 'text-xs text-neutral-400 tracking-wider',
            separator: 'hidden'
          }}
        />
      </Stepper>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      Wizard chrome like the glass or terminal looks above belongs in <code
        class="text-text-primary">BlocksProvider</code
      >
      presets — <code class="text-text-primary">presets.Stepper</code> for the shell,
      <code class="text-text-primary">presets.StepperStep</code>
      for the per-step slots — applied via <code class="text-text-primary">preset</code>. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        The stepper renders as an <code class="text-text-primary">&lt;ol&gt;</code> with
        <code class="text-text-primary">aria-label="Progress"</code>. The active step is marked with
        <code class="text-text-primary">aria-current="step"</code>. Clickable steps get
        <code class="text-text-primary">role="button"</code> for screen reader identification. The
        <code class="text-text-primary">data-orientation</code> attribute exposes the layout direction.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="Tab" />
        moves focus between clickable steps.
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />
        activates the focused step. Focus rings use
        <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
      </p>
    </Note>
    <Note title="Step States">
      <p>
        Completed, error, and warning steps use distinct icons (checkmark, X, warning triangle) in
        addition to color, ensuring status is never conveyed by color alone. Disabled steps are
        removed from the tab order via
        <code class="text-text-primary">pointer-events-none</code> and visual
        <code class="text-text-primary">opacity-50</code>.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        All transitions use design token durations (<code class="text-text-primary"
          >--blocks-duration-fast</code
        >,
        <code class="text-text-primary">--blocks-duration-normal</code>) which are reduced
        automatically when
        <code class="text-text-primary">prefers-reduced-motion</code> is active.
      </p>
    </Note>
  </NoteList>
</Section>
