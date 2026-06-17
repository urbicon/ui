export const recipeMeta = {
  title: 'Range Hint Input',
  description:
    'Input with a contextual plausibility range in the helper text that reacts adaptively to the value (success / warning / danger). Generic pattern for plausibility checks without hard validation — the user may deliberately enter values outside the range.',
  components: ['Input'],
  features: [
    'Adaptive helper-text color based on $derived status',
    'Tolerance factor for "slightly off" vs. "far outside"',
    'No blocking — the user can always enter values outside the range',
    'Explanatory hint on danger: "Typo? Meter replaced?"',
    'Reusable as a small wrapper without a new component'
  ]
};
