import { dirname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..', '..');

export function getDataDir(): string {
  return process.env.DATA_DIR ?? resolve(packageRoot, '..', '..', 'apps', 'docs', 'static');
}

export function getTemplateDir(): string {
  return resolve(packageRoot, '..', 'docs-gen', 'templates');
}

export function getRecipeDir(): string {
  return resolve(packageRoot, '..', '..', 'apps', 'docs', 'src', 'routes', 'recipes');
}

export function getDesignSystemDir(): string {
  return process.env.DESIGN_SYSTEM_DIR ?? resolve(packageRoot, '..', '..', 'design-system');
}

export function getTemplatePath(): string {
  return resolve(getTemplateDir(), 'llms-full-template.md');
}

export function getCatalogPath(): string {
  return resolve(getDataDir(), 'mcp', 'component-catalog.json');
}

/** Validate that a slug contains only safe characters (lowercase alphanumeric + hyphens). */
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getComponentLlmPath(group: string, slug: string): string {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`Invalid component slug: "${slug}"`);
  }

  const resolved = resolve(getDataDir(), group, slug, 'llm.txt');
  const dataDir = normalize(getDataDir());

  if (!resolved.startsWith(dataDir)) {
    throw new Error(`Path traversal blocked for slug: "${slug}"`);
  }

  return resolved;
}
