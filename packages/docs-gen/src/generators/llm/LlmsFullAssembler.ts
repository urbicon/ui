import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';

const PLACEHOLDER = '{{COMPONENTS}}';

export interface LlmsFullAssemblerConfig {
  templatePath: string;
  staticDirs: string[];
  outputPaths: string[];
}

/**
 * Assembles the llms-full.txt by combining a hand-curated template
 * with auto-generated per-component LLM docs from the static output directories.
 */
export class LlmsFullAssembler {
  private config: LlmsFullAssemblerConfig;

  constructor(config: LlmsFullAssemblerConfig) {
    this.config = config;
  }

  async assemble(): Promise<{ outputPaths: string[]; componentCount: number }> {
    const template = await this.loadTemplate();
    const componentSections = await this.collectComponentSections();

    const assembled = template.replace(PLACEHOLDER, componentSections.content);

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

  private async collectComponentSections(): Promise<{ content: string; count: number }> {
    const allFiles: string[] = [];

    for (const dir of this.config.staticDirs) {
      try {
        const files = await glob(path.join(dir, '**/llm.txt'), { absolute: true });
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
