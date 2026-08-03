import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'onboarding-guide',
  category: 'Display',
  difficulty: 'Advanced',
  title: 'Onboarding Flow',
  description:
    'First-run onboarding built on the Guide system: a waiting beacon starts an opt-in spotlight tour, a non-modal help panel links back to the UI, a hint flags a new feature, and analytics hooks track the funnel.',
  components: [
    'GuideProvider',
    'Guide',
    'GuideBeacon',
    'GuidePanel',
    'GuideMarker',
    'GuideMention',
    'GuideHint',
    'Button'
  ],
  features: [
    'Opt-in guided tour with a spotlight on each step',
    'Waiting beacon as the gentle, non-intrusive tour entry',
    'Non-modal help panel with articles that link back to the UI',
    'Contextual hint flagging a brand-new feature',
    'Tour analytics: onStep / onComplete / onSkip funnel + drop-off',
    'One GuideController drives every surface'
  ]
};
