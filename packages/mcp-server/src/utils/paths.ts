import { dirname, normalize, resolve, sep } from 'node:path';
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

/**
 * Root of the *consumer* project (the app being built with Urbicon UI), used by
 * the design-context tools. Unlike the loaders above — which read the library's
 * own shipped data — these tools read/write the consumer's `design.manifest.md`
 * and scan its source, so the default is the process cwd (the consumer's repo
 * when the server is launched from their editor). Override with env vars.
 */
export function getProjectDir(): string {
  return process.env.DESIGN_PROJECT_DIR ?? process.cwd();
}

export function getProjectManifestPath(): string {
  return process.env.DESIGN_MANIFEST_PATH ?? resolve(getProjectDir(), 'design.manifest.md');
}

export function getProjectSourceDir(): string {
  return process.env.DESIGN_SOURCE_DIR ?? resolve(getProjectDir(), 'src');
}

/**
 * Containment check for a caller-supplied manifest path. The write tools accept
 * an LLM-supplied `manifestPath`; restrict it to the project root so a model
 * cannot be steered into writing `.md` files elsewhere. (The user-configured
 * `DESIGN_MANIFEST_PATH` env default is trusted and not run through this.)
 */
export function isWithinProjectDir(targetPath: string): boolean {
  const resolved = resolve(targetPath);
  const projectDir = normalize(getProjectDir());
  return resolved === projectDir || resolved.startsWith(projectDir + sep);
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
