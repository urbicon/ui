import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Forms',
  difficulty: 'Advanced',
  title: 'Decision Tree Wizard',
  description:
    'Stepper wizard where answers in step N change the options or the flow in step N+1. Pattern for auto-deriving complex configurations from simple user decisions.',
  components: ['Stepper', 'StepperStep', 'Card', 'RadioGroup', 'RadioItem', 'Button', 'Alert'],
  features: [
    'Dynamically visible steps via $derived and a skipIf predicate',
    'Auto-derived recommendation in the review step',
    'Answer path determines the options available in the next step',
    'Back navigation always allowed, forward only once the current answer is given',
    'No URL-state persistence — the wizard is ephemeral'
  ]
};
