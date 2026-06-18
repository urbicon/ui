import { useAppI18n } from '$lib/i18n';

export type NavItem = {
  name: string;
  nameKey?: string;
  href?: string;
  children?: NavItem[];
  group?: boolean;
};

/**
 * Context hook returning a nav-label resolver bound to the active app locale.
 * Call during component init: `const navLabel = useNavLabel();` then
 * `navLabel(item)`. (A free function can't read the i18n context, so the resolver
 * is created from the hook and closed over by the consuming component.)
 */
export function useNavLabel(): (item: NavItem) => string {
  const t = useAppI18n();
  return (item: NavItem) => (item.nameKey ? t(item.nameKey as Parameters<typeof t>[0]) : item.name);
}

export const navigationItems: NavItem[] = [
  { name: 'Overview', nameKey: 'nav.overview', href: '/' },
  { name: 'Getting Started', nameKey: 'nav.gettingStarted', href: '/getting-started' },
  {
    name: 'Blocks',
    nameKey: 'nav.blocks',
    href: '/blocks',
    children: [
      {
        name: 'Form',
        nameKey: 'nav.groups.form',
        group: true,
        children: [
          { name: 'Checkbox', href: '/blocks/primitives/checkbox' },
          { name: 'Combobox', href: '/blocks/primitives/combobox' },
          { name: 'CurrencyInput', href: '/blocks/components/currency-input' },
          { name: 'DatePicker', href: '/blocks/components/date-picker' },
          { name: 'FileUpload', href: '/blocks/components/file-upload' },
          { name: 'FormField', href: '/blocks/primitives/form-field' },
          { name: 'Input', href: '/blocks/primitives/input' },
          { name: 'RadioGroup', href: '/blocks/primitives/radio-group' },
          { name: 'Select', href: '/blocks/primitives/select' },
          { name: 'Slider', href: '/blocks/primitives/slider' },
          { name: 'Textarea', href: '/blocks/primitives/textarea' },
          { name: 'Toggle', href: '/blocks/primitives/toggle' }
        ]
      },
      {
        name: 'Actions',
        nameKey: 'nav.groups.actions',
        group: true,
        children: [
          { name: 'Button', href: '/blocks/primitives/button' },
          { name: 'ButtonGroup', href: '/blocks/primitives/button-group' },
          { name: 'CommandPalette', href: '/blocks/components/command-palette' },
          { name: 'LocaleSwitcher', href: '/blocks/components/locale-switcher' },
          { name: 'Menu', href: '/blocks/primitives/menu' },
          { name: 'ThemeSwitcher', href: '/blocks/components/theme-switcher' },
          { name: 'Toolbar', href: '/blocks/primitives/toolbar' }
        ]
      },
      {
        name: 'Overlay',
        nameKey: 'nav.groups.overlay',
        group: true,
        children: [
          { name: 'ConfirmDialog', href: '/blocks/primitives/confirm-dialog' },
          { name: 'Dialog', href: '/blocks/primitives/dialog' },
          { name: 'Drawer', href: '/blocks/primitives/drawer' },
          { name: 'Guide', href: '/blocks/components/guide' },
          { name: 'Popover', href: '/blocks/primitives/popover' }
        ]
      },
      {
        name: 'Feedback',
        nameKey: 'nav.groups.feedback',
        group: true,
        children: [
          { name: 'Alert', href: '/blocks/primitives/alert' },
          { name: 'Badge', href: '/blocks/primitives/badge' },
          { name: 'EmptyState', href: '/blocks/components/empty-state' },
          { name: 'Progress', href: '/blocks/primitives/progress' },
          { name: 'Skeleton', href: '/blocks/primitives/skeleton' },
          { name: 'Spinner', href: '/blocks/primitives/spinner' },
          { name: 'Toast', href: '/blocks/primitives/toast' }
        ]
      },
      {
        name: 'Layout',
        nameKey: 'nav.groups.layout',
        group: true,
        children: [
          { name: 'Accordion', href: '/blocks/primitives/accordion' },
          { name: 'Card', href: '/blocks/primitives/card' },
          { name: 'Collapsible', href: '/blocks/primitives/collapsible' },
          { name: 'Separator', href: '/blocks/primitives/separator' },
          { name: 'Sidebar', href: '/blocks/primitives/sidebar' },
          { name: 'SidebarLayout', href: '/blocks/components/sidebar-layout' }
        ]
      },
      {
        name: 'Navigation',
        nameKey: 'nav.groups.navigation',
        group: true,
        children: [
          { name: 'Breadcrumb', href: '/blocks/primitives/breadcrumb' },
          { name: 'Pagination', href: '/blocks/primitives/pagination' },
          { name: 'SegmentGroup', href: '/blocks/primitives/segment-group' },
          { name: 'Stepper', href: '/blocks/primitives/stepper' },
          { name: 'Tab', href: '/blocks/primitives/tab' }
        ]
      },
      {
        name: 'Display',
        nameKey: 'nav.groups.display',
        group: true,
        children: [
          { name: 'AreaChart', href: '/blocks/components/area-chart' },
          { name: 'Avatar', href: '/blocks/primitives/avatar' },
          { name: 'BarChart', href: '/blocks/components/bar-chart' },
          { name: 'Calendar', href: '/blocks/components/calendar' },
          { name: 'ChartFrame', href: '/blocks/components/chart-frame' },
          { name: 'CompositionBar', href: '/blocks/components/composition-bar' },
          { name: 'DonutChart', href: '/blocks/components/donut-chart' },
          { name: 'LineChart', href: '/blocks/components/line-chart' },
          { name: 'Planner', href: '/blocks/components/planner' },
          { name: 'Sankey', href: '/blocks/components/sankey' },
          { name: 'Sparkline', href: '/blocks/components/sparkline' },
          { name: 'Tooltip', href: '/blocks/primitives/tooltip' }
        ]
      }
    ]
  },
  {
    name: 'Table',
    nameKey: 'nav.table',
    href: '/table/table',
    children: [
      {
        name: 'Column Configuration',
        nameKey: 'nav.tableColumnConfig',
        href: '/table/column-config'
      },
      { name: 'Filtering & Search', nameKey: 'nav.tableFiltering', href: '/table/filtering' },
      {
        name: 'Sorting & Grouping',
        nameKey: 'nav.tableSortingGrouping',
        href: '/table/sorting-grouping'
      },
      { name: 'Row Selection', nameKey: 'nav.tableSelection', href: '/table/selection' },
      {
        name: 'Expandable Rows',
        nameKey: 'nav.tableExpandableRows',
        href: '/table/expandable-rows'
      },
      { name: 'Custom Cells', nameKey: 'nav.tableCustomCells', href: '/table/custom-cells' },
      { name: 'Column Reorder', nameKey: 'nav.tableColumnReorder', href: '/table/column-reorder' },
      {
        name: 'Virtual Scrolling',
        nameKey: 'nav.tableVirtualScrolling',
        href: '/table/virtual-scrolling'
      },
      { name: 'Remote Data', nameKey: 'nav.tableRemoteData', href: '/table/remote-data' },
      { name: 'Live Updates', nameKey: 'nav.tableLiveUpdates', href: '/table/live-updates' },
      {
        name: 'Sticky Pinning',
        nameKey: 'nav.tableStickyPinning',
        href: '/table/sticky-pinning'
      },
      {
        name: 'Customization',
        nameKey: 'nav.tableCustomization',
        href: '/table/customization'
      },
      {
        name: 'Accessibility',
        nameKey: 'nav.tableAccessibility',
        href: '/table/accessibility'
      }
    ]
  },
  {
    name: 'Auth',
    nameKey: 'nav.auth',
    href: '/auth',
    children: [
      {
        name: 'Pages',
        group: true,
        children: [
          { name: 'LoginPage', href: '/auth/components/login-page' },
          { name: 'RegisterPage', href: '/auth/components/register-page' },
          { name: 'ForgotPasswordPage', href: '/auth/components/forgot-password-page' },
          { name: 'ResetPasswordPage', href: '/auth/components/reset-password-page' },
          { name: 'VerifyEmailPage', href: '/auth/components/verify-email-page' }
        ]
      },
      {
        name: 'Management',
        group: true,
        children: [
          { name: 'InvitationManager', href: '/auth/components/invitation-manager' },
          { name: 'PasskeyManager', href: '/auth/components/passkey-manager' },
          { name: 'AccountSettings', href: '/auth/components/account-settings' },
          { name: 'SessionManager', href: '/auth/components/session-manager' },
          { name: 'TwoFactorManager', href: '/auth/components/two-factor-manager' }
        ]
      },
      {
        name: 'Notifications',
        group: true,
        children: [
          { name: 'NotificationCenter', href: '/auth/components/notification-center' },
          { name: 'NotificationBadge', href: '/auth/components/notification-badge' },
          { name: 'NotificationListener', href: '/auth/components/notification-listener' },
          { name: 'PushPermissionPrompt', href: '/auth/components/push-permission-prompt' }
        ]
      }
    ]
  },
  {
    name: 'Localization',
    nameKey: 'nav.i18n',
    href: '/i18n',
    children: [
      { name: 'Provider & SSR', nameKey: 'nav.i18nProvider', href: '/i18n/provider' },
      {
        name: 'Package Integration',
        nameKey: 'nav.i18nPackages',
        href: '/i18n/package-integration'
      },
      { name: 'Type Safety', nameKey: 'nav.i18nTypedKeys', href: '/i18n/typed-keys' },
      { name: 'Formatting & Plurals', nameKey: 'nav.i18nFormatting', href: '/i18n/formatting' },
      { name: 'Lazy Loading', nameKey: 'nav.i18nLazyLoading', href: '/i18n/lazy-loading' },
      { name: 'Locale Routing', nameKey: 'nav.i18nRouting', href: '/i18n/routing' }
    ]
  },
  {
    name: 'Icons',
    nameKey: 'nav.icons',
    href: '/icons'
  },
  {
    name: 'Customization',
    nameKey: 'nav.customization',
    href: '/customization',
    children: [
      { name: 'CSS Token Themes', nameKey: 'nav.cssTokenThemes', href: '/customization/themes' },
      {
        name: 'BlocksProvider',
        nameKey: 'nav.blocksProvider',
        href: '/customization/blocks-provider'
      },
      {
        name: 'Theme Builder',
        nameKey: 'nav.themeBuilder',
        href: '/customization/theme-builder'
      },
      { name: 'Design Tokens', nameKey: 'nav.designTokens', href: '/customization/tokens' },
      { name: 'Figma Tokens', nameKey: 'nav.figmaTokens', href: '/customization/figma-tokens' }
    ]
  },
  {
    name: 'Recipes',
    nameKey: 'nav.recipes',
    href: '/recipes',
    children: [
      { name: 'Clickable Card', href: '/recipes/clickable-card' },
      { name: 'Dashboard', nameKey: 'nav.dashboard', href: '/recipes/dashboard' },
      { name: 'Decision Tree Wizard', href: '/recipes/decision-tree-wizard' },
      { name: 'Help Tooltip', href: '/recipes/help-tooltip' },
      { name: 'Invitation-Gated Registration', href: '/recipes/auth-invitation-register' },
      { name: 'Login Form', nameKey: 'nav.loginForm', href: '/recipes/login' },
      { name: 'Meal Planner', href: '/recipes/meal-planner' },
      { name: 'Multi-Step Wizard', nameKey: 'nav.wizard', href: '/recipes/wizard' },
      {
        name: 'Notification Center',
        nameKey: 'nav.notificationCenter',
        href: '/recipes/notification-center'
      },
      { name: 'Onboarding Flow', href: '/recipes/onboarding-flow' },
      { name: 'Page Header', href: '/recipes/page-header' },
      { name: 'Passkey Login', href: '/recipes/auth-passkey-login' },
      { name: 'Password Reset Flow', href: '/recipes/auth-password-reset' },
      { name: 'Pricing Cards', nameKey: 'nav.pricingCards', href: '/recipes/pricing' },
      { name: 'Profile Card', nameKey: 'nav.profileCard', href: '/recipes/profile-card' },
      { name: 'Range Hint Input', href: '/recipes/range-hint-input' },
      { name: 'Settings Page', nameKey: 'nav.settingsPage', href: '/recipes/settings' },
      { name: 'Stat Tile', href: '/recipes/stat-tile' },
      { name: 'Trace Drawer', href: '/recipes/trace-drawer' },
      { name: 'Unsaved Changes Guard', href: '/recipes/unsaved-changes-guard' }
    ]
  },
  { name: 'Showcase', nameKey: 'nav.showcase', href: '/showcase' },
  { name: 'AI & DX', nameKey: 'nav.aiDx', href: '/ai' },
  {
    name: 'Doc Components',
    nameKey: 'nav.docComponents',
    href: '/docs',
    children: [
      {
        name: 'API Reference',
        nameKey: 'nav.apiReference',
        href: '/docs/components/api-reference'
      },
      { name: 'Code Example', nameKey: 'nav.codeExample', href: '/docs/components/code-example' },
      { name: 'Docs Layout', nameKey: 'nav.docsLayout', href: '/docs/components/docs-layout' },
      { name: 'Info Card', nameKey: 'nav.infoCard', href: '/docs/components/info-card' },
      {
        name: 'Playground Configurator',
        nameKey: 'nav.playgroundConfigurator',
        href: '/docs/components/playground-configurator'
      },
      { name: 'Section', nameKey: 'nav.section', href: '/docs/components/section' },
      {
        name: 'Table of Contents',
        nameKey: 'nav.tableOfContents',
        href: '/docs/components/table-of-contents'
      },
      {
        name: 'Types Reference',
        nameKey: 'nav.typesReference',
        href: '/docs/components/types-reference'
      }
    ]
  },
  { name: 'Changelog', nameKey: 'nav.changelog', href: '/changelog' }
];

export type { NavItem as NavigationItem };
