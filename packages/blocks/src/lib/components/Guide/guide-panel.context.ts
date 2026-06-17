import { createOptionalContext } from '$lib/utils';

/**
 * Context published by `GuidePanel` so child `GuideArticle`s can register
 * themselves for the list/navigation view. Optional — a `GuideArticle` used
 * outside a `GuidePanel` simply renders inert.
 */
export interface GuidePanelContext {
  /** Register an article (by title) and return an unregister cleanup. */
  registerArticle(id: string, title: string): () => void;
}

const [getGuidePanelContext, setGuidePanelContext] = createOptionalContext<GuidePanelContext>();

export { getGuidePanelContext, setGuidePanelContext };
