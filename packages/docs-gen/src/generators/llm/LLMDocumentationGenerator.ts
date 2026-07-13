import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
import { SvelteDocsParser } from '../../parsers/SvelteDocsParser';
import type {
  APIData,
  ComponentAPIData,
  EnrichedComponentInfo,
  GeneratedOutput
} from '../../types';
import type { LLMOutputConfig } from '../../types/configuration';

/**
 * Minimal LLM documentation generator
 * - Focuses on API quick reference; optionally includes variants and examples
 * - Respects SvelteDocsConfig.llm (include, priority, excludeTypes, maxSections)
 * - Supports file or directory output depending on config.llm.outputPath
 */
export class LLMDocumentationGenerator {
  private config: LLMOutputConfig;
  private docsParser = new SvelteDocsParser();

  constructor(config: LLMOutputConfig) {
    this.config = config;
  }

  async generate(
    enrichedComponents: EnrichedComponentInfo[],
    apiData: APIData
  ): Promise<GeneratedOutput> {
    const outputPath = this.config.outputPath;
    const ext = path.extname(outputPath).toLowerCase();

    // Determine if we write a single file or a directory with per-component files
    const writeAsDirectory = ext === '';

    if (writeAsDirectory) {
      // Clean previous output to prevent stale files from accumulating
      // (e.g. moved components, renamed groups, phantom barrel-export entries)
      try {
        await fs.rm(outputPath, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      await fs.mkdir(outputPath, { recursive: true });
      const writtenFiles: string[] = [];
      for (const component of enrichedComponents) {
        const componentApi = apiData.components[component.name];
        if (!componentApi) continue;

        const docsConfig = await this.loadDocsConfig(component);
        if (docsConfig.llm?.include === false) continue;

        const content = await this.generateComponentContent(component, componentApi, docsConfig);
        // Write to mirrored route structure with fixed file name "llm.txt"
        const group = (componentApi as ComponentAPIData).group;
        const slug = this.toSlug(component.name);
        const dir = group ? path.join(outputPath, group, slug) : path.join(outputPath, slug);
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, 'llm.txt');
        await fs.writeFile(filePath, content, 'utf-8');
        writtenFiles.push(filePath);
      }

      // Write a per-scope llms.txt manifest for convenience (llms.txt proposal)
      const indexContent = this.generateLlmsTxt(enrichedComponents, apiData);
      const indexPath = path.join(outputPath, 'llms.txt');
      await fs.writeFile(indexPath, indexContent, 'utf-8');
      writtenFiles.push(indexPath);

      // Also maintain a global aggregator at the static root (one level up)
      try {
        const staticRoot = path.resolve(outputPath, '..');
        const globalIndex = this.generateGlobalLlmsTxt(staticRoot);
        const globalIndexPath = path.join(staticRoot, 'llms.txt');
        await fs.writeFile(globalIndexPath, globalIndex, 'utf-8');
        writtenFiles.push(globalIndexPath);
      } catch {
        /* ignore */
      }

      const totalSize = await this.calculateTotalSize(writtenFiles);
      return {
        type: 'llm',
        path: outputPath,
        size: totalSize,
        components: enrichedComponents.map((c) => c.name)
      };
    }

    // Single-file output (markdown|text|json) for backward compatibility
    const format = this.config.format || 'markdown';
    const content = await this.generateSingleFileContent(enrichedComponents, apiData, format);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf-8');

    const stats = await fs.stat(outputPath);
    return {
      type: 'llm',
      path: outputPath,
      size: stats.size,
      components: enrichedComponents.map((c) => c.name)
    };
  }

  // ==========================================
  // CONTENT GENERATION
  // ==========================================

  private async generateSingleFileContent(
    components: EnrichedComponentInfo[],
    apiData: APIData,
    format: 'markdown' | 'text' | 'json'
  ): Promise<string> {
    if (format === 'json') {
      const payload = await Promise.all(
        components.map(async (c) => {
          const cfg = await this.loadDocsConfig(c);
          const compApi = apiData.components[c.name];
          return this.buildComponentJson(c, compApi, cfg);
        })
      );
      return JSON.stringify({ generated: new Date().toISOString(), components: payload }, null, 2);
    }

    const blocks: string[] = [];
    blocks.push(`# Urbicon UI - LLM Documentation\n`);
    blocks.push(`Generated: ${new Date().toISOString()}\n`);
    blocks.push(this.renderContextHeader());
    blocks.push('');

    for (const component of components) {
      const compApi = apiData.components[component.name];
      if (!compApi) continue;
      const docsConfig = await this.loadDocsConfig(component);
      if (docsConfig.llm?.include === false) continue;
      const md = await this.generateComponentContent(component, compApi, docsConfig);
      blocks.push(md);
      blocks.push('');
    }

    blocks.push(this.renderPatternsSection());

    const markdown = blocks.join('\n');
    if (format === 'text') {
      return markdown.replace(/^#\s+/gm, '').replace(/^##\s+/gm, '');
    }
    return markdown;
  }

  private async generateComponentContent(
    component: EnrichedComponentInfo,
    componentApiData: APIData['components'][string],
    docsConfig: SvelteDocsConfig
  ): Promise<string> {
    const title = docsConfig.meta?.title || component.name;
    const description = docsConfig.meta?.description || component.description || '';

    const sections: Array<{ id: string; type: string; content: string }> = [];

    // Candidate sections
    const overviewAllowed = this.shouldIncludeInLLM('overview', 'overview', docsConfig);
    if (overviewAllowed) {
      sections.push({
        id: 'overview',
        type: 'overview',
        content: this.renderOverviewMarkdown(title, description)
      });
    }

    const apiAllowed = this.shouldIncludeInLLM('api', 'api', docsConfig);
    if (apiAllowed) {
      sections.push({ id: 'api', type: 'api', content: this.renderApiMarkdown(componentApiData) });
    }

    const variantsAllowed =
      componentApiData.variants.length > 0 &&
      this.shouldIncludeInLLM('variants', 'variants', docsConfig);
    if (variantsAllowed) {
      sections.push({
        id: 'variants',
        type: 'variants',
        content: this.renderVariantsMarkdown(componentApiData)
      });
    }

    const examplesAllowed =
      componentApiData.examples.length > 0 &&
      this.shouldIncludeInLLM('examples', 'examples', docsConfig);
    if (examplesAllowed) {
      sections.push({
        id: 'examples',
        type: 'examples',
        content: this.renderExamplesMarkdown(componentApiData)
      });
    }

    // Order and limit by priority
    const ordered = this.orderAndLimitSections(sections, docsConfig);

    const lines: string[] = [];
    lines.push(`\n---\n`);
    lines.push(`## ${title}`);
    if (description) lines.push(`${description}`);
    lines.push('');
    lines.push(`**Import:** \`import { ${component.name} } from '${component.packageName}';\``);
    lines.push('');
    for (const sec of ordered) {
      if (sec.id === 'overview') continue;
      lines.push(`### ${this.capitalize(sec.id)}`);
      lines.push(sec.content);
      lines.push('');
    }

    // Add slot classes info if available from variants
    const slotInfo = this.extractSlotInfo(componentApiData);
    if (slotInfo) {
      lines.push('### Slots (slotClasses keys)');
      lines.push(slotInfo);
      lines.push('');
    }

    return lines.join('\n');
  }

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  private renderOverviewMarkdown(title: string, description: string): string {
    const parts: string[] = [];
    parts.push(`**Component**: ${title}`);
    if (description) parts.push(description);
    return parts.join('\n\n');
  }

  private renderApiMarkdown(componentApiData: APIData['components'][string]): string {
    const lines: string[] = [];
    lines.push('| Prop | Type | Required | Default | Description |');
    lines.push('| --- | --- | :---: | --- | --- |');
    for (const prop of componentApiData.props) {
      const required = prop.required ? 'yes' : 'no';
      const def = prop.defaultValue ?? '';
      const desc = (prop.description || '').replace(/\n/g, ' ').trim();
      lines.push(`| ${prop.name} | \`${prop.type}\` | ${required} | ${def} | ${desc} |`);
    }
    // Inheritance summary
    if (componentApiData.inheritance.length > 0) {
      lines.push('');
      lines.push('Inherited from:');
      for (const inh of componentApiData.inheritance) {
        lines.push(`- ${inh.typeName}${inh.source ? ` (${inh.source})` : ''}`);
      }
    }
    return lines.join('\n');
  }

  private renderVariantsMarkdown(componentApiData: APIData['components'][string]): string {
    const lines: string[] = [];
    for (const variant of componentApiData.variants) {
      const values = variant.values.join(', ');
      const def = variant.defaultValue ? ` (default: ${variant.defaultValue})` : '';
      lines.push(`- ${variant.name}: ${values}${def}`);
    }
    return lines.join('\n');
  }

  private renderExamplesMarkdown(componentApiData: APIData['components'][string]): string {
    // Normalize examples and strip accidental nested fences (e.g., if example already contains ```svelte)
    const blocks = (componentApiData.examples || []).map((raw) => {
      const code = (raw || '').trim();
      // If snippet already starts with a fence, return as-is to avoid nesting
      if (/^```/.test(code)) return code;
      // Also strip any leading ```svelte/``` markers inside the snippet to avoid double markers
      const inner = code.replace(/^```\w*\n([\s\S]*?)```\s*$/m, '$1').trim();
      return ['```svelte', inner, '```'].join('\n');
    });
    return blocks.join('\n\n');
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  private async loadDocsConfig(component: EnrichedComponentInfo): Promise<SvelteDocsConfig> {
    const docsFilePath = await this.resolveDocsFilePath(component);
    const result = await this.docsParser.parseDocsFile(component.name, docsFilePath || undefined);
    return result.docsConfig;
  }

  private async resolveDocsFilePath(component: EnrichedComponentInfo): Promise<string | null> {
    try {
      const baseDir = path.dirname(
        (component as { filePath?: string }).filePath ?? component.filePath
      );
      const candidateA = path.join(baseDir, 'docs.svelte');
      try {
        await fs.access(candidateA);
        return candidateA;
      } catch {
        /* not found */
      }
      const candidateB = path.join(baseDir, 'docs', 'docs.svelte');
      try {
        await fs.access(candidateB);
        return candidateB;
      } catch {
        /* not found */
      }
      return null;
    } catch {
      return null;
    }
  }

  private shouldIncludeInLLM(
    sectionId: string,
    sectionType: string,
    docsConfig: SvelteDocsConfig
  ): boolean {
    if (docsConfig.llm?.include === false) return false;
    if (docsConfig.llm?.excludeTypes?.includes(sectionType)) return false;
    if (docsConfig.llm?.priority && docsConfig.llm.priority.length > 0) {
      return docsConfig.llm.priority.includes(sectionId);
    }
    const defaultExclude = ['playground'];
    return !defaultExclude.includes(sectionType);
  }

  private orderAndLimitSections(
    sections: Array<{ id: string; type: string; content: string }>,
    docsConfig: SvelteDocsConfig
  ) {
    const priority = docsConfig.llm?.priority || ['overview', 'api', 'variants', 'examples'];
    const max = docsConfig.llm?.maxSections ?? sections.length;
    const byId = new Map(sections.map((s) => [s.id, s] as const));
    const ordered: Array<{ id: string; type: string; content: string }> = [];
    for (const id of priority) {
      const s = byId.get(id);
      if (s) ordered.push(s);
    }
    // Append remaining in original order
    for (const s of sections) {
      if (!ordered.find((o) => o.id === s.id)) ordered.push(s);
    }
    return ordered.slice(0, max);
  }

  private async calculateTotalSize(filePaths: string[]): Promise<number> {
    let total = 0;
    for (const fp of filePaths) {
      try {
        const st = await fs.stat(fp);
        total += st.size;
      } catch {
        // ignore
      }
    }
    return total;
  }

  private generateLlmsTxt(components: EnrichedComponentInfo[], apiData: APIData): string {
    const lines: string[] = [];
    // H1 title as per llms.txt informal spec
    lines.push('# Urbicon UI');
    lines.push('');
    lines.push('> LLM-friendly documentation files for components.');
    lines.push('');
    lines.push('## Components');
    for (const c of components) {
      // The per-component file is written to `<group>/<slug>/llm.txt` (or
      // `<slug>/llm.txt` when the component has no group) — see the write loop
      // in generate(). The index link MUST carry the same group segment from
      // apiData or it 404s.
      const group = apiData.components[c.name]?.group;
      const slug = this.toSlug(c.name);
      const href = group ? `./${group}/${slug}/llm.txt` : `./${slug}/llm.txt`;
      lines.push(`- [${c.name}](${href}): Component LLM context`);
    }
    return lines.join('\n');
  }

  private generateGlobalLlmsTxt(_staticRoot: string): string {
    const lines: string[] = [];
    lines.push('# Urbicon UI');
    lines.push('');
    lines.push('> Global LLM resources index.');
    lines.push('');
    lines.push(
      '- [Full API Reference](./llms-full.txt): Complete component props, variants, tokens, and patterns'
    );
    lines.push('');
    lines.push('## Scopes');
    const scopes = [
      { name: 'Blocks', path: 'blocks/llms.txt' },
      { name: 'Docs', path: 'docs/llms.txt' },
      { name: 'Table', path: 'table/llms.txt' },
      { name: 'Auth', path: 'auth/llms.txt' }
    ];
    for (const s of scopes) {
      lines.push(`- [${s.name}](./${s.path}): Scope index`);
    }
    return lines.join('\n');
  }

  private buildComponentJson(
    component: EnrichedComponentInfo,
    componentApiData: APIData['components'][string] | undefined,
    docsConfig: SvelteDocsConfig
  ) {
    return {
      name: component.name,
      title: docsConfig.meta?.title || component.name,
      description: docsConfig.meta?.description || component.description || '',
      api: {
        props: componentApiData?.props ?? [],
        inheritance: componentApiData?.inheritance ?? [],
        variants: componentApiData?.variants ?? []
      },
      examples: componentApiData?.examples ?? []
    };
  }

  private renderContextHeader(): string {
    return [
      '## Context for LLM Code Generation',
      '',
      'Urbicon UI is a Svelte 5 + Tailwind CSS 4 component library.',
      'All components import from `@urbicon-ui/blocks`.',
      'Components use Svelte 5 runes ($props, $state, $derived) and Snippets (not slots).',
      '',
      '**Shared props:** intent, variant, size, unstyled, slotClasses, mint, class, disabled.',
      '',
      '**Design tokens (use instead of hardcoded values):**',
      '- Surfaces: `bg-surface-base`, `bg-surface-elevated`, `bg-surface-overlay`',
      '- Text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`',
      '- Borders: `border-border-subtle`, `border-border-default`',
      '- Shadows: `shadow-[var(--blocks-shadow-sm)]` through `shadow-[var(--blocks-shadow-lg)]`',
      '- Z-index: `z-[var(--z-modal)]`, `z-[var(--z-popover)]`, `z-[var(--z-tooltip)]`',
      '',
      '**NEVER use:** `dark:` prefixed classes, hardcoded colors, `focus:` (use `focus-visible:`).',
      ''
    ].join('\n');
  }

  private renderPatternsSection(): string {
    return [
      '---',
      '',
      '## Common Combination Patterns',
      '',
      '### Form with validation',
      '```svelte',
      '<script>',
      "  import { Input, Checkbox, Button } from '@urbicon-ui/blocks';",
      '</script>',
      '',
      '<form onsubmit={handleSubmit}>',
      '  <Input label="Email" type="email" bind:value={email} error={errors.email} required />',
      '  <Input label="Password" type="password" bind:value={password} error={errors.password} required />',
      '  <Checkbox label="Remember me" bind:checked={remember} />',
      '  <Button intent="primary" type="submit" loading={submitting}>Sign In</Button>',
      '</form>',
      '```',
      '',
      '### Confirmation dialog',
      '```svelte',
      '<Dialog bind:open={showConfirm} title="Delete Item?" intent="danger" size="sm">',
      '  <p>This action cannot be undone.</p>',
      '  {#snippet footer()}',
      '    <Button variant="ghost" onclick={() => showConfirm = false}>Cancel</Button>',
      '    <Button intent="danger" onclick={handleDelete}>Delete</Button>',
      '  {/snippet}',
      '</Dialog>',
      '```',
      '',
      '### Card with header and badge',
      '```svelte',
      '<Card variant="outlined" padding="lg">',
      '  {#snippet header()}',
      '    <div class="flex items-center justify-between">',
      '      <h3 class="text-text-primary font-semibold">Revenue</h3>',
      '      <Badge intent="success" variant="soft">+12%</Badge>',
      '    </div>',
      '  {/snippet}',
      '  <p class="text-3xl font-bold text-text-primary">$48,200</p>',
      '</Card>',
      '```',
      '',
      '### Menu with custom items (action pattern)',
      '```svelte',
      '<Menu items={actions} getItemLabel={(a) => a.label} getItemValue={(a) => a.id}>',
      '  {#snippet customItem(action, activate)}',
      '    <button type="button" onclick={activate} class="flex items-center gap-2 p-2">',
      '      <Icon name={action.icon} />',
      '      <span>{action.label}</span>',
      '    </button>',
      '  {/snippet}',
      '</Menu>',
      '```',
      ''
    ].join('\n');
  }

  private extractSlotInfo(componentApiData: APIData['components'][string]): string | null {
    const variants = componentApiData.variants || [];
    const slotNames = new Set<string>();
    for (const v of variants) {
      if (v.name === 'slot' || v.name === 'slots') {
        for (const val of v.values) slotNames.add(val);
      }
    }
    // Also extract from props that mention slot
    for (const prop of componentApiData.props) {
      if (prop.name === 'slotClasses' && prop.type) {
        const match = prop.type.match(/Record<['"]([\w\s|']+)['"],/);
        if (match?.[1]) {
          const keys = match[1]
            .split(/[|']/)
            .filter(Boolean)
            .map((s) => s.trim());
          keys.forEach((k) => {
            slotNames.add(k);
          });
        }
      }
    }
    if (slotNames.size === 0) return null;
    // Filter out empty slot names that can occur from regex extraction
    const validSlots = Array.from(slotNames).filter((s) => s.trim() !== '');
    if (validSlots.length === 0) return null;
    return validSlots.map((s) => `\`${s}\``).join(', ');
  }

  private capitalize(input: string): string {
    if (!input) return input;
    return input.charAt(0).toUpperCase() + input.slice(1);
  }

  private toSlug(input: string): string {
    return input
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
}
