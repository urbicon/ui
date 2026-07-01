import { resolve } from '$app/paths';

/**
 * Maps component display names to their documentation page URLs.
 * Used by recipe and showcase pages to create linked component badges.
 */
export const componentLinks: Record<string, string> = {
  Accordion: '/blocks/primitives/accordion',
  AccordionItem: '/blocks/primitives/accordion',
  Alert: '/blocks/primitives/alert',
  Avatar: '/blocks/primitives/avatar',
  Badge: '/blocks/primitives/badge',
  Breadcrumb: '/blocks/primitives/breadcrumb',
  Button: '/blocks/primitives/button',
  ButtonGroup: '/blocks/primitives/button-group',
  Calendar: '/blocks/components/calendar',
  AreaChart: '/blocks/components/area-chart',
  BarChart: '/blocks/components/bar-chart',
  DonutChart: '/blocks/components/donut-chart',
  LineChart: '/blocks/components/line-chart',
  Sparkline: '/blocks/components/sparkline',
  Card: '/blocks/primitives/card',
  Checkbox: '/blocks/primitives/checkbox',
  Collapsible: '/blocks/primitives/collapsible',
  Combobox: '/blocks/primitives/combobox',
  CommandPalette: '/blocks/components/command-palette',
  CompositionBar: '/blocks/components/composition-bar',
  Guide: '/blocks/components/guide',
  GuideProvider: '/blocks/components/guide',
  GuidePanel: '/blocks/components/guide',
  GuideArticle: '/blocks/components/guide',
  GuideMarker: '/blocks/components/guide',
  GuideMention: '/blocks/components/guide',
  GuideHint: '/blocks/components/guide',
  GuideBeacon: '/blocks/components/guide',
  Dialog: '/blocks/primitives/dialog',
  Drawer: '/blocks/primitives/drawer',
  Menu: '/blocks/primitives/menu',
  FileUpload: '/blocks/components/file-upload',
  Input: '/blocks/primitives/input',
  JourneyTimeline: '/blocks/primitives/journey-timeline',
  LocaleSwitcher: '/blocks/components/locale-switcher',
  Pagination: '/blocks/primitives/pagination',
  Popover: '/blocks/primitives/popover',
  Progress: '/blocks/primitives/progress',
  RadioGroup: '/blocks/primitives/radio-group',
  Sankey: '/blocks/components/sankey',
  SegmentGroup: '/blocks/primitives/segment-group',
  SegmentItem: '/blocks/primitives/segment-group',
  Select: '/blocks/primitives/select',
  Separator: '/blocks/primitives/separator',
  Sidebar: '/blocks/primitives/sidebar',
  SidebarLayout: '/blocks/components/sidebar-layout',
  Skeleton: '/blocks/primitives/skeleton',
  Slider: '/blocks/primitives/slider',
  Spinner: '/blocks/primitives/spinner',
  Stepper: '/blocks/primitives/stepper',
  Tab: '/blocks/primitives/tab',
  Textarea: '/blocks/primitives/textarea',
  ThemeSwitcher: '/blocks/components/theme-switcher',
  Toast: '/blocks/primitives/toast',
  Toggle: '/blocks/primitives/toggle',
  Toolbar: '/blocks/primitives/toolbar',
  Tooltip: '/blocks/primitives/tooltip',
  Table: '/table/table',
  // Auth package components
  LoginPage: '/auth/components/login-page',
  RegisterPage: '/auth/components/register-page',
  ForgotPasswordPage: '/auth/components/forgot-password-page',
  ResetPasswordPage: '/auth/components/reset-password-page',
  VerifyEmailPage: '/auth/components/verify-email-page',
  InvitationManager: '/auth/components/invitation-manager',
  PasskeyManager: '/auth/components/passkey-manager',
  AccountSettings: '/auth/components/account-settings',
  SessionManager: '/auth/components/session-manager',
  TwoFactorManager: '/auth/components/two-factor-manager',
  NotificationCenter: '/auth/components/notification-center',
  NotificationBadge: '/auth/components/notification-badge',
  NotificationListener: '/auth/components/notification-listener',
  PushPermissionPrompt: '/auth/components/push-permission-prompt'
};

/**
 * Build pre-resolved `RelatedLink`s from a `componentData` object's
 * `relatedComponents`, suitable for passing to `<DocsLayout related />`.
 *
 * Unknown component names (i.e. anything not in `componentLinks`) are
 * dropped — the `@related` JSDoc accepts free-form strings, so a typo
 * shouldn't render as a dead link. Duplicate hrefs are collapsed to the
 * first label — several names can map to one page (e.g. all Guide surfaces
 * → the Guide page), and the TOC keys related links by href, so emitting
 * the same href twice crashes it (`each_key_duplicate`). Returns `undefined`
 * when the input has no entries so `{#if related?.length}` in the TOC stays clean.
 *
 * `resolve` is imported internally from `$app/paths`; the strict
 * SvelteKit route-literal typing is widened via a local cast so this
 * helper can be called from anywhere without forcing each consumer to
 * cast the symbol.
 */
export function buildRelatedLinks(
  componentData: { relatedComponents?: string[] } | null | undefined
): { label: string; href: string }[] | undefined {
  const names = componentData?.relatedComponents;
  if (!names || names.length === 0) return undefined;
  const resolveAny = resolve as (path: string) => string;
  const links: { label: string; href: string }[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const path = componentLinks[name];
    if (!path || seen.has(path)) continue;
    seen.add(path);
    links.push({ label: name, href: resolveAny(path) });
  }
  return links.length > 0 ? links : undefined;
}
