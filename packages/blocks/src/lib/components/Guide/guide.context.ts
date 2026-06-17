import { createOptionalContext, type GuideController } from '$lib/utils';

/**
 * Optional context for the Guide system. Surfaces read the controller via
 * {@link getGuideContext}; it returns `undefined` when no `GuideProvider` is
 * present, so a stray `GuideMarker` / `GuideHint` renders inert instead of
 * throwing `missing_context`. `GuideProvider` is opt-in, analogous to
 * `BlocksProvider` / `IconProvider`.
 */
const [getGuideContext, setGuideContext] = createOptionalContext<GuideController>();

export { getGuideContext, setGuideContext };
