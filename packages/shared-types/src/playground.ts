/**
 * Playground configuration
 */
export interface PlaygroundConfig {
  /** Interactive controls */
  controls: ControlDefinition[];
  /** Code generator function */
  codeGenerator?: CodeGenerator | CodeGeneratorConfig;
  /** Default values for controls */
  defaultValues?: Record<string, unknown>;
  /** Playground examples/presets */
  examples?: PlaygroundExample[];
  /** Include in LLM output */
  includeLLM?: boolean;
  /** Playground metadata */
  metadata?: PlaygroundMetadata;
}

/**
 * Control definition for playground
 */
export interface ControlDefinition {
  /** Control identifier */
  key: string;
  /** Control label */
  label: string;
  /** Control type */
  type: ControlType;
  /** Control options (for select/dropdown) */
  items?: ControlOption[];
  /** Where this playground starts, and what "reset" returns to. */
  defaultValue?: unknown;
  /**
   * What the *component* does when the prop is omitted — which is not always
   * where the playground starts. A Table playground may open at
   * `itemsPerPage: 5` while the component defaults to 10; the reset dot follows
   * the former, the generated code snippet the latter, or it would print a
   * snippet that does not reproduce the preview above it.
   *
   * Set by `deriveControls` from the generated API. Absent means "same as
   * `defaultValue`".
   */
  componentDefault?: unknown;
  /**
   * This knob steers the demo, it is not a prop of the component — a scenario
   * switch that picks a payload, a "show marks" toggle that builds an array.
   * Such a control must never reach the generated snippet: `scenario="survey"`
   * would document an attribute that does not exist.
   *
   * Set by `deriveControls` for everything passed as `extra`.
   */
  demoOnly?: boolean;
  /** Minimum value (for number/range) */
  min?: number;
  /** Maximum value (for number/range) */
  max?: number;
  /** Step value (for number/range) */
  step?: number;
  /** Placeholder text (for text inputs) */
  placeholder?: string;
  /** Control description */
  description?: string;
  /** Control group/category */
  group?: string;
  /** Control visibility condition */
  condition?: ControlCondition;
}

/**
 * Control types
 */
export type ControlType =
  | 'dropdown'
  | 'select'
  | 'checkbox'
  | 'boolean'
  | 'text'
  | 'textarea'
  | 'number'
  | 'range'
  | 'slider'
  | 'color'
  | 'radio'
  | 'multi-select'
  | 'json'
  | 'code';

/**
 * Control option for select/dropdown controls
 */
export interface ControlOption {
  /** Option label */
  label: string;
  /** Option value */
  value: unknown;
  /** Option description */
  description?: string;
  /** Option group */
  group?: string;
  /** Option disabled state */
  disabled?: boolean;
}

/**
 * Control visibility condition
 */
export interface ControlCondition {
  /** Dependent control key. Optional when a custom `condition` function is provided. */
  dependsOn?: string;
  /** Expected value(s) */
  equals?: unknown;
  /** Value array (for 'in' condition) */
  in?: unknown[];
  /** Custom condition function */
  condition?: (values: Record<string, unknown>) => boolean;
}

/**
 * Code generator function type
 */
export type CodeGenerator = (values: Record<string, unknown>) => string;

/**
 * Code generator configuration
 */
export interface CodeGeneratorConfig {
  /** Template string or function */
  template: string | CodeGenerator;
  /** Template variables */
  variables?: Record<string, unknown>;
  /** Import statements */
  imports?: ImportStatement[];
  /** Code formatting options */
  formatting?: {
    language?: 'typescript' | 'javascript' | 'svelte' | 'react';
    prettier?: boolean;
    indentation?: number;
  };
}

/**
 * Import statement for generated code
 */
export interface ImportStatement {
  /** What to import */
  imports: string | string[] | Record<string, string>;
  /** From which module */
  from: string;
  /** Import type (default, named, namespace) */
  type?: 'default' | 'named' | 'namespace';
}

/**
 * Playground example/preset
 */
export interface PlaygroundExample {
  /** Example title */
  title: string;
  /** Example description */
  description?: string;
  /** Control values for this example */
  values: Record<string, unknown>;
  /** Example category */
  category?: 'basic' | 'advanced' | 'showcase' | 'use-case';
  /** Example tags */
  tags?: string[];
}

/**
 * Playground metadata
 */
export interface PlaygroundMetadata {
  /** Playground version */
  version?: string;
  /** Last updated */
  lastUpdated?: string;
  /** Playground features */
  features?: PlaygroundFeature[];
  /** Performance settings */
  performance?: {
    debounceMs?: number;
    lazyLoad?: boolean;
    cacheResults?: boolean;
  };
  /** Accessibility settings */
  accessibility?: {
    announceChanges?: boolean;
    keyboardNavigation?: boolean;
    focusManagement?: boolean;
  };
}

/**
 * Playground features
 */
export type PlaygroundFeature =
  | 'live-preview'
  | 'code-generation'
  | 'export-code'
  | 'share-link'
  | 'responsive-preview'
  | 'dark-mode'
  | 'accessibility-checker'
  | 'performance-monitor';
