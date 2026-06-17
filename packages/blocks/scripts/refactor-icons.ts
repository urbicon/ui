/**
 * Refactor icon components:
 * 1. Extract inner SVG content from each *Icon.svelte → svg/*.svg
 * 2. Rewrite each *Icon.svelte to use ?raw import + IconWrapper
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const iconsDir = join(import.meta.dir, '../src/lib/icons');
const svgDir = join(iconsDir, 'svg');

const SKIP_FILES = ['IconProvider.svelte', 'IconWrapper.svelte'];

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

const files = await readdir(iconsDir);
const iconFiles = files.filter((f) => f.endsWith('Icon.svelte') && !SKIP_FILES.includes(f));

let processed = 0;
const errors: string[] = [];

for (const file of iconFiles) {
  const content = await readFile(join(iconsDir, file), 'utf-8');

  // Extract inner SVG content: everything between the closing > of <svg ...> and </svg>
  const match = content.match(/>[\s]*\n([\s\S]*?)\n<\/svg>/);
  if (!match) {
    errors.push(file);
    continue;
  }

  // Clean up indentation (remove leading 2-space indent from each line)
  const innerContent = match[1]
    .split('\n')
    .map((line) => line.replace(/^ {2}/, ''))
    .join('\n')
    .trim();

  // Generate kebab-case SVG filename
  const baseName = file.replace('Icon.svelte', '');
  const kebabName = toKebabCase(baseName);

  // Write SVG fragment file
  await writeFile(join(svgDir, `${kebabName}.svg`), `${innerContent}\n`);

  // Rewrite the Svelte component
  const newContent = `<script lang="ts">
  import type { IconProps } from './icon.context';
  import IconWrapper from './IconWrapper.svelte';
  import content from './svg/${kebabName}.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props}>
  {@html content}
</IconWrapper>
`;

  await writeFile(join(iconsDir, file), newContent);
  processed++;
  console.log(`✓ ${file} → svg/${kebabName}.svg`);
}

console.log(`\nProcessed: ${processed}/${iconFiles.length}`);
if (errors.length) {
  console.log(`Errors: ${errors.join(', ')}`);
}
