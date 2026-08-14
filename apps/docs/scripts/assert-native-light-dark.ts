/**
 * Post-build guard: `light-dark()` must reach the browser unpolyfilled.
 *
 * The token system resolves `light-dark()` LATE — at the element that reads the
 * value, against the nearest `color-scheme`. That is what lets a dark house sit
 * in a light page (`liveries.css`, `livery-shim.gen.css`) and what the
 * Customization → Scoped Themes note promises to consumers.
 *
 * Lightning CSS breaks that promise silently. Vite 8 minifies CSS with it by
 * default (`build.cssMinify: 'lightningcss'`; Vite 5–7 used esbuild, which never
 * touched this), and against a CSS target below Safari 17.5 it downlevels
 * `light-dark(a, b)` to `var(--lightningcss-light, a) var(--lightningcss-dark, b)`.
 * Guard substitution happens where the custom property is DECLARED, so every
 * `:root` token freezes to the root's scheme and inherits already-resolved — a
 * container's own `color-scheme` can no longer move it.
 *
 * It cost a full investigation to find, because it shows up in NONE of the
 * places you look first: the dev server is unaffected (no minification), the
 * dark mode is unaffected (the frozen branch is the right one there), and only a
 * dark scope inside a light page renders wrong. On ui.urbicon.de it painted the
 * A2UI commit button's label near-black on Duna's dark brown, with
 * `color-scheme: dark` sitting right there in the computed styles.
 *
 * `vite.config.ts` pins `build.cssTarget` to keep it native. This asks the built
 * CSS whether that actually held — the artifact, not the config.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;
/** The guard variable Lightning CSS emits for a downlevelled `light-dark()`. */
const MARKER = '--lightningcss-';

async function cssFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await cssFiles(path)));
    else if (entry.name.endsWith('.css')) found.push(path);
  }
  return found;
}

const files = await cssFiles(DIST).catch(() => {
  console.error(`assert-native-light-dark: no build to check — ${DIST} does not exist.`);
  process.exit(1);
});

// A guard that finds nothing because it LOOKED at nothing is worse than none:
// it reports green for the wrong reason. The build always emits stylesheets.
if (files.length === 0) {
  console.error(
    'assert-native-light-dark: found no .css in the build output — the check never ran.'
  );
  process.exit(1);
}

const hits: string[] = [];
for (const file of files) {
  const css = await Bun.file(file).text();
  if (css.includes(MARKER)) hits.push(file.slice(DIST.length + 1));
}

if (hits.length > 0) {
  console.error(
    `assert-native-light-dark: light-dark() was downlevelled in ${hits.length} of ${files.length} stylesheet(s):\n` +
      hits.map((f) => `  ${f}`).join('\n') +
      '\n\nEvery scoped theme now resolves against the declaring element instead of the\n' +
      'reading one — a dark scope in a light page will render light colours.\n' +
      'Fix: raise `build.cssTarget` in apps/docs/vite.config.ts to versions with native\n' +
      '`light-dark()` (chrome123, edge123, firefox120, safari17.5).'
  );
  process.exit(1);
}

console.log(`assert-native-light-dark: ${files.length} stylesheets, light-dark() native in all.`);
