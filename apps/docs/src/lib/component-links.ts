import { resolve } from '$app/paths';

/**
 * Maps component display names to their documentation page URLs.
 * Used by recipe and showcase pages to create linked component badges.
 *
 * Alphabetical, and every catalogue component that has a page of its own must
 * be in here — `bun run registry:lint` checks both directions (a missing name
 * makes its `@related` chips vanish without a word, see `buildRelatedLinks`
 * below). Names WITHOUT a page of their own — the Guide surfaces, AccordionItem,
 * SegmentItem — deliberately alias onto the page that documents them.
 */
export const componentLinks: Record<string, string> = {
  A2UIView: '/blocks/components/a2-ui-view',
  Accordion: '/blocks/primitives/accordion',
  AccordionItem: '/blocks/primitives/accordion',
  Alert: '/blocks/primitives/alert',
  ApiReference: '/docs/components/api-reference',
  AreaChart: '/blocks/components/area-chart',
  Avatar: '/blocks/primitives/avatar',
  AvatarGroup: '/blocks/components/avatar-group',
  Badge: '/blocks/primitives/badge',
  BarChart: '/blocks/components/bar-chart',
  Breadcrumb: '/blocks/primitives/breadcrumb',
  Button: '/blocks/primitives/button',
  ButtonGroup: '/blocks/primitives/button-group',
  Calendar: '/blocks/components/calendar',
  Card: '/blocks/primitives/card',
  ChartFrame: '/blocks/components/chart-frame',
  Chat: '/blocks/components/chat',
  ChatMessage: '/blocks/components/chat-message',
  ChatMessageList: '/blocks/components/chat-message-list',
  Checkbox: '/blocks/primitives/checkbox',
  CitationChip: '/blocks/components/citation-chip',
  CodeBlock: '/blocks/components/code-block',
  CodeExample: '/docs/components/code-example',
  CodePanel: '/docs/components/code-panel',
  Collapsible: '/blocks/primitives/collapsible',
  Combobox: '/blocks/primitives/combobox',
  CommandPalette: '/blocks/components/command-palette',
  CompositionBar: '/blocks/components/composition-bar',
  ConfirmDialog: '/blocks/primitives/confirm-dialog',
  CopyButton: '/blocks/components/copy-button',
  CurrencyInput: '/blocks/components/currency-input',
  DatePicker: '/blocks/components/date-picker',
  DateRangePicker: '/blocks/components/date-range-picker',
  Dialog: '/blocks/primitives/dialog',
  DocsLayout: '/docs/components/docs-layout',
  DonutChart: '/blocks/components/donut-chart',
  Drawer: '/blocks/primitives/drawer',
  EmptyState: '/blocks/components/empty-state',
  FileUpload: '/blocks/components/file-upload',
  FormField: '/blocks/primitives/form-field',
  Guide: '/blocks/components/guide',
  GuideArticle: '/blocks/components/guide',
  GuideBeacon: '/blocks/components/guide',
  GuideHint: '/blocks/components/guide',
  GuideMarker: '/blocks/components/guide',
  GuideMention: '/blocks/components/guide',
  GuidePanel: '/blocks/components/guide',
  GuideProvider: '/blocks/components/guide',
  GuideRef: '/blocks/components/guide',
  InfoCard: '/docs/components/info-card',
  Input: '/blocks/primitives/input',
  JourneyTimeline: '/blocks/primitives/journey-timeline',
  Kbd: '/blocks/primitives/kbd',
  LineChart: '/blocks/components/line-chart',
  LocaleSwitcher: '/blocks/components/locale-switcher',
  Menu: '/blocks/primitives/menu',
  // Note ships with NoteList and has no page of its own — a `@related Note`
  // chip aliases onto the list's page rather than being dropped.
  Note: '/docs/components/note-list',
  NoteList: '/docs/components/note-list',
  NumberInput: '/blocks/components/number-input',
  Pagination: '/blocks/primitives/pagination',
  PinInput: '/blocks/components/pin-input',
  Planner: '/blocks/components/planner',
  PlaygroundConfigurator: '/docs/components/playground-configurator',
  Popover: '/blocks/primitives/popover',
  Progress: '/blocks/primitives/progress',
  PromptInput: '/blocks/components/prompt-input',
  QRCode: '/blocks/components/qr-code',
  RadioGroup: '/blocks/primitives/radio-group',
  RadioItem: '/blocks/primitives/radio-group',
  ReasoningDisclosure: '/blocks/components/reasoning-disclosure',
  Sankey: '/blocks/components/sankey',
  Scroller: '/blocks/primitives/scroller',
  Section: '/docs/components/section',
  SegmentGroup: '/blocks/primitives/segment-group',
  SegmentItem: '/blocks/primitives/segment-group',
  Select: '/blocks/primitives/select',
  Separator: '/blocks/primitives/separator',
  Sidebar: '/blocks/primitives/sidebar',
  SidebarLayout: '/blocks/components/sidebar-layout',
  Skeleton: '/blocks/primitives/skeleton',
  Slider: '/blocks/primitives/slider',
  Sparkline: '/blocks/components/sparkline',
  Spinner: '/blocks/primitives/spinner',
  SplitPane: '/blocks/primitives/split-pane',
  Stepper: '/blocks/primitives/stepper',
  StepperStep: '/blocks/primitives/stepper',
  StreamingMarkdown: '/blocks/components/streaming-markdown',
  Tab: '/blocks/primitives/tab',
  TableOfContents: '/docs/components/table-of-contents',
  Textarea: '/blocks/primitives/textarea',
  ThemeSwitcher: '/blocks/components/theme-switcher',
  TimeInput: '/blocks/components/time-input',
  Toast: '/blocks/primitives/toast',
  Toggle: '/blocks/primitives/toggle',
  Toolbar: '/blocks/primitives/toolbar',
  ToolCallCard: '/blocks/components/tool-call-card',
  Tooltip: '/blocks/primitives/tooltip',
  Table: '/table/table',
  // Auth package components
  LoginPage: '/auth/components/login-page',
  RegisterPage: '/auth/components/register-page',
  ForgotPasswordPage: '/auth/components/forgot-password-page',
  ResetPasswordPage: '/auth/components/reset-password-page',
  TypesReference: '/docs/components/types-reference',
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
