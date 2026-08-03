import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Forms',
  difficulty: 'Intermediate',
  title: 'Unsaved Changes Guard',
  description:
    'Guards against data loss when leaving a page with unsaved changes — combines ConfirmDialog (in-app confirm) and window.beforeunload (browser confirm). SvelteKit pattern with a beforeNavigate hook for in-app route changes.',
  components: ['ConfirmDialog'],
  features: [
    'dirty flag as a $derived diff (name !== originalName) — no manual flag that can drift out of sync',
    'beforeNavigate (SvelteKit) intercepts in-app route changes → ConfirmDialog',
    'window.beforeunload for browser close, refresh, external links → native browser confirm',
    'Cleanup-safe — the beforeunload listener is removed in onDestroy',
    'Reusable as a use hook (no component mount required)'
  ]
};
