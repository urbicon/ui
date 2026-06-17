/**
 * Navigation item
 */
export interface NavigationItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Navigation href/link */
  href?: string;
  /** Child navigation items */
  children?: NavigationItem[];
  /** Navigation metadata */
  metadata?: NavigationMetadata;
  /** Navigation state */
  state?: NavigationState;
}

/**
 * Navigation metadata
 */
export interface NavigationMetadata {
  /** Item type */
  type: 'section' | 'component' | 'group' | 'page' | 'external';
  /** Navigation level/depth (migrated from level property) */
  level?: number;
  /** Display order */
  order?: number;
  /** Associated tags */
  tags?: string[];
  /** Icon identifier */
  icon?: string;
  /** Badge information */
  badge?: NavigationBadge;
}

/**
 * Navigation state
 */
export interface NavigationState {
  /** Item is active/current */
  active?: boolean;
  /** Item is expanded (has visible children) */
  expanded?: boolean;
  /** Item is disabled */
  disabled?: boolean;
  /** Item is hidden */
  hidden?: boolean;
  /** Loading state */
  loading?: boolean;
}

/**
 * Navigation badge
 */
export interface NavigationBadge {
  /** Badge text */
  text: string;
  /** Badge intent/color */
  intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  /** Badge variant */
  variant?: 'filled' | 'outlined' | 'soft';
}

/**
 * Table of contents
 */
export interface TableOfContents {
  /** TOC items */
  items: TOCItem[];
  /** TOC settings */
  settings: TOCSettings;
}

/**
 * Table of contents item
 */
export interface TOCItem {
  /** Unique identifier */
  id: string;
  /** Item title */
  title: string;
  /** Heading level (1-6) */
  level: number;
  /** Anchor/fragment identifier */
  anchor: string;
  /** Child TOC items */
  children?: TOCItem[];
  /** Item section type */
  sectionType?: 'overview' | 'examples' | 'api' | 'patterns' | 'custom';
}

/**
 * TOC settings
 */
export interface TOCSettings {
  /** Maximum depth to show */
  maxDepth: number;
  /** Highlight active item */
  highlightActive?: boolean;
  /** Collapse behavior */
  collapsible?: boolean;
}

/**
 * Breadcrumb navigation
 */
export interface Breadcrumb {
  /** Breadcrumb items */
  items: BreadcrumbItem[];
  /** Breadcrumb settings */
  settings?: BreadcrumbSettings;
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /** Item label */
  label: string;
  /** Item href */
  href?: string;
  /** Item is current page */
  current?: boolean;
  /** Item icon */
  icon?: string;
}

/**
 * Breadcrumb settings
 */
export interface BreadcrumbSettings {
  /** Maximum items to show */
  maxItems?: number;
  /** Show home link */
  showHome?: boolean;
  /** Separator character/element */
  separator?: string;
  /** Collapse behavior */
  collapseThreshold?: number;
}

/**
 * Site navigation structure
 */
export interface SiteNavigation {
  /** Main navigation items */
  main: NavigationItem[];
  /** Footer navigation items */
  footer?: NavigationItem[];
  /** Utility navigation (user menu, etc.) */
  utility?: NavigationItem[];
  /** Mobile navigation settings */
  mobile?: {
    breakpoint?: number;
    hamburgerMenu?: boolean;
    collapsible?: boolean;
  };
}

/**
 * Navigation context for current page
 */
export interface NavigationContext {
  /** Current page */
  current: NavigationItem;
  /** Parent page (if any) */
  parent?: NavigationItem;
  /** Previous page in sequence */
  previous?: NavigationItem;
  /** Next page in sequence */
  next?: NavigationItem;
  /** Breadcrumb trail */
  breadcrumb: BreadcrumbItem[];
  /** Related pages */
  related?: NavigationItem[];
}

/**
 * Navigation search result
 */
export interface NavigationSearchResult {
  /** Matched navigation item */
  item: NavigationItem;
  /** Match score (0-1) */
  score: number;
  /** Matched text fragments */
  matches: SearchMatch[];
  /** Result metadata */
  metadata?: {
    searchTime?: number;
    resultType?: 'exact' | 'fuzzy' | 'partial';
  };
}

/**
 * Search match information
 */
export interface SearchMatch {
  /** Matched field */
  field: 'label' | 'description' | 'content' | 'tags';
  /** Matched text */
  text: string;
  /** Match indices */
  indices: [number, number][];
}
