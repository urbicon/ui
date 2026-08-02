export * from './components/index.js';
// The docs i18n surface: without it a consumer can neither add a locale nor
// translate a docs surface it composes itself.
export {
  type DocsTranslationKey,
  docsI18n,
  docsTranslations,
  getDocsLocales,
  hasDocsTranslation,
  useDocsI18n
} from './i18n/index.js';
export {
  type CodeVisibilityMode,
  CodeVisibilityStore,
  getCodeVisibilityContext,
  setCodeVisibilityContext
} from './stores/code-visibility.svelte.js';
export { ScrollSpy } from './stores/scroll-spy.svelte.js';
export { highlighterService } from './utils/highlighter.js';
