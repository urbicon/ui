/**
 * The eval-suite design briefs — the standing benchmark for "does a change to the
 * design layers actually improve generation, or just lengthen the context?"
 * (docs/DESIGN-MCP.md, cross-cutting eval). Systematises earlier one-off
 * design-quality comparisons into a repeatable set.
 *
 * Each brief is generated under two conditions (baseline vs. design-MCP loop),
 * then scored by `scoreImplementation` (deterministic linter) and the judge
 * rubric (get_design_principles(as="rubric")). The brief spread covers the page
 * archetypes the composition patterns target, plus a couple of component-dense
 * surfaces where token hallucination tends to spike.
 */

export interface EvalBrief {
  id: string;
  title: string;
  /** The prompt handed to the generating instance. */
  prompt: string;
  /** Suggested composition pattern, when one fits (for the design-MCP condition). */
  pattern?: string;
  tags: string[];
}

export const EVAL_BRIEFS: readonly EvalBrief[] = [
  {
    id: 'ops-dashboard',
    title: 'Ops Dashboard',
    prompt:
      'Build an operations dashboard for a SaaS product: a row of KPI tiles (users, revenue, error rate, latency), a primary chart area, a recent-activity feed, and a quick-actions panel. Some metrics are healthy, some are degraded.',
    pattern: 'dashboard',
    tags: ['dashboard', 'data-dense', 'status']
  },
  {
    id: 'account-settings',
    title: 'Account Settings',
    prompt:
      'Build an account settings page with sections for Profile, Notifications, and Security. Booleans use toggles, enums use selects, and there is a destructive "Delete account" action separated at the bottom.',
    pattern: 'settings-page',
    tags: ['settings', 'form', 'destructive']
  },
  {
    id: 'signup-wizard',
    title: 'Multi-Step Signup',
    prompt:
      'Build a three-step signup wizard (account → organisation → review) with inline field validation, a progress indicator, and a sticky continue/back action bar.',
    pattern: 'form-page',
    tags: ['form', 'wizard', 'validation']
  },
  {
    id: 'pricing',
    title: 'Pricing Page',
    prompt:
      'Build a pricing page with three tiers (Starter, Pro, Enterprise), one highlighted as recommended, each with a feature list and a call-to-action. Include a monthly/yearly toggle.',
    tags: ['marketing', 'cards', 'cta']
  },
  {
    id: 'users-table',
    title: 'Users Admin Table',
    prompt:
      'Build a users administration screen: a searchable, filterable table of users with avatar, name, role badge, status, and per-row actions (edit, suspend). Include a header with a search field and a "Add user" button.',
    tags: ['data-table', 'admin', 'data-dense']
  },
  {
    id: 'empty-inbox',
    title: 'Empty Inbox State',
    prompt:
      'Build an empty state for an inbox that has no messages yet: an illustration or icon, a friendly headline, a one-line explanation, and a primary action to compose the first message.',
    tags: ['empty-state', 'feedback']
  },
  {
    id: 'login',
    title: 'Login Page',
    prompt:
      'Build a login page with email and password fields, a "forgot password" link, a primary sign-in button, and a secondary "Sign in with a passkey" option. Show inline validation on the fields.',
    pattern: 'form-page',
    tags: ['auth', 'form']
  },
  {
    id: 'profile-card',
    title: 'Profile Card',
    prompt:
      'Build a user profile card: avatar, name, role, a short bio, three stat figures (followers, following, posts), and follow / message actions.',
    tags: ['identity', 'card']
  },
  {
    id: 'checkout-summary',
    title: 'Checkout Summary',
    prompt:
      'Build a checkout order summary: a list of line items with quantity and price, a promo-code field, a subtotal/tax/total breakdown, and a sticky "Pay now" button. One item is on sale.',
    tags: ['commerce', 'data-dense', 'sticky']
  },
  {
    id: 'notification-center',
    title: 'Notification Center',
    prompt:
      'Build a notification center panel: notifications grouped by Today / Earlier, each with an icon by type (mention, system, billing), a timestamp, read/unread state, and a dismiss control. Include a "Mark all as read" action.',
    pattern: 'tab-navigation',
    tags: ['feedback', 'list', 'state-driven']
  }
];

export function getBriefById(id: string): EvalBrief | undefined {
  return EVAL_BRIEFS.find((b) => b.id === id);
}
