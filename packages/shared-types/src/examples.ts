/**
 * Component example definition
 */
export interface ComponentExample {
  /** Unique example identifier */
  id: string;
  /** Example title */
  title: string;
  /** Example description */
  description?: string;
  /** Example source code */
  code: string;
  /** Associated component name */
  component?: string;
  /** Include in LLM output */
  includeLLM?: boolean;
  /** Include in documentation */
  includeDocs?: boolean;
  /** Associated tags */
  tags?: string[];
}

/**
 * Usage pattern definition
 */
export interface UsagePattern {
  /** Unique pattern identifier */
  id: string;
  /** Pattern title */
  title: string;
  /** Pattern description */
  description: string;
  /** When to use this pattern */
  when: string;
  /** When to avoid this pattern */
  avoid: string;
  /** Example implementations */
  examples: string[];
  /** Related components */
  relatedComponents?: string[];
  /** Include in LLM output */
  includeLLM?: boolean;
}

/**
 * Example collection with grouping
 */
export interface ExampleCollection {
  /** Collection identifier */
  id: string;
  /** Collection title */
  title: string;
  /** Collection description */
  description?: string;
  /** Grouped examples */
  groups: ExampleGroup[];
}

/**
 * Example group within a collection
 */
export interface ExampleGroup {
  /** Group identifier */
  id: string;
  /** Group title */
  title: string;
  /** Group description */
  description?: string;
  /** Examples in this group */
  examples: ComponentExample[];
  /** Group order */
  order?: number;
}
