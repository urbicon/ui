import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Forms',
  difficulty: 'Intermediate',
  title: 'Unsaved Changes Guard',
  description:
    'An edit form that intercepts navigation while it holds unsaved changes: a beforeNavigate use hook cancels the route change and asks through a three-exit ConfirmDialog, while closing the tab gets the native browser prompt.',
  components: ['ConfirmDialog', 'Input', 'Button'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Two files: a use-unsaved-guard.svelte.ts hook (the navigation interception) and the form page that wires it to a ConfirmDialog.',
    'The dirty flag is a $derived diff against the saved baseline (name !== originalName), so an edit typed and deleted again counts as clean; no hand-set flag to drift.',
    "One beforeNavigate covers links, goto() and back/forward: it cancels, awaits confirm(), and retries via goto. A type 'leave' navigation (tab close, reload) gets the native browser prompt via nav.cancel() instead; no hand-rolled beforeunload listener.",
    'confirm() is promise-based: Cancel resolves false; Save-and-leave and the discard link (rendered as ConfirmDialog children) clear the dirty state before resolving true, which is what lets the retried navigation pass the guard.',
    'Fits forms with an explicit save step. A schema that tolerates auto-save (settings, notes) needs no guard.'
  ]
};
