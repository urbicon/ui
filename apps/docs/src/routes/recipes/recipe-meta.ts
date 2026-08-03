/**
 * The shape every `recipes/<slug>/meta.ts` exports, and the order the cookbook
 * shows them in.
 *
 * Until 2026-08 the cookbook index kept its own copy of each recipe's title,
 * description and component list. All 22 entries had drifted from the `meta.ts`
 * they duplicated — every description differed, and eight listed the wrong
 * components (the settings recipe claimed 6 of its 12). Nothing could notice,
 * because nothing compared them.
 *
 * So `meta.ts` is the source and the index derives from it. What stays here is
 * the one thing a meta file cannot carry: the order recipes are presented in.
 */
export interface RecipeMeta {
  /** Composition pattern from `design-system/patterns/`, when one applies. */
  pattern?: string;
  /** Cookbook grouping. */
  category: 'Authentication' | 'Layout' | 'Forms' | 'Display' | 'Marketing' | 'AI';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  title: string;
  description: string;
  /** Components the recipe builds on; rendered as chips linking to their docs. */
  components: string[];
  /** What the recipe demonstrates, shown as its feature list. */
  features: string[];
}

/**
 * Cookbook order. Grouped by category, easiest first within a group — an
 * editorial call, which is why it is written out rather than sorted.
 *
 * Drafts are absent by omission (`profile-card` today), which keeps the rule
 * `registry:lint` already enforces: a draft is hidden everywhere or nowhere.
 * That lint fails on a recipe directory missing here and on an entry with no
 * directory, so the list cannot quietly rot in either direction.
 */
export const RECIPE_ORDER = [
  'login',
  'auth-passkey-login',
  'auth-invitation-register',
  'auth-password-reset',
  'dashboard',
  'filter-sidebar',
  'settings',
  'wizard',
  'notification-center',
  'pricing',
  'trace-drawer',
  'decision-tree-wizard',
  'range-hint-input',
  'clickable-card',
  'stat-tile',
  'page-header',
  'help-tooltip',
  'onboarding-flow',
  'unsaved-changes-guard',
  'meal-planner',
  'ai-chat',
  'a2ui-agent-ui'
] as const;
