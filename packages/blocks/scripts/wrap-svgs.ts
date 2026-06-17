/**
 * Wrap SVG fragments in proper <svg> root elements so they're valid,
 * renderable SVG files for IDE preview and other tools.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const svgDir = join(import.meta.dir, '../src/lib/icons/svg');
const SVG_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
const SVG_CLOSE = `</svg>`;

const files = await readdir(svgDir);
const svgFiles = files.filter((f) => f.endsWith('.svg'));

let wrapped = 0;

for (const file of svgFiles) {
  const content = (await readFile(join(svgDir, file), 'utf-8')).trim();

  // Skip if already wrapped
  if (content.startsWith('<svg')) continue;

  // Indent inner content by 2 spaces
  const indented = content
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  const wrapped_content = `${SVG_OPEN}\n${indented}\n${SVG_CLOSE}\n`;
  await writeFile(join(svgDir, file), wrapped_content);
  wrapped++;
}

console.log(`Wrapped: ${wrapped}/${svgFiles.length}`);
