import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import {
  GUIDE_PLACEHOLDER_PATTERN,
  guidePlaceholder,
  type PackageGuide,
  renderGuideForEmbedding
} from './guide-injection';

const PLACEHOLDER = '{{COMPONENTS}}';

export interface LlmsFullAssemblerConfig {
  templatePath: string;
  staticDirs: string[];
  outputPaths: string[];
  /**
   * Canonical package guides embedded via `{{GUIDE:<slug>}}` placeholders —
   * extraction from the tarball-shipped source instead of a hand-written
   * template section (docs/DOCS-SURFACES.md principle 2). Fail-loud in both
   * directions: a configured guide whose placeholder is gone, and a template
   * placeholder no guide covers, are build errors.
   */
  guides?: PackageGuide[];
}

/**
 * Assembles the llms-full.txt by combining a hand-curated template
 * with auto-generated per-component LLM docs from the static output directories
 * and the configured package guides ({@link PackageGuide}).
 */
export class LlmsFullAssembler {
  private config: LlmsFullAssemblerConfig;

  constructor(config: LlmsFullAssemblerConfig) {
    this.config = config;
  }

  async assemble(): Promise<{ outputPaths: string[]; componentCount: number }> {
    const template = await this.loadTemplate();
    const componentSections = await this.collectComponentSections();

    // Replacer functions throughout: string replacements would interpret `$`
    // patterns ($&, $`, $') inside the injected markdown as substitutions.
    let assembled = template.replace(PLACEHOLDER, () => componentSections.content);
    assembled = await this.injectGuides(assembled);

    for (const outputPath of this.config.outputPaths) {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, assembled, 'utf-8');
    }

    console.log(
      `📝 llms-full.txt assembled: ${componentSections.count} components → ${this.config.outputPaths.join(', ')}`
    );

    return { outputPaths: this.config.outputPaths, componentCount: componentSections.count };
  }

  private async loadTemplate(): Promise<string> {
    try {
      return await fs.readFile(this.config.templatePath, 'utf-8');
    } catch {
      throw new Error(`Template not found: ${this.config.templatePath}`);
    }
  }

  /**
   * Replace every `{{GUIDE:<slug>}}` with the embeddable form of its guide
   * source. Afterwards no guide placeholder may remain — a leftover means a
   * template edit and the guide config drifted apart, which must break the
   * build rather than ship a literal placeholder.
   */
  private async injectGuides(assembled: string): Promise<string> {
    for (const guide of this.config.guides ?? []) {
      const placeholder = guidePlaceholder(guide.slug);
      if (!assembled.includes(placeholder)) {
        throw new Error(
          `llms-full template is missing the ${placeholder} placeholder for guide "${guide.title}"`
        );
      }
      let source: string;
      try {
        source = await fs.readFile(guide.sourcePath, 'utf-8');
      } catch {
        throw new Error(`Guide source not found for "${guide.title}": ${guide.sourcePath}`);
      }
      const rendered = renderGuideForEmbedding(source);
      assembled = assembled.replace(placeholder, () => rendered);
    }

    const leftover = GUIDE_PLACEHOLDER_PATTERN.exec(assembled);
    if (leftover) {
      throw new Error(`llms-full template references unconfigured guide "${leftover[1]}"`);
    }
    return assembled;
  }

  private async collectComponentSections(): Promise<{ content: string; count: number }> {
    const allFiles: string[] = [];

    for (const dir of this.config.staticDirs) {
      try {
        // Sorted for the same reason as ComponentFinder's: unsorted since glob
        // v9, and this order is the order sections appear in llms-full.txt.
        const files = (await glob(path.join(dir, '**/llm.txt'), { absolute: true })).sort();
        allFiles.push(...files);
      } catch {
        console.warn(`⚠️  Could not read LLM files from ${dir}`);
      }
    }

    allFiles.sort((a, b) => {
      const nameA = path.basename(path.dirname(a));
      const nameB = path.basename(path.dirname(b));
      return nameA.localeCompare(nameB);
    });

    const sections: string[] = [];
    for (const file of allFiles) {
      try {
        const content = (await fs.readFile(file, 'utf-8')).trim();
        if (content) sections.push(content);
      } catch {
        console.warn(`⚠️  Could not read ${file}`);
      }
    }

    return { content: sections.join('\n\n'), count: sections.length };
  }
}
