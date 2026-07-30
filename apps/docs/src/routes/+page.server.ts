// Build-time facts for the landing page. The route is prerendered (global
// `prerender = true`), so this load runs once at build — the component
// catalogs and the size baseline never reach the client bundle; only the
// rows and counts are serialized. Sources and derivation: $lib/server/landing.
import { loadLandingCounts, loadLandingRows } from '$lib/server/landing';

export function load() {
  return { ...loadLandingRows(), counts: loadLandingCounts() };
}
