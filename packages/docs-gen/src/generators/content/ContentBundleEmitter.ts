import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import {
  assertGuideSlug,
  assertNoPlaceholderLeft,
  COMPONENTS_PLACEHOLDER,
  GUIDE_PLACEHOLDER_PATTERN,
  guidePlaceholder,
  injectOverrideCascade,
  injectSemanticTokens,
  type PackageGuide,
  stripTypecheckMarkers
} from '../llm/guide-injection';
import { parseIconRegistry } from './icons';

/**
 * Collects the generated + authored design knowledge into the version-pinned
 * `@urbicon-ui/design-content` bundle (`packages/design-content/content/`). Runs
 * last in `docs:gen:all`, after the MCP catalog + per-component llm.txt have been
 * produced. The bundle is what the remote MCP server and the urbicon CLI read at
 * runtime — so it must be self-contained (no monorepo sibling paths). See
 * DESIGN-MCP-V2 §A.2.
 */
export interface ContentBundleEmitterConfig {
  /** `apps/docs/static` — the assembled catalog (`mcp/`) + per-component `llm.txt` tree. */
  staticDir: string;
  /** Repo-root `design-system/` — `principles.md` + `patterns/*.md`. */
  designSystemDir: string;
  /** `docs-gen/templates/llms-full-template.md` — backs the seven guide resources. */
  templatePath: string;
  /** `blocks/src/lib/icons/icon-registry.ts` — parsed into `icons.json`. */
  iconRegistryPath: string;
  /** `packages/design/skill/verbs` — the single-source verb recipes (DESIGN-MCP-V2 §8). */
  verbsDir: string;
  /**
   * Canonical package guides copied to `guides/<slug>.md` + indexed in
   * `guides/index.json` — the version-matched channel behind `urbicon guide`
   * and the MCP guide resources (docs/DOCS-SURFACES.md).
   */
  packageGuides: PackageGuide[];
  /** `packages/design-content/content` — the bundle output (cleaned + rewritten each run). */
  outputDir: string;
}

/**
 * Summary of an emitted content bundle — the counts the CLI prints after
 * `docs:gen:all` plus the version/hash stamped into the bundle's `meta.json`.
 */
export interface ContentBundleResult {
  /** The bundle directory that was (re)written. */
  outputDir: string;
  /** Per-component `llm.txt` files copied into the bundle. */
  llmTxtCount: number;
  /** Composition patterns (`design-system/patterns/*.md`) copied. */
  patternCount: number;
  /** Design-verb recipes copied (fail-loud when zero — every MCP prompt serves one). */
  verbCount: number;
  /** Package guides copied to `guides/<slug>.md` (fail-loud on a missing source). */
  guideCount: number;
  /** Icons parsed out of the blocks icon registry into `icons.json`. */
  iconCount: number;
  /** The `@urbicon-ui/design-content` package version the bundle ships under. */
  version: string;
  /**
   * First 12 hex chars of the catalog's SHA-256. Scoped to the catalog, not to
   * the bundle: of the 138 files emitted, only `component-catalog.json` reaches
   * this. Measured — a prop description that lands in
   * `blocks/components/planner/llm.txt` but not in the catalog leaves it
   * unmoved. Reproducible since the `generated` stamp came out of it, which is
   * what makes it worth stating how far it reaches.
   */
  contentHash: string;
}

/**
 * Emitter for the `@urbicon-ui/design-content` bundle (see the config
 * interface above for the why). Stateless besides its config; `emit()` does
 * all the work and is safe to re-run — the output directory is wiped first.
 */
export class ContentBundleEmitter {
  private config: ContentBundleEmitterConfig;

  constructor(config: ContentBundleEmitterConfig) {
    this.config = config;
  }

  /**
   * Rebuild the bundle from scratch: component catalog (required),
   * per-component llm.txt tree, design-system principles + patterns, verb
   * recipes, the llms-full guide template, parsed icon metadata, and a
   * `meta.json` stamp (package version + content hash). Every required input
   * fails loud with a message naming the missing piece — never a silently
   * thinner bundle.
   */
  async emit(): Promise<ContentBundleResult> {
    const {
      staticDir,
      designSystemDir,
      templatePath,
      iconRegistryPath,
      verbsDir,
      packageGuides,
      outputDir
    } = this.config;

    // Rebuild from scratch so a removed/renamed component leaves no stale llm.txt.
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });

    // 1. Component catalog — required (the emitter runs after the MCP catalog assembler).
    //    Dropped to the bundle root (the locator expects `content/component-catalog.json`).
    const catalogRaw = await this.readRequired(
      path.join(staticDir, 'mcp', 'component-catalog.json'),
      'component catalog (run docs:gen:all first)'
    );
    await fs.writeFile(path.join(outputDir, 'component-catalog.json'), catalogRaw, 'utf-8');

    // 2. Per-component llm.txt tree — preserve the `<group>/<slug>/llm.txt` layout the
    //    locator resolves. `**/llm.txt` matches only the per-component files (the manifests
    //    are named `llms.txt`, with an `s`).
    const llmFiles = await glob('**/llm.txt', { cwd: staticDir, absolute: false });
    for (const rel of llmFiles) {
      const dest = path.join(outputDir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(path.join(staticDir, rel), dest);
    }

    // 3. Design system — principles + patterns.
    const patternCount = await this.copyDesignSystem(
      designSystemDir,
      path.join(outputDir, 'design-system')
    );

    // 4. Verb recipes — the single-source design verbs (DESIGN-MCP-V2 §8), copied so
    //    the remote MCP prompts read the same text the local skill ships.
    const verbCount = await this.copyVerbs(verbsDir, path.join(outputDir, 'verbs'));

    // 5. Guide template. `{{GUIDE:<slug>}}` placeholders become pointers to the
    //    bundled guide file — the bundle carries each guide exactly once (5b),
    //    and the template's sections stay sliceable for the MCP guide resources.
    //    `{{OVERRIDE_CASCADE}}` and `{{SEMANTIC_TOKENS}}` are substituted here
    //    as in llms-full.txt, so the bundle copy the MCP guide resources slice
    //    carries the sentence and the token list, not the placeholders.
    //    `{{COMPONENTS}}` is the one placeholder that stays (see
    //    COMPONENTS_PLACEHOLDER).
    const template = await this.readRequired(templatePath, 'llms-full template');
    const bundledTemplate = injectSemanticTokens(
      injectOverrideCascade(
        this.pointGuidePlaceholders(template, packageGuides),
        'llms-full template'
      ),
      'llms-full template'
    );
    assertNoPlaceholderLeft(bundledTemplate, 'the bundled llms-full template', [
      COMPONENTS_PLACEHOLDER
    ]);
    await fs.mkdir(path.join(outputDir, 'guides'), { recursive: true });
    await fs.writeFile(
      path.join(outputDir, 'guides', 'llms-full-template.md'),
      bundledTemplate,
      'utf-8'
    );

    // 5b. Package guides — the canonical, tarball-shipped guide documents
    //     (docs/DOCS-SURFACES.md), copied verbatim + indexed for listings.
    const guideCount = await this.copyPackageGuides(packageGuides, path.join(outputDir, 'guides'));

    // 6. Icons — parsed from the registry source into JSON (the registry imports
    //    `.svelte`, so it can't be module-imported here; we parse the data blocks).
    const registry = await this.readRequired(iconRegistryPath, 'icon registry');
    const icons = parseIconRegistry(registry);
    await fs.writeFile(path.join(outputDir, 'icons.json'), JSON.stringify(icons, null, 2), 'utf-8');

    // 7. Meta — version stamp (DESIGN-MCP-V2 Anhang B) + a catalog fingerprint.
    const version = await this.readVersion(outputDir);
    // The catalog carries its own `generated` wall-clock stamp, so hashing it
    // whole yielded a fingerprint that could not reproduce — two runs of an
    // unchanged tree disagreed on it. That stamp describes the run, not the
    // content, and `builtAt` on the next line already says when. Parsed rather
    // than text-stripped so the hash does not depend on where in the document
    // the stamp sits or how it is spaced.
    const { generated: _generated, ...catalogContent } = JSON.parse(catalogRaw);
    const contentHash = createHash('sha256')
      .update(JSON.stringify(catalogContent))
      .digest('hex')
      .slice(0, 12);
    const meta = { version, builtAt: new Date().toISOString(), contentHash };
    await fs.writeFile(path.join(outputDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

    return {
      outputDir,
      llmTxtCount: llmFiles.length,
      patternCount,
      verbCount,
      guideCount,
      iconCount: icons.length,
      version,
      contentHash
    };
  }

  /**
   * Copy every configured package guide to `guides/<slug>.md` and write the
   * `guides/index.json` listing (`{ slug, title, description }[]`) that the
   * `urbicon guide` command and the MCP guide resources enumerate. A missing
   * source is a build error — a silently thinner bundle would strand the
   * version-matched channel on stale knowledge.
   */
  private async copyPackageGuides(guides: PackageGuide[], destDir: string): Promise<number> {
    await fs.mkdir(destDir, { recursive: true });
    for (const guide of guides) {
      assertGuideSlug(guide.slug);
      const content = await this.readRequired(
        guide.sourcePath,
        `package guide "${guide.title}" (${guide.slug})`
      );
      // the lint markers are a build instruction for the source, not guide content
      await fs.writeFile(
        path.join(destDir, `${guide.slug}.md`),
        stripTypecheckMarkers(content),
        'utf-8'
      );
    }
    const index = guides.map(({ slug, title, description }) => ({ slug, title, description }));
    await fs.writeFile(path.join(destDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
    return guides.length;
  }

  /**
   * Replace each `{{GUIDE:<slug>}}` in the bundled template copy with a
   * one-line pointer to the guide's own bundle file. A placeholder without a
   * configured guide is the template/config drift case — fail loud.
   */
  private pointGuidePlaceholders(template: string, guides: PackageGuide[]): string {
    for (const guide of guides) {
      const pointer = `> Bundled separately as \`guides/${guide.slug}.md\` — ${guide.description}`;
      template = template.replace(guidePlaceholder(guide.slug), () => pointer);
    }
    const leftover = GUIDE_PLACEHOLDER_PATTERN.exec(template);
    if (leftover) {
      throw new Error(`Content bundle: template references unconfigured guide "${leftover[1]}"`);
    }
    return template;
  }

  /**
   * Copy every `verbs/<name>.md` recipe into the bundle. Returns the verb count.
   * Fail-loud like `principles.md`: the verbs are load-bearing (every MCP prompt
   * serves one), so a missing or empty source dir is a build error, never a silent
   * zero-verb bundle.
   */
  private async copyVerbs(srcDir: string, destDir: string): Promise<number> {
    let verbFiles: string[];
    try {
      verbFiles = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.md'));
    } catch {
      throw new Error(`Content bundle: missing required verb-recipes dir at ${srcDir}`);
    }
    if (verbFiles.length === 0) {
      throw new Error(`Content bundle: no verb recipes (*.md) found in ${srcDir}`);
    }
    await fs.mkdir(destDir, { recursive: true });
    for (const file of verbFiles) {
      await fs.copyFile(path.join(srcDir, file), path.join(destDir, file));
    }
    return verbFiles.length;
  }

  /** Copy `principles.md` (required) + every `patterns/*.md`. Returns the pattern count. */
  private async copyDesignSystem(srcDir: string, destDir: string): Promise<number> {
    await fs.mkdir(path.join(destDir, 'patterns'), { recursive: true });

    const principles = await this.readRequired(
      path.join(srcDir, 'principles.md'),
      'design-system/principles.md'
    );
    await fs.writeFile(path.join(destDir, 'principles.md'), principles, 'utf-8');

    let patternFiles: string[] = [];
    try {
      patternFiles = (await fs.readdir(path.join(srcDir, 'patterns'))).filter((f) =>
        f.endsWith('.md')
      );
    } catch {
      patternFiles = [];
    }
    for (const file of patternFiles) {
      await fs.copyFile(path.join(srcDir, 'patterns', file), path.join(destDir, 'patterns', file));
    }
    return patternFiles.length;
  }

  /**
   * Read a file the bundle cannot ship without; any read failure becomes a
   * labelled build error (fail-loud — no partial bundles).
   */
  private async readRequired(file: string, label: string): Promise<string> {
    try {
      return await fs.readFile(file, 'utf-8');
    } catch {
      throw new Error(`Content bundle: missing required ${label} at ${file}`);
    }
  }

  /** The bundle ships in `@urbicon-ui/design-content`; that package's version is the bundle version. */
  private async readVersion(outputDir: string): Promise<string> {
    const pkgPath = path.join(outputDir, '..', 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  }
}
