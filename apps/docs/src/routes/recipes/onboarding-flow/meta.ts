import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'onboarding-guide',
  category: 'Display',
  difficulty: 'Advanced',
  title: 'Onboarding Flow',
  description:
    'First-run onboarding on the Guide system: a pulsing beacon offers an opt-in spotlight tour, a non-modal help panel links back into the UI, a manual hint flags the next feature, and the tour reports its own funnel through onStep, onComplete and onSkip.',
  components: [
    'GuideProvider',
    'Guide',
    'GuideBeacon',
    'GuidePanel',
    'GuideArticle',
    'GuideMarker',
    'GuideMention',
    'GuideHint'
  ],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'GuideBeacon is the opt-in entry: a pulsing button that starts the tour and, via once (default true), hides once that tour has been seen. The demo passes once: false everywhere to stay repeatable.',
    'Tour analytics live on the GuideTour itself: onStep({ index, total, via }) fires on start and every next/prev, onComplete on finishing, onSkip carries the drop-off index; programmatic stopTour() fires nothing.',
    'data-guide="id" marks each target once; tour steps, GuideMarker, GuideMention and GuideHint all resolve to it.',
    'GuidePanel is non-modal (no backdrop, no focus trap): GuideMention inside a GuideArticle highlights the target behind the open panel, GuideMarker opens the panel at its article.',
    'GuideHint with trigger="manual" waits for open: here onComplete raises it to flag the API-keys feature.',
    "Seen state persists through the controller's storage adapter: localStorage by default, injectable for account-backed state."
  ]
};
