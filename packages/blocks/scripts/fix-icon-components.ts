/**
 * Fix icon components: pass content as prop instead of {@html} snippet.
 * This fixes the SVG namespace issue where {@html} creates HTML elements
 * instead of SVG elements inside <svg> context.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const iconsDir = join(import.meta.dir, '../src/lib/icons');
const SKIP = ['IconProvider.svelte', 'IconWrapper.svelte', 'Icon.svelte'];

const files = await readdir(iconsDir);
const iconFiles = files.filter((f) => f.endsWith('.svelte') && !SKIP.includes(f));

let fixed = 0;

for (const file of iconFiles) {
  const content = await readFile(join(iconsDir, file), 'utf-8');

  // Replace the snippet pattern with prop pattern
  const newContent = content.replace(
    '<IconWrapper {...props}>\n  {@html content}\n</IconWrapper>',
    '<IconWrapper {...props} {content} />'
  );

  if (newContent !== content) {
    await writeFile(join(iconsDir, file), newContent);
    fixed++;
  }
}

console.log(`Fixed: ${fixed}/${iconFiles.length}`);
