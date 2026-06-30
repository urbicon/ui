import { createOptionalContext } from '$lib/utils';

/**
 * Context published by `GuidePanel` so child `GuideArticle`s can register
 * themselves for the list/navigation view. Optional — a `GuideArticle` used
 * outside a `GuidePanel` simply renders inert.
 */
export interface GuidePanelContext {
  /**
   * Register an article (by title, with an optional `group` for the index's
   * section headers) and return an unregister cleanup.
   */
  registerArticle(id: string, title: string, group?: string): () => void;
  /**
   * Whether an article with this id is currently registered. Reactive — lets a
   * `GuideRef` degrade to plain text for an unknown article. Reads the registry
   * untracked-free so callers re-run when articles register/unregister.
   */
  hasArticle(id: string): boolean;
}

const [getGuidePanelContext, setGuidePanelContext] = createOptionalContext<GuidePanelContext>();

export { getGuidePanelContext, setGuidePanelContext };
