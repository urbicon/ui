import type { ComponentCatalogEntry, RecipeEntry } from '../data/catalog-loader.js';

const INTERNAL_COMPONENTS = new Set([
  'ApiReference',
  'CodeExample',
  'DocsLayout',
  'InfoCard',
  'PlaygroundConfigurator',
  'Section',
  'TableOfContents',
  'TypesReference'
]);

const TAG_ORDER = ['action', 'form', 'layout', 'feedback', 'navigation', 'display', 'data'];

const TAG_LABELS: Record<string, string> = {
  action: 'Actions',
  form: 'Forms',
  layout: 'Layout & Containers',
  feedback: 'Feedback & Status',
  navigation: 'Navigation',
  display: 'Display & Overlays',
  data: 'Data'
};

export function filterInternalComponents(
  components: ComponentCatalogEntry[]
): ComponentCatalogEntry[] {
  return components.filter((c) => !INTERNAL_COMPONENTS.has(c.name));
}

export function formatCompactCatalog(
  components: ComponentCatalogEntry[],
  options?: { recipes?: RecipeEntry[]; tags?: string[] }
): string {
  let filtered = filterInternalComponents(components);

  if (options?.tags && options.tags.length > 0) {
    const tagSet = new Set(options.tags.map((t) => t.toLowerCase()));
    filtered = filtered.filter((c) => c.tags.some((t) => tagSet.has(t.toLowerCase())));
  }

  const grouped = new Map<string, ComponentCatalogEntry[]>();
  const ungrouped: ComponentCatalogEntry[] = [];

  for (const comp of filtered) {
    const primaryTag = comp.tags[0];
    if (primaryTag && TAG_LABELS[primaryTag]) {
      const bucket = grouped.get(primaryTag);
      if (bucket) bucket.push(comp);
      else grouped.set(primaryTag, [comp]);
    } else {
      ungrouped.push(comp);
    }
  }

  let md = '# Urbicon UI Components\n\n';
  md += `> ${filtered.length} components available.\n`;
  md += '> For full API docs on any component: use `get_component` tool.\n\n';

  md += '## Quick Setup\n\n';
  md += 'Install from npm:\n';
  md += '```bash\nbun add @urbicon-ui/blocks @urbicon-ui/i18n\n```\n';
  md +=
    'CSS setup (root layout or entry CSS) — your app owns the Tailwind import and it comes first:\n';
  md += '```css\n';
  md += "@import 'tailwindcss';\n";
  md +=
    "@import '@urbicon-ui/blocks/style/index.css'; /* tokens + @source directives — import this, NOT the foundation/semantic/interaction subfiles, and add no manual @source */\n";
  md += '```\n';
  md += "Import: `import { Button, Card } from '@urbicon-ui/blocks';` (always from package root)\n";
  md +=
    'Dark mode: automatic via the CSS `light-dark()` function (`:root` sets `color-scheme: light dark`, following the OS `prefers-color-scheme`) — semantic tokens switch automatically. For manual control, use `ThemeSwitcher` or add a `.light`/`.dark` class to `<html>`.\n\n';

  for (const tag of TAG_ORDER) {
    const comps = grouped.get(tag);
    if (!comps || comps.length === 0) continue;

    md += `## ${TAG_LABELS[tag]}\n`;
    for (const comp of comps) {
      md += formatComponentLine(comp);
    }
    md += '\n';
  }

  if (ungrouped.length > 0) {
    md += '## Other\n';
    for (const comp of ungrouped) {
      md += formatComponentLine(comp);
    }
    md += '\n';
  }

  if (options?.recipes && options.recipes.length > 0) {
    md += '## Recipes\n';
    md += '> Full production-ready code examples. Use `get_recipe` tool with the recipe id.\n';
    for (const recipe of options.recipes) {
      md += `- **${recipe.id}** — ${recipe.description} (${recipe.components.join(', ')})\n`;
    }
    md += '\n';
  }

  return md;
}

function isBooleanVariant(values: string[]): boolean {
  const sorted = [...values].sort();
  return (
    (sorted.length === 1 && (sorted[0] === 'true' || sorted[0] === 'false')) ||
    (sorted.length === 2 && sorted[0] === 'false' && sorted[1] === 'true')
  );
}

export function formatComponentLine(comp: ComponentCatalogEntry): string {
  const variants = comp.variants
    .filter((v) => !isBooleanVariant(v.values))
    .map((v) => `${v.name}: ${v.values.join('/')}`)
    .join(' · ');

  const related =
    comp.relatedComponents.length > 0 ? ` | Related: ${comp.relatedComponents.join(', ')}` : '';

  const pkg = comp.package !== '@urbicon-ui/blocks' ? ` _(from \`${comp.package}\`)_` : '';

  let line = `- **${comp.name}**${pkg} — ${comp.description}`;
  if (variants) line += ` | ${variants}`;
  line += related;
  line += '\n';

  return line;
}
