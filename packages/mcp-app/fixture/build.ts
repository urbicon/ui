/**
 * The fixture's view, built the way an app builds its views: through
 * `@urbicon-ui/mcp-app/vite`, with Tailwind as the app's plugin and the
 * two-pass scan.
 */
import tailwindcss from '@tailwindcss/vite';
import { buildViews, type ViewBuild } from '@urbicon-ui/mcp-app/vite';
import type { Plugin } from 'vite';
import type { Sabotage } from './sabotage.ts';
import { BASE_META, BASE_PLACEHOLDER, FONTS_PATH, VIEWS } from './shared.ts';

const VIEWS_DIR = new URL('./views/', import.meta.url).pathname;

/** `__FIXTURE_SABOTAGE__` for the view — `''` in a green build. */
function sabotageFlag(name: string): Plugin {
  return {
    name: 'fixture:sabotage-flag',
    config: () => ({ define: { __FIXTURE_SABOTAGE__: JSON.stringify(name) } })
  };
}

export function buildFixture(outDir: string, sabotage?: Sabotage): Promise<ViewBuild> {
  return buildViews({
    root: VIEWS_DIR,
    outDir,
    views: Object.keys(VIEWS),
    plugins: [
      sabotageFlag(sabotage?.view ? sabotage.name : ''),
      tailwindcss(),
      ...(sabotage?.plugins?.() ?? [])
    ],
    base: { placeholder: BASE_PLACEHOLDER, meta: BASE_META, fonts: FONTS_PATH },
    tailwind: { css: `${VIEWS_DIR}app.css`, witness: 'bg-surface' }
  });
}
