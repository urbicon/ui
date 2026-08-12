import { createOptionalContext } from '$lib/utils/optional-context';
import type { ResourceTimelineContext } from './resource-timeline.types';

// Optional context so the getter can throw a descriptive error rather than
// Svelte's generic missing_context.
const [getResourceTimelineContextRaw, setResourceTimelineContext] =
  createOptionalContext<ResourceTimelineContext>();

export { setResourceTimelineContext };

/** Read the ResourceTimeline context. Throws if used outside a `<ResourceTimeline>`. */
export function getResourceTimelineContext(): ResourceTimelineContext {
  const ctx = getResourceTimelineContextRaw();
  if (!ctx) {
    throw new Error(
      'ResourceTimelineHeader and its siblings must be used inside a <ResourceTimeline>.'
    );
  }
  return ctx;
}
