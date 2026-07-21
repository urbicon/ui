import { readFile } from 'node:fs/promises';
import { getGuidePath } from '@urbicon-ui/design-content';

/**
 * Reader for the bundle's canonical package guides (`guides/<slug>.md`) — the
 * tarball-shipped guide documents (e.g. `packages/auth/docs/AUTH.md`) that
 * docs-gen distributes into the design-content bundle. Unlike the template
 * sections (template-loader.ts) these are complete documents, served verbatim.
 * Cached per process, like the template sections.
 */
const cachedGuides = new Map<string, string>();

/**
 * Load one bundled package guide by slug. `null` when the guide (or the
 * bundle) is absent — the resource read degrades to a "not found" note, the
 * same contract as a missing template section.
 */
export async function loadPackageGuide(slug: string): Promise<string | null> {
  const cached = cachedGuides.get(slug);
  if (cached !== undefined) return cached;

  try {
    const content = await readFile(getGuidePath(slug), 'utf-8');
    cachedGuides.set(slug, content);
    return content;
  } catch {
    return null;
  }
}
