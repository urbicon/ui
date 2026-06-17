export const recipeMeta = {
  title: 'Unsaved Changes Guard',
  description:
    'Guards against data loss when leaving a page with unsaved changes — combines ConfirmDialog (in-app confirm) and window.beforeunload (browser confirm). SvelteKit pattern with a beforeNavigate hook for in-app route changes.',
  components: ['ConfirmDialog'],
  features: [
    'dirty flag as a $state signal — every form input sets it to true on input',
    'beforeNavigate (SvelteKit) intercepts in-app route changes → ConfirmDialog',
    'window.beforeunload for browser close, refresh, external links → native browser confirm',
    'Cleanup-safe — listeners are deregistered in the $effect cleanup',
    'Reusable as a use hook (no component mount required)'
  ]
};
