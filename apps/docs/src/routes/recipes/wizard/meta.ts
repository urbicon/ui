import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'form-page',
  category: 'Forms',
  difficulty: 'Advanced',
  title: 'Multi-Step Wizard',
  description:
    'A three-step signup wizard: Next stays disabled until the current step is filled in, a review step reads every answer back, and Back returns without losing input.',
  components: [
    'Stepper',
    'StepperStep',
    'Input',
    'Select',
    'RadioGroup',
    'RadioItem',
    'Textarea',
    'Checkbox',
    'Button',
    'Card',
    'Progress',
    'Alert'
  ],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Per-step gating: one canNext $derived switches on step. Next is disabled until the current step passes and becomes Submit on the last one, gated on a terms Checkbox.',
    'The Stepper reads bind:activeStep and derives complete/active/inactive per step; clickable stays off, so movement runs only through the Back and Next buttons.',
    'Step bodies swap in an if chain while all values live in page state, so Back restores filled fields and the review step reads them without a store.',
    'Progress shows step/3 and jumps to 100 on submit; submitting swaps the card body for a success Alert, and Start Over writes the initial values back.',
    'Fields: two Inputs, a RadioGroup for the plan, a Select for the region, a Textarea with showCounter and maxlength; the summary is a dl in a quiet Card.'
  ]
};
