import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import type { ComponentCatalogEntry } from '../mcp/MCPCatalogGenerator';
import { assertNoPlaceholderLeft, COMPONENTS_PLACEHOLDER } from './guide-injection';

/** The template placeholder the "Resources" link list is rendered into. */
const RESOURCES_PLACEHOLDER = '{{RESOURCES}}';

/** Preferred heading order for a package's `group` values; unlisted groups sort last. */
const GROUP_ORDER: Record<string, number> = { primitives: 0, components: 1, core: 2 };

/** A per-scope `llms.txt` (blocks/table/auth/docs) listed under "Resources". */
export interface LlmsAssemblerScope {
  /** Display label, e.g. `'Blocks'`. */
  label: string;
  /** URL segment the scope's static tree is served under (`<siteUrl>/<urlSegment>/…`). */
  urlSegment: string;
}

/**
 * A package whose catalog entries get one `- [Name](url): summary` line each,
 * grouped by `group` within the package.
 */
export interface LlmsAssemblerPackage extends LlmsAssemblerScope {
  /** The catalog's `package` field, e.g. `'@urbicon-ui/blocks'` — selects this package's entries. */
  packageId: string;
  /**
   * Absolute path to this package's generated static `llm.txt` tree
   * (`apps/docs/static/<pkg>`). The href for each entry is resolved by
   * globbing this tree rather than trusting the catalog's own `group` field —
   * `MCPCatalogGenerator` defaults a missing `group` to `'primitives'` for
   * catalog *display* purposes, which does not always match where the file
   * was actually written (`table`'s single entry has no group segment on
   * disk). The filesystem is the oracle, the same stance `hasDocPage` in
   * `APIDataGenerator` takes for doc-page links.
   */
  staticDir: string;
}

export interface LlmsAssemblerConfig {
  templatePath: string;
  /** Path to the assembled `component-catalog.json` (an `MCPCatalogAssembler` output). */
  catalogPath: string;
  /** Absolute site origin, e.g. `'https://ui.urbicon.de'` — every link is absolute. */
  siteUrl: string;
  outputPaths: string[];
  /** Every generated per-scope `llms.txt` to list under "Resources". */
  scopes: LlmsAssemblerScope[];
  /** The packages whose catalog entries render as component lines (blocks/table/auth). */
  packages: LlmsAssemblerPackage[];
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Assembles the root `llms.txt` (llmstxt.org shape) from a hand-written
 * template — title, summary, install — plus two generated sections: the
 * "Resources" link list and one `- [Name](url): summary` line per exported
 * component of `blocks`/`table`/`auth`, taken from the same
 * `component-catalog.json` `summary` field (`@summary`) that feeds the docs
 * site and the MCP server. Mirrors {@link LlmsFullAssembler}'s
 * template-plus-placeholder shape; `render()` is split out from `assemble()`
 * so `docs-gen llms-check` can diff the generated content against the
 * tracked file without writing anything.
 */
export class LlmsAssembler {
  private config: LlmsAssemblerConfig;

  constructor(config: LlmsAssemblerConfig) {
    this.config = config;
  }

  async assemble(): Promise<{ outputPaths: string[]; componentCount: number }> {
    const { content, count } = await this.render();

    for (const outputPath of this.config.outputPaths) {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, content, 'utf-8');
    }

    console.log(
      `📝 llms.txt assembled: ${count} components → ${this.config.outputPaths.join(', ')}`
    );

    return { outputPaths: this.config.outputPaths, componentCount: count };
  }

  /** Produces the assembled content without writing it — reused by `assemble()` and `llms-check`. */
  async render(): Promise<{ content: string; count: number }> {
    const template = await this.loadTemplate();
    const entries = await this.loadCatalog();
    const componentSections = await this.renderComponentSections(entries);

    let assembled = this.inject(template, RESOURCES_PLACEHOLDER, this.renderResources());
    assembled = this.inject(assembled, COMPONENTS_PLACEHOLDER, componentSections.content);
    assertNoPlaceholderLeft(assembled, 'llms.txt template');

    return { content: assembled, count: componentSections.count };
  }

  private inject(text: string, placeholder: string, value: string): string {
    if (!text.includes(placeholder)) {
      throw new Error(`llms.txt template is missing the ${placeholder} placeholder`);
    }
    // Replacer function, not a plain string: a `$`-pattern in the injected
    // value ($&, $`, $') would otherwise be read as a replacement token.
    return text.replace(placeholder, () => value);
  }

  private async loadTemplate(): Promise<string> {
    try {
      return await fs.readFile(this.config.templatePath, 'utf-8');
    } catch {
      throw new Error(`Template not found: ${this.config.templatePath}`);
    }
  }

  private async loadCatalog(): Promise<ComponentCatalogEntry[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.config.catalogPath, 'utf-8');
    } catch {
      throw new Error(
        `Component catalog not found: ${this.config.catalogPath} — run \`bun run docs:gen\` first.`
      );
    }
    const parsed = JSON.parse(raw) as { components?: ComponentCatalogEntry[] };
    return parsed.components ?? [];
  }

  private renderResources(): string {
    const lines: string[] = [];
    lines.push(
      `- [Documentation site](${this.config.siteUrl}): Live docs, playgrounds and recipes for every component`
    );
    lines.push(
      `- [Full API Reference](${this.config.siteUrl}/llms-full.txt): Complete component props, variants, tokens, and patterns for every component`
    );
    lines.push(
      `- [AI-native tooling](${this.config.siteUrl}/ai): The \`urbicon\` CLI — version-pinned component knowledge and a design-token linter for agents`
    );
    for (const scope of this.config.scopes) {
      lines.push(
        `- [${scope.label} — llms.txt](${this.config.siteUrl}/${scope.urlSegment}/llms.txt): Scope index`
      );
    }
    return lines.join('\n');
  }

  private async renderComponentSections(
    entries: ComponentCatalogEntry[]
  ): Promise<{ content: string; count: number }> {
    const sections: string[] = [];
    let count = 0;

    for (const pkg of this.config.packages) {
      const pkgEntries = entries.filter((e) => e.package === pkg.packageId);
      if (pkgEntries.length === 0) {
        throw new Error(
          `llms.txt: no catalog entries found for package "${pkg.packageId}" — is the component catalog stale?`
        );
      }

      const hrefBySlug = await this.resolveHrefs(pkg);

      const groups = [...new Set(pkgEntries.map((e) => e.group))].sort(
        (a, b) => (GROUP_ORDER[a] ?? 99) - (GROUP_ORDER[b] ?? 99)
      );

      for (const group of groups) {
        const heading =
          groups.length > 1 ? `## ${pkg.label} — ${capitalize(group)}` : `## ${pkg.label}`;
        const lines = [heading, ''];

        const groupEntries = pkgEntries
          .filter((e) => e.group === group)
          .sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of groupEntries) {
          if (!entry.summary) {
            throw new Error(`llms.txt: "${entry.name}" has no @summary in the component catalog`);
          }
          const href = hrefBySlug.get(entry.slug);
          if (!href) {
            throw new Error(
              `llms.txt: no llm.txt on disk for "${entry.name}" (slug "${entry.slug}") under ${pkg.staticDir}`
            );
          }
          const level =
            entry.stability && entry.stability !== 'stable' ? ` (${entry.stability})` : '';
          lines.push(`- [${entry.name}](${href}): ${entry.summary}${level}`);
          count++;
        }

        sections.push(lines.join('\n'));
      }
    }

    return { content: sections.join('\n\n'), count };
  }

  /**
   * Maps each entry's `slug` to its real, absolute link by globbing the
   * package's static tree — see {@link LlmsAssemblerPackage.staticDir}.
   */
  private async resolveHrefs(pkg: LlmsAssemblerPackage): Promise<Map<string, string>> {
    let files: string[];
    try {
      files = await glob(path.join(pkg.staticDir, '**/llm.txt'), { absolute: true });
    } catch {
      throw new Error(`llms.txt: could not read the static llm.txt tree at ${pkg.staticDir}`);
    }

    const map = new Map<string, string>();
    for (const file of files) {
      const slug = path.basename(path.dirname(file));
      const rel = path.relative(pkg.staticDir, file).split(path.sep).join('/');
      map.set(slug, `${this.config.siteUrl}/${pkg.urlSegment}/${rel}`);
    }
    return map;
  }
}
