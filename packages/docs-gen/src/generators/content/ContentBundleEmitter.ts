import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
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
  /** `packages/design-content/content` — the bundle output (cleaned + rewritten each run). */
  outputDir: string;
}

export interface ContentBundleResult {
  outputDir: string;
  llmTxtCount: number;
  patternCount: number;
  iconCount: number;
  version: string;
  contentHash: string;
}

export class ContentBundleEmitter {
  private config: ContentBundleEmitterConfig;

  constructor(config: ContentBundleEmitterConfig) {
    this.config = config;
  }

  async emit(): Promise<ContentBundleResult> {
    const { staticDir, designSystemDir, templatePath, iconRegistryPath, outputDir } = this.config;

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

    // 4. Guide template.
    const template = await this.readRequired(templatePath, 'llms-full template');
    await fs.mkdir(path.join(outputDir, 'guides'), { recursive: true });
    await fs.writeFile(path.join(outputDir, 'guides', 'llms-full-template.md'), template, 'utf-8');

    // 5. Icons — parsed from the registry source into JSON (the registry imports
    //    `.svelte`, so it can't be module-imported here; we parse the data blocks).
    const registry = await this.readRequired(iconRegistryPath, 'icon registry');
    const icons = parseIconRegistry(registry);
    await fs.writeFile(path.join(outputDir, 'icons.json'), JSON.stringify(icons, null, 2), 'utf-8');

    // 6. Meta — version stamp (DESIGN-MCP-V2 Anhang B) + a content fingerprint.
    const version = await this.readVersion(outputDir);
    const contentHash = createHash('sha256').update(catalogRaw).digest('hex').slice(0, 12);
    const meta = { version, builtAt: new Date().toISOString(), contentHash };
    await fs.writeFile(path.join(outputDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

    return {
      outputDir,
      llmTxtCount: llmFiles.length,
      patternCount,
      iconCount: icons.length,
      version,
      contentHash
    };
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
