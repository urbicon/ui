// Export all components from their new folder structure

export type { ApiProp, ApiReferenceProps } from './ApiReference';
export { default as ApiReference } from './ApiReference';
export type { CodeExampleProps, CodeExampleVariantProps } from './CodeExample';
export { default as CodeExample } from './CodeExample';
export type { CodePanelProps, CodePanelSlotName, CodePanelVariantProps } from './CodePanel';
export { default as CodePanel } from './CodePanel';
export type { DocsLayoutProps, DocsLayoutVariantProps } from './DocsLayout';
export { default as DocsLayout, setDocsPageNav } from './DocsLayout';
export type { InfoCardProps, InfoCardVariantProps } from './InfoCard';
export { default as InfoCard } from './InfoCard';
export type {
  ControlOverride,
  DerivableComponentData,
  DeriveControlsOptions,
  PlaygroundConfiguratorProps,
  PlaygroundConfiguratorVariantProps
} from './PlaygroundConfigurator';
export {
  default as PlaygroundConfigurator,
  defaultValuesOf,
  deriveControls,
  extractPlaygroundDocs,
  // For the playgrounds whose snippet is a *shape* the generator cannot build —
  // ChatMessage prints an `{#each}` over a thread. They still print the very
  // objects the stage renders instead of a hand-typed copy, which is the point.
  serializeValue
} from './PlaygroundConfigurator';
export { playgroundConfiguratorVariants } from './PlaygroundConfigurator/playground-configurator.variants';
export type { SectionProps, SectionVariantProps } from './Section';
export { Section } from './Section';
// Export all types from each component
export type { TableOfContentsProps } from './TableOfContents';
export { default as TableOfContents } from './TableOfContents';
export type {
  LocalTypeDef,
  TypesReferenceProps,
  TypesReferenceVariantProps,
  TypeUsedByRef
} from './TypesReference';
export { default as TypesReference, extractLiteralValues } from './TypesReference';
export { typesReferenceVariants } from './TypesReference/types-reference.variants';
