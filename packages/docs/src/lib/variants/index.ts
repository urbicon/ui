// === DOCS VARIANTS INDEX ===
// Most variants have moved to their respective component folders.
// This file now contains shared types and convenience re-exports.

// === TYPE HELPERS ===
export type DocsIntent = 'example' | 'playground' | 'api' | 'code' | 'neutral';
export type DocsSize = 'sm' | 'md' | 'lg' | 'xl';
export type DocsVariant = 'default' | 'elevated' | 'outlined' | 'ghost';

export { type ApiReferenceVariantProps, apiReferenceVariants } from '../components/ApiReference';
// === COMPONENT RE-EXPORTS ===
// For backward compatibility, re-export variants from components
export { type CodeExampleVariantProps, codeExampleVariants } from '../components/CodeExample';
export { type DocsLayoutVariantProps, docsLayoutVariants } from '../components/DocsLayout';
export { type InfoCardVariantProps, infoCardVariants } from '../components/InfoCard';
export { type SectionVariantProps, sectionVariants } from '../components/Section';
export {
  type TableOfContentsVariantProps,
  tableOfContentsVariants
} from '../components/TableOfContents';
