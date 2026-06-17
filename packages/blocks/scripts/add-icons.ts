/**
 * Batch-add icons: creates SVG files, Svelte components, and updates registry.
 * Usage: define icons array below, then run `bun run scripts/add-icons.ts`
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const iconsDir = join(import.meta.dir, '../src/lib/icons');
const svgDir = join(iconsDir, 'svg');

interface IconDef {
  /** camelCase name used in code (e.g. 'zoomIn') */
  name: string;
  /** Human-readable label */
  label: string;
  /** Icon categories */
  categories: string[];
  /** Search keywords */
  keywords: string[];
  /** Inner SVG geometry (paths, circles, etc.) — no <svg> wrapper */
  svg: string;
}

function toPascalCase(s: string): string {
  return s.replace(/(^|-)(\w)/g, (_, _p, c) => c.toUpperCase());
}

function toKebabCase(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

const SVG_WRAPPER_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;

// ─── ICON DEFINITIONS ───────────────────────────────────────────────

const icons: IconDef[] = [
  {
    name: 'minimize',
    label: 'Minimize',
    categories: ['layout'],
    keywords: ['shrink', 'collapse', 'reduce', 'resize'],
    svg: `<path d="M4 14.5h5.5V20" />
  <path d="M20 9.5h-5.5V4" />
  <path d="M14.5 9.5L21 3" />
  <path d="M9.5 14.5L3 21" />`
  },
  {
    name: 'volume',
    label: 'Volume',
    categories: ['media'],
    keywords: ['sound', 'audio', 'speaker', 'loud'],
    svg: `<path d="M3.5 9h3l5-4.5v15L6.5 15h-3V9z" />
  <path d="M15.5 8.5a4 4 0 0 1 0 7" />
  <path d="M18 6a8 8 0 0 1 0 12" />`
  },
  {
    name: 'volumeOff',
    label: 'Volume Off',
    categories: ['media', 'toggle'],
    keywords: ['mute', 'silent', 'sound', 'speaker'],
    svg: `<path d="M3.5 9h3l5-4.5v15L6.5 15h-3V9z" />
  <path d="M16 9.5l5 5" />
  <path d="M21 9.5l-5 5" />`
  },
  {
    name: 'video',
    label: 'Video',
    categories: ['media'],
    keywords: ['camera', 'film', 'record', 'movie'],
    svg: `<rect x="2.5" y="5.5" width="13" height="13" rx="2" />
  <path d="M15.5 10l5.5-3v10l-5.5-3" />`
  },
  {
    name: 'videoOff',
    label: 'Video Off',
    categories: ['media', 'toggle'],
    keywords: ['camera', 'disabled', 'muted', 'off'],
    svg: `<rect x="2.5" y="5.5" width="13" height="13" rx="2" />
  <path d="M15.5 10l5.5-3v10l-5.5-3" />
  <path d="M3 3l18 18" />`
  },
  {
    name: 'bold',
    label: 'Bold',
    categories: ['action'],
    keywords: ['text', 'format', 'strong', 'weight'],
    svg: `<path d="M7 4.5h5a4 4 0 0 1 0 7.5H7z" />
  <path d="M7 12h6a4 4 0 0 1 0 7.5H7z" />
  <path d="M7 4.5v15" />`
  },
  {
    name: 'italic',
    label: 'Italic',
    categories: ['action'],
    keywords: ['text', 'format', 'slant', 'emphasis'],
    svg: `<path d="M11 4.5h6" />
  <path d="M7 19.5h6" />
  <path d="M14 4.5l-4 15" />`
  },
  {
    name: 'underline',
    label: 'Underline',
    categories: ['action'],
    keywords: ['text', 'format', 'decoration'],
    svg: `<path d="M7 4.5v8a5 5 0 0 0 10 0v-8" />
  <path d="M5.5 20.5h13" />`
  },
  {
    name: 'alignLeft',
    label: 'Align Left',
    categories: ['action'],
    keywords: ['text', 'paragraph', 'format', 'left'],
    svg: `<path d="M4 6.5h16" />
  <path d="M4 10.5h10" />
  <path d="M4 14.5h14" />
  <path d="M4 18.5h8" />`
  },
  {
    name: 'alignCenter',
    label: 'Align Center',
    categories: ['action'],
    keywords: ['text', 'paragraph', 'format', 'center'],
    svg: `<path d="M4 6.5h16" />
  <path d="M7 10.5h10" />
  <path d="M5 14.5h14" />
  <path d="M8 18.5h8" />`
  },
  {
    name: 'alignRight',
    label: 'Align Right',
    categories: ['action'],
    keywords: ['text', 'paragraph', 'format', 'right'],
    svg: `<path d="M4 6.5h16" />
  <path d="M10 10.5h10" />
  <path d="M6 14.5h14" />
  <path d="M12 18.5h8" />`
  },
  {
    name: 'list',
    label: 'List',
    categories: ['action'],
    keywords: ['bullet', 'unordered', 'items', 'menu'],
    svg: `<path d="M9 6.5h11" />
  <path d="M9 12h11" />
  <path d="M9 17.5h11" />
  <circle cx="5" cy="6.5" r="1" />
  <circle cx="5" cy="12" r="1" />
  <circle cx="5" cy="17.5" r="1" />`
  },
  {
    name: 'listOrdered',
    label: 'List Ordered',
    categories: ['action'],
    keywords: ['numbered', 'ordered', 'items', 'sequence'],
    svg: `<path d="M10.5 6.5h9.5" />
  <path d="M10.5 12h9.5" />
  <path d="M10.5 17.5h9.5" />
  <rect x="4" y="4.5" width="3" height="3" rx="0.5" />
  <rect x="4" y="10" width="3" height="3" rx="0.5" />
  <rect x="4" y="15.5" width="3" height="3" rx="0.5" />`
  },
  {
    name: 'chevronsLeft',
    label: 'Chevrons Left',
    categories: ['navigation'],
    keywords: ['first', 'start', 'back', 'rewind'],
    svg: `<path d="M13 7l-5 5 5 5" />
  <path d="M18 7l-5 5 5 5" />`
  },
  {
    name: 'chevronsRight',
    label: 'Chevrons Right',
    categories: ['navigation'],
    keywords: ['last', 'end', 'forward', 'skip'],
    svg: `<path d="M11 7l5 5-5 5" />
  <path d="M6 7l5 5-5 5" />`
  },
  {
    name: 'arrowUpRight',
    label: 'Arrow Up Right',
    categories: ['navigation'],
    keywords: ['diagonal', 'direction', 'external', 'northeast'],
    svg: `<path d="M7.5 16.5l9-9" />
  <path d="M10 7.5h7v7" />`
  },
  {
    name: 'panelLeft',
    label: 'Panel Left',
    categories: ['layout'],
    keywords: ['sidebar', 'drawer', 'split', 'pane'],
    svg: `<rect x="3.5" y="3.5" width="17" height="17" rx="2" />
  <path d="M9.5 3.5v17" />`
  },
  {
    name: 'panelRight',
    label: 'Panel Right',
    categories: ['layout'],
    keywords: ['sidebar', 'drawer', 'split', 'pane'],
    svg: `<rect x="3.5" y="3.5" width="17" height="17" rx="2" />
  <path d="M14.5 3.5v17" />`
  },
  {
    name: 'shoppingCart',
    label: 'Shopping Cart',
    categories: ['action'],
    keywords: ['cart', 'buy', 'purchase', 'ecommerce'],
    svg: `<circle cx="9.5" cy="20.5" r="1.5" />
  <circle cx="18" cy="20.5" r="1.5" />
  <path d="M2.5 3.5h3l2 10.5h10.5l2.5-7.5H7" />`
  },
  {
    name: 'creditCard',
    label: 'Credit Card',
    categories: ['action'],
    keywords: ['payment', 'card', 'finance', 'stripe'],
    svg: `<rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
  <path d="M2.5 9.5h19" />
  <path d="M6 15.5h4" />`
  },
  {
    name: 'wallet',
    label: 'Wallet',
    categories: ['action'],
    keywords: ['money', 'payment', 'finance', 'purse'],
    svg: `<rect x="3" y="5" width="18" height="14" rx="2.5" />
  <path d="M3 9.5h18" />
  <circle cx="17.5" cy="14" r="1" />`
  },
  {
    name: 'package',
    label: 'Package',
    categories: ['action'],
    keywords: ['box', 'shipping', 'delivery', 'parcel'],
    svg: `<path d="M12 3.5l-8 4.5v8l8 4.5 8-4.5v-8z" />
  <path d="M4 8l8 4.5 8-4.5" />
  <path d="M12 12.5v8" />`
  },
  {
    name: 'truck',
    label: 'Truck',
    categories: ['action'],
    keywords: ['delivery', 'shipping', 'transport', 'vehicle'],
    svg: `<rect x="2.5" y="4.5" width="12" height="11" rx="1.5" />
  <path d="M14.5 9h4l3 4v2.5h-7" />
  <circle cx="7" cy="18" r="2" />
  <circle cx="18.5" cy="18" r="2" />`
  },
  {
    name: 'gift',
    label: 'Gift',
    categories: ['action'],
    keywords: ['present', 'reward', 'bonus', 'prize'],
    svg: `<rect x="3.5" y="9" width="17" height="12.5" rx="1.5" />
  <path d="M12 9v12.5" />
  <path d="M3.5 13h17" />
  <path d="M7.5 9c0-3 4.5-3 4.5 0" />
  <path d="M16.5 9c0-3-4.5-3-4.5 0" />`
  },
  {
    name: 'server',
    label: 'Server',
    categories: ['data'],
    keywords: ['host', 'backend', 'infrastructure', 'rack'],
    svg: `<rect x="3.5" y="2.5" width="17" height="7" rx="1.5" />
  <rect x="3.5" y="14.5" width="17" height="7" rx="1.5" />
  <circle cx="7" cy="6" r="1" />
  <circle cx="7" cy="18" r="1" />`
  },
  {
    name: 'laptop',
    label: 'Laptop',
    categories: ['media'],
    keywords: ['computer', 'device', 'notebook', 'screen'],
    svg: `<rect x="4" y="4" width="16" height="11" rx="2" />
  <path d="M2 19.5h20" />`
  },
  {
    name: 'qrCode',
    label: 'QR Code',
    categories: ['data'],
    keywords: ['scan', 'barcode', 'link', 'code'],
    svg: `<rect x="3.5" y="3.5" width="6" height="6" rx="1" />
  <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
  <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
  <rect x="14.5" y="14.5" width="3" height="3" rx="0.5" />
  <rect x="17.5" y="17.5" width="3" height="3" rx="0.5" />
  <path d="M14.5 14.5h3v3" />`
  },
  {
    name: 'palette',
    label: 'Palette',
    categories: ['media'],
    keywords: ['color', 'design', 'theme', 'paint'],
    svg: `<circle cx="12" cy="12" r="9.5" />
  <circle cx="8.5" cy="8" r="1.5" />
  <circle cx="13.5" cy="6.5" r="1.5" />
  <circle cx="17" cy="10.5" r="1.5" />
  <circle cx="8" cy="13" r="1.5" />`
  },
  {
    name: 'wrench',
    label: 'Wrench',
    categories: ['action'],
    keywords: ['tool', 'settings', 'fix', 'maintenance'],
    svg: `<path d="M14.5 3.5a5.5 5.5 0 0 0-4 7.5L4 17.5a2.5 2.5 0 1 0 3.5 3.5l6.5-6.5a5.5 5.5 0 0 0 7.5-4" />
  <path d="M17 3.5L14 6.5" />`
  },
  {
    name: 'bug',
    label: 'Bug',
    categories: ['data'],
    keywords: ['error', 'issue', 'debug', 'insect'],
    svg: `<rect x="7.5" y="8" width="9" height="10" rx="4.5" />
  <path d="M12 8v10" />
  <path d="M9 6a3 3 0 0 1 6 0" />
  <path d="M4 9l3.5 2" />
  <path d="M20 9l-3.5 2" />
  <path d="M4 15l3.5-1" />
  <path d="M20 15l-3.5-1" />`
  },
  {
    name: 'gitBranch',
    label: 'Git Branch',
    categories: ['data'],
    keywords: ['version', 'branch', 'merge', 'repository'],
    svg: `<circle cx="6" cy="6" r="2.5" />
  <circle cx="18" cy="18" r="2.5" />
  <circle cx="6" cy="18" r="2.5" />
  <path d="M6 8.5v7" />
  <path d="M6 8.5c0 8 12 4 12 7" />`
  },
  {
    name: 'lightbulb',
    label: 'Lightbulb',
    categories: ['status'],
    keywords: ['idea', 'tip', 'hint', 'suggestion'],
    svg: `<path d="M9 18h6" />
  <path d="M10 21h4" />
  <path d="M12 2.5a7 7 0 0 0-4 12.5c.5.5.5 1.5.5 3h7c0-1.5 0-2.5.5-3A7 7 0 0 0 12 2.5z" />`
  },
  {
    name: 'target',
    label: 'Target',
    categories: ['data'],
    keywords: ['goal', 'aim', 'focus', 'bullseye'],
    svg: `<circle cx="12" cy="12" r="9.5" />
  <circle cx="12" cy="12" r="6" />
  <circle cx="12" cy="12" r="2.5" />`
  },
  {
    name: 'pieChart',
    label: 'Pie Chart',
    categories: ['data'],
    keywords: ['analytics', 'graph', 'statistics', 'chart'],
    svg: `<circle cx="12" cy="12" r="9.5" />
  <path d="M12 12V2.5" />
  <path d="M12 12l6.5 7" />`
  },
  {
    name: 'archive',
    label: 'Archive',
    categories: ['action'],
    keywords: ['storage', 'box', 'save', 'organize'],
    svg: `<rect x="3.5" y="3.5" width="17" height="4" rx="1" />
  <path d="M4.5 7.5v12a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-12" />
  <path d="M10 12.5h4" />`
  },
  {
    name: 'inbox',
    label: 'Inbox',
    categories: ['communication'],
    keywords: ['mail', 'tray', 'messages', 'receive'],
    svg: `<rect x="3.5" y="3.5" width="17" height="17" rx="2" />
  <path d="M3.5 15.5h4.5l2 2.5h4l2-2.5h4.5" />`
  },
  {
    name: 'headphones',
    label: 'Headphones',
    categories: ['media'],
    keywords: ['audio', 'music', 'listen', 'earphones'],
    svg: `<path d="M5 13a7 7 0 0 1 14 0" />
  <rect x="3" y="12.5" width="3" height="7" rx="1.5" />
  <rect x="18" y="12.5" width="3" height="7" rx="1.5" />`
  },
  {
    name: 'scissors',
    label: 'Scissors',
    categories: ['action'],
    keywords: ['cut', 'trim', 'clip', 'snip'],
    svg: `<circle cx="6.5" cy="6.5" r="2.5" />
  <circle cx="6.5" cy="17.5" r="2.5" />
  <path d="M8.5 8.5l12 4" />
  <path d="M8.5 15.5l12-4" />`
  },
  {
    name: 'circle',
    label: 'Circle',
    categories: ['layout'],
    keywords: ['shape', 'dot', 'record', 'round'],
    svg: `<circle cx="12" cy="12" r="9.5" />`
  }
];

// ─── GENERATION ─────────────────────────────────────────────────────

await mkdir(svgDir, { recursive: true });

const registryPath = join(iconsDir, 'icon-registry.ts');
const typesPath = join(iconsDir, 'icon-types.ts');
const indexPath = join(iconsDir, 'index.ts');

let registryFile = await readFile(registryPath, 'utf-8');
let typesFile = await readFile(typesPath, 'utf-8');
let indexFile = await readFile(indexPath, 'utf-8');

for (const icon of icons) {
  const kebab = toKebabCase(icon.name);
  const pascal = toPascalCase(icon.name);
  const componentName = `${pascal}Icon`;
  const svgFileName = `${kebab}.svg`;

  // 1. Create SVG file
  const svgContent = `${SVG_WRAPPER_OPEN}\n  ${icon.svg
    .trim()
    .split('\n')
    .map((l) => (l.trimStart() ? l : l))
    .join('\n')}\n</svg>\n`;
  await writeFile(join(svgDir, svgFileName), svgContent);

  // 2. Create Svelte component
  const svelteContent = `<script lang="ts">
  import type { IconProps } from './icon-types';
  import IconWrapper from './IconWrapper.svelte';
  import content from './svg/${kebab}.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props} {content} />
`;
  await writeFile(join(iconsDir, `${componentName}.svelte`), svelteContent);

  // 3. Add icon import to icon-registry.ts (before the getIconOverrides import)
  const importLine = `import ${componentName} from './${componentName}.svelte';`;
  if (!registryFile.includes(importLine)) {
    registryFile = registryFile.replace(
      "import { getIconOverrides } from './icon.context';",
      `${importLine}\nimport { getIconOverrides } from './icon.context';`
    );
  }

  // 4. Add to the IconName union in icon-types.ts (before the closing semicolon)
  if (!typesFile.includes(`'${icon.name}'`)) {
    typesFile = typesFile.replace(
      /(\| '[^']+');\s*\n\nexport interface IconProps/,
      `$1\n  | '${icon.name}';\n\nexport interface IconProps`
    );
  }

  // 5. Add to DEFAULT_ICONS in icon-registry.ts (before closing brace+semicolon)
  if (!registryFile.includes(`${icon.name}: ${componentName}`)) {
    registryFile = registryFile.replace(
      /(\w+: \w+Icon),?\n};\n\nexport const ICON_METADATA/,
      `$1,\n  ${icon.name}: ${componentName},\n};\n\nexport const ICON_METADATA`
    );
  }

  // 6. Add to ICON_METADATA in icon-registry.ts (before the getIcon helper that follows it)
  const cats = icon.categories.map((c) => `'${c}'`).join(', ');
  const kws = icon.keywords.map((k) => `'${k}'`).join(', ');
  const metaEntry = `  ${icon.name}: {\n    label: '${icon.label}',\n    categories: [${cats}],\n    keywords: [${kws}]\n  },`;
  if (!registryFile.includes(`  ${icon.name}: {\n    label:`)) {
    registryFile = registryFile.replace(
      /},?\n};\n\n\/\*\*\n \* Resolve an icon by name from the built-in/,
      `},\n${metaEntry}\n};\n\n/**\n * Resolve an icon by name from the built-in`
    );
  }

  // 7. Add export to index.ts
  const exportLine = `export { default as ${componentName} } from './${componentName}.svelte';`;
  if (!indexFile.includes(exportLine)) {
    indexFile += `${exportLine}\n`;
  }

  console.log(`✓ ${componentName} → svg/${svgFileName}`);
}

await writeFile(registryPath, registryFile);
await writeFile(typesPath, typesFile);
await writeFile(indexPath, indexFile);

console.log(`\nAdded ${icons.length} icons.`);
