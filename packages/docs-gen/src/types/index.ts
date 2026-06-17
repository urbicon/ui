// Core types

// Re-export shared core types for convenience so imports from "@/types" work
export type {
  ComponentInfo,
  ComponentStats,
  CrossReference,
  InheritanceInfo,
  PackageInfo,
  PropExample,
  PropInfo,
  PropSource,
  VariantExample,
  VariantInfo
} from '@urbicon-ui/shared-types';

// Configuration types
export * from './configuration';
export * from './core';

// Docs config helpers used by LLM (docsConfig extraction)
export * from './docs-config';
// Validation types
export * from './validation';
