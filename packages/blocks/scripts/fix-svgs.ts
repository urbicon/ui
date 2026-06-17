/**
 * Fix SVG fragment files: strip everything except actual SVG geometry elements.
 * The extraction script captured too much content (script tags, svg wrapper).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const svgDir = join(import.meta.dir, '../src/lib/icons/svg');

const files = await readdir(svgDir);
const svgFiles = files.filter((f) => f.endsWith('.svg'));

let fixed = 0;

for (const file of svgFiles) {
  const content = await readFile(join(svgDir, file), 'utf-8');
  const lines = content.split('\n');

  // Find the line that is just ">" (closing the <svg> tag) and take everything after
  const closingIndex = lines.findIndex((line) => line.trim() === '>');

  if (closingIndex >= 0) {
    // Take everything after the ">" line, trim empty lines
    const geometry = lines
      .slice(closingIndex + 1)
      .join('\n')
      .trim();

    if (geometry) {
      await writeFile(join(svgDir, file), `${geometry}\n`);
      console.log(`✓ ${file}`);
      fixed++;
    } else {
      console.warn(`⚠ ${file}: no geometry found after ">" line`);
    }
  } else {
    // File might already be correct (just geometry)
    const trimmed = content.trim();
    if (
      trimmed.startsWith('<path') ||
      trimmed.startsWith('<circle') ||
      trimmed.startsWith('<rect') ||
      trimmed.startsWith('<line') ||
      trimmed.startsWith('<ellipse')
    ) {
      console.log(`✓ ${file} (already correct)`);
    } else {
      console.warn(`⚠ ${file}: could not parse`);
    }
  }
}

console.log(`\nFixed: ${fixed}/${svgFiles.length}`);
