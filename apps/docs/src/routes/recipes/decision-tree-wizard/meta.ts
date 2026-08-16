import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Forms',
  difficulty: 'Advanced',
  title: 'Decision Tree Wizard',
  description:
    'A Stepper wizard whose route depends on the answers so far: a skipIf predicate filters the step list, so choosing a single fuel removes the hybrid step. The review step derives a recommendation from the answer path.',
  components: ['Stepper', 'StepperStep', 'Card', 'RadioGroup', 'RadioItem', 'Button', 'Alert'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'The step list is $derived: any step can carry a skipIf predicate, and the rail, the flow and the step count follow the answers with no navigation code.',
    'The review step derives { method, intent, reason } from the answer path and renders it as a soft Alert (success, warning or danger).',
    "canNext gates the Next button on the current step's answer; Back never validates. The Stepper rail is display-only (clickable off), so the gate cannot be bypassed.",
    'An answer left behind by a hidden step stays in answers; recommendation branches match fuelType first, so a stale key never selects a result.',
    'No persistence: currentStep indexes a derived list, so the index alone is meaningless. A resumable draft would persist answers instead.'
  ]
};
