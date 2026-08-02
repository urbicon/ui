// Export all components from their new folder structure
//
// Every component exports, in this order: its props/slot types, the component
// itself, and its `*Variants` value. The variants values are part of the public
// surface on purpose — a consumer restyling a docs surface needs the same tv()
// object the component uses, and `*VariantProps` types without their values are
// only half an API.

export type { ApiProp, ApiReferenceProps, ApiReferenceSlots } from './ApiReference';
export { apiReferenceVariants, default as ApiReference } from './ApiReference';
export type {
  CodeExampleProps,
  CodeExampleSlotName,
  CodeExampleSlots,
  CodeExampleVariantProps
} from './CodeExample';
export { codeExampleVariants, default as CodeExample } from './CodeExample';
export type {
  CodePanelProps,
  CodePanelSlotName,
  CodePanelSlots,
  CodePanelVariantProps
} from './CodePanel';
export { codePanelVariants, default as CodePanel, LINE_NUMBER_AUTO_THRESHOLD } from './CodePanel';
export type {
  BreadcrumbItem,
  DocsLayoutProps,
  DocsLayoutSlots,
  DocsLayoutVariantProps
} from './DocsLayout';
export { default as DocsLayout, docsLayoutVariants, setDocsPageNav } from './DocsLayout';
export type { InfoCardProps, InfoCardSlots, InfoCardVariantProps } from './InfoCard';
export { default as InfoCard, infoCardVariants } from './InfoCard';
export type {
  CodeSetup,
  ControlOverride,
  DerivableComponentData,
  DeriveControlsOptions,
  PlaygroundConfiguratorProps,
  PlaygroundConfiguratorSlots,
  PlaygroundConfiguratorVariantProps,
  RawCode
} from './PlaygroundConfigurator';
export {
  default as PlaygroundConfigurator,
  defaultValuesOf,
  deriveControls,
  extractPlaygroundDocs,
  generateDefaultCode,
  // For the playgrounds whose snippet is a *shape* the generator cannot build —
  // ChatMessage prints an `{#each}` over a thread. They still print the very
  // objects the stage renders instead of a hand-typed copy, which is the point.
  serializeValue
} from './PlaygroundConfigurator';
export { playgroundConfiguratorVariants } from './PlaygroundConfigurator/playground-configurator.variants';
export type { SectionProps, SectionSlots, SectionVariantProps } from './Section';
export { Section, sectionVariants } from './Section';
// Export all types from each component
export type {
  RelatedLink,
  TableOfContentsProps,
  TableOfContentsSlots,
  TableOfContentsVariantProps,
  TocNavigationItem
} from './TableOfContents';
export { default as TableOfContents, tableOfContentsVariants } from './TableOfContents';
export type {
  LocalTypeDef,
  TypesReferenceProps,
  TypesReferenceSlots,
  TypesReferenceVariantProps,
  TypeUsedByRef
} from './TypesReference';
export { default as TypesReference, extractLiteralValues } from './TypesReference';
export { typesReferenceVariants } from './TypesReference/types-reference.variants';
