/**
 * Component metadata (shared across all packages)
 */
export interface ComponentMetadata {
  version?: string;
  description: string;
  tags: string[];
  deprecated?: DeprecationInfo;
  experimental?: boolean;
  since?: string;
}

export interface DeprecationInfo {
  message: string;
  since: string;
  alternative?: string;
  removeIn?: string;
}

/**
 * Badge configuration (used in multiple packages)
 */
export interface ComponentBadge {
  label: string;
  intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  variant?: 'filled' | 'outlined' | 'soft';
}

/**
 * Section ordering concept
 */
export interface SectionOrder {
  id: string;
  order: number;
}

/**
 * Basic LLM configuration (shared between docs generators)
 */
export interface LLMConfig {
  include?: boolean;
  maxSections?: number;
  priority?: string[];
  excludeTypes?: string[];
  simplifyContent?: boolean;
}

// Re-export for backward compatibility
export type { DeprecationInfo as ComponentDeprecationInfo };
