import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { VariantInfo } from '@urbicon-ui/shared-types';
import type { APIData, APIOutputConfig, ComponentAPIData, GeneratedOutput } from '../../types';
import { toSlug } from '../../utils/slug';

/**
 * One double-quoted YAML scalar.
 *
 * Backslash goes first: escaping the quote before the backslash would turn a
 * `\` immediately followed by a `"` into `\\"` — an escaped backslash and then a
 * bare quote, which ends the scalar mid-value and shifts every following line of
 * the document. Descriptions come from JSDoc, where a `\` is one regex example
 * away, so this is reachable rather than theoretical.
 */
function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

/**
 * Generates the per-component api.ts files that other phases can consume
 * (directory mode; single-file JSON/YAML aggregates are also supported).
 * This is the critical output that enables the API-first architecture.
 */
export class APIFileGenerator {
  private config: APIOutputConfig;

  constructor(config: APIOutputConfig) {
    this.config = config;
  }

  /**
   * Generate API file from API data
   */
  async generate(apiData: APIData): Promise<GeneratedOutput> {
    console.log(`📄 Generating API output: ${this.config.outputPath}`);

    const startTime = Date.now();

    try {
      // If outputPath has no extension, treat it as a directory and write per-component files
      const ext = path.extname(this.config.outputPath);
      if (!ext) {
        let totalSize = 0;
        await fs.mkdir(this.config.outputPath, { recursive: true });
        for (const [componentName, componentData] of Object.entries(apiData.components)) {
          const group = componentData.group;
          const slug = toSlug(componentName);
          // Avoid nested duplicate group segment (e.g., components/components)
          const dir = group
            ? path.join(this.config.outputPath, group, slug)
            : path.join(this.config.outputPath, slug);
          await fs.mkdir(dir, { recursive: true });
          const filePath = path.join(dir, 'api.ts');
          const fileContent = this.generatePerComponentTypeScriptFile(
            componentName,
            componentData,
            apiData
          );
          await fs.writeFile(filePath, fileContent, 'utf-8');
          const st = await fs.stat(filePath);
          totalSize += st.size;
        }

        const duration = Date.now() - startTime;
        console.log(`✅ API component files generated in ${duration}ms`);
        console.log(`   📦 Total size: ${Math.round(totalSize / 1024)}KB`);
        console.log(`   🧩 Components: ${Object.keys(apiData.components).length}`);

        return {
          type: 'api',
          path: this.config.outputPath,
          size: totalSize,
          components: Object.keys(apiData.components)
        };
      }

      // Else: write single aggregate file. Only JSON/YAML remain here — the
      // monolithic single-file TypeScript output was dead code (every real
      // config runs directory mode with per-component api.ts files) and was
      // removed.
      let content: string;

      switch (this.config.format) {
        case 'json':
          content = this.generateJSONFile(apiData);
          break;
        case 'yaml':
          content = this.generateYAMLFile(apiData);
          break;
        default:
          throw new Error(
            `Unsupported API format for single-file output: ${this.config.format}. ` +
              `TypeScript output requires directory mode (an extension-less outputPath).`
          );
      }

      const outputDir = path.dirname(this.config.outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Write file
      await fs.writeFile(this.config.outputPath, content, 'utf-8');

      const stats = await fs.stat(this.config.outputPath);
      const duration = Date.now() - startTime;

      console.log(`✅ API file generated successfully in ${duration}ms`);
      console.log(`   📦 Size: ${Math.round(stats.size / 1024)}KB`);
      console.log(`   🧩 Components: ${Object.keys(apiData.components).length}`);

      return {
        type: 'api',
        path: this.config.outputPath,
        size: stats.size,
        components: Object.keys(apiData.components)
      };
    } catch (error) {
      throw new Error(
        `Failed to generate API file: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ==========================================
  // PER-COMPONENT FILE GENERATION (DIRECTORY MODE)
  // ==========================================

  private generatePerComponentTypeScriptFile(
    componentName: string,
    componentData: ComponentAPIData,
    apiData: APIData
  ): string {
    const lines: string[] = [];
    lines.push('// AUTO-GENERATED FILE (per component)');
    lines.push(`// Generated: ${apiData.metadata.generated}`);
    lines.push(`// Component: ${componentName}`);
    lines.push('');
    lines.push(
      'export interface PropExample { title: string; code: string; description?: string }'
    );
    lines.push(
      'export interface DeprecationInfo { message: string; since?: string; alternative?: string }'
    );
    lines.push(
      'export interface VariantExample { value: string; label?: string; description?: string; code?: string }'
    );
    lines.push(
      // `summary` is the prop-level short form (`@summary` on the member): what a
      // playground shows beside the knob, where `description` is the contract.
      // It has to be declared here too — these files carry their own structural
      // type rather than importing `PropInfo`, so a field missing from this line
      // type-errors at the call site even though the value is emitted. `values`
      // is the same story for members resolved out of a `Pick<…>` clause, whose
      // literal unions the extractor now carries into the inheritance entry.
      "export interface InheritanceProp { name: string; type: string; required: boolean; description?: string; summary?: string; values?: string[]; source?: { type: 'direct' | 'inherited' | 'variant'; name?: string; package?: string; url?: string }; seeAlso?: string; seeAlsoRefs?: string[]; examples?: PropExample[] }"
    );
    lines.push(
      'export interface InheritanceInfo { typeName: string; source: string; url?: string; props: InheritanceProp[] }'
    );
    lines.push(
      'export interface ComponentStats { totalProps: number; directProps: number; variantProps: number; inheritedProps: number }'
    );
    lines.push('');
    lines.push('export interface PropInfo {');
    lines.push('  name: string;');
    lines.push('  type: string;');
    lines.push('  required: boolean;');
    lines.push('  description: string;');
    // The knob-side short form; see the note on `InheritanceProp` above.
    lines.push('  summary?: string;');
    lines.push('  defaultValue?: string;');
    lines.push('  examples?: PropExample[];');
    lines.push('  deprecated?: DeprecationInfo;');
    lines.push('  experimental?: boolean;');
    lines.push('  values?: string[];');
    // `seeAlso` = navigable target (URL / route path / fragment) → rendered as
    // a link. `seeAlsoRefs` = prose `@see` references (bare type/member names)
    // → rendered as literal text. See shared-types `PropInfo`.
    lines.push('  seeAlso?: string;');
    lines.push('  seeAlsoRefs?: string[];');
    lines.push(
      "  source?: { type: 'direct' | 'inherited' | 'variant'; name?: string; package?: string; url?: string };"
    );
    lines.push('  conditionalOn?: { propName: string; values: string[] };');
    lines.push('}');
    lines.push('');
    lines.push('export interface VariantInfo {');
    lines.push('  name: string;');
    lines.push('  values: string[];');
    lines.push('  defaultValue?: string;');
    lines.push('  examples?: VariantExample[];');
    lines.push('  valueDescriptions?: Record<string, string>;');
    lines.push('}');
    lines.push('');
    lines.push(
      "export type ComponentStability = 'experimental' | 'beta' | 'stable' | 'deprecated';"
    );
    lines.push('');
    lines.push(
      "export interface TypeUsedByRef { component: string; propName: string; source: 'direct' | 'inherited' | 'variant' }"
    );
    lines.push('');
    // Was `{ name; type; definition; [key: string]: unknown }` — an index
    // signature under which every field beyond the three named ones read back
    // as `unknown`, so a page could not branch on `scope`, `category` or
    // `usedByCount` without asserting first. It was *not* what forced the one
    // remaining cast in the docs app
    // (`docs/components/section/+page.svelte`): tsc accepts the old array as
    // `LocalTypeDef[]` unchanged, which is why ten other pages pass
    // `componentData.types` uncast today. Spelling the real shape out is
    // what makes the extra fields usable — and what surfaced the wrong
    // `scope` union in `LocalTypeDef`, since a precise type has to agree with
    // it where a bag of `unknown` did not.
    lines.push('export interface TypeDefinitionInfo {');
    lines.push('  name: string;');
    lines.push("  type: 'interface' | 'type' | 'enum' | 'class';");
    lines.push('  definition: string;');
    lines.push('  package: string;');
    lines.push('  documentation?: string;');
    lines.push("  scope?: 'local' | 'imported';");
    lines.push("  category?: 'props' | 'variant' | 'helper';");
    lines.push('  members?: number;');
    lines.push('  sourcePath?: string;');
    lines.push('  seeAlso?: string;');
    lines.push('  seeAlsoRefs?: string[];');
    // Whether a consumer can import the name from the package — the property
    // a docs page filters on, resolved against the package's entry points.
    lines.push('  exported?: boolean;');
    // The documented component that declares the type; unequal to this
    // component means the entry is a copy whose home is another page.
    lines.push('  owner?: string;');
    lines.push('  usedByProps?: TypeUsedByRef[];');
    lines.push('  usedByCount?: number;');
    lines.push('}');
    lines.push('');
    lines.push('export interface ComponentAPIInfo {');
    lines.push('  name: string;');
    lines.push('  props: PropInfo[];');
    lines.push('  variants: VariantInfo[];');
    lines.push('  inheritance: InheritanceInfo[];');
    lines.push('  examples: string[];');
    lines.push('  stats: ComponentStats;');
    lines.push('  group?: string;');
    lines.push('  stability?: ComponentStability;');
    lines.push('  sourceHref?: string;');
    lines.push('  relatedComponents?: string[];');
    // Slot names from the component's tv() config (VariantsExtractor). The
    // data dump below carries them since the real-slot-names change — without
    // this field the emitted `componentData: ComponentAPIInfo` no longer
    // type-checks in any freshly generated tree.
    lines.push('  slots?: string[];');
    lines.push('  types?: TypeDefinitionInfo[];');
    lines.push('}');
    lines.push('');
    const dataStr = JSON.stringify(componentData, null, 2);
    lines.push(`export const componentData: ComponentAPIInfo = ${dataStr} as const;`);
    lines.push('');
    return lines.join('\n');
  }

  // ==========================================
  // JSON FILE GENERATION
  // ==========================================

  private generateJSONFile(apiData: APIData): string {
    // Clean up data for JSON (remove functions, etc.)
    const cleanData = {
      components: apiData.components,
      types: apiData.types,
      metadata: apiData.metadata
    };

    return JSON.stringify(cleanData, null, this.config.optimization?.minify ? 0 : 2);
  }

  // ==========================================
  // YAML FILE GENERATION
  // ==========================================

  private generateYAMLFile(apiData: APIData): string {
    // Simple YAML conversion (could use a proper YAML library)
    const lines: string[] = [];

    lines.push('# Auto-generated API data');
    lines.push(`# Generated: ${apiData.metadata.generated}`);
    lines.push(`# Components: ${apiData.metadata.totalComponents}`);
    lines.push('');

    lines.push('metadata:');
    lines.push(`  generated: ${yamlString(apiData.metadata.generated)}`);
    lines.push(`  version: ${yamlString(apiData.metadata.version)}`);
    lines.push(`  totalComponents: ${apiData.metadata.totalComponents}`);
    lines.push(`  totalProps: ${apiData.metadata.totalProps}`);
    lines.push(`  generator: ${yamlString(apiData.metadata.generator)}`);
    lines.push('');

    lines.push('components:');
    for (const [componentName, componentData] of Object.entries(apiData.components)) {
      lines.push(`  ${componentName}:`);
      lines.push(`    name: ${yamlString(componentData.name)}`);
      lines.push(`    props:`);

      for (const prop of componentData.props) {
        lines.push(`      - name: ${yamlString(prop.name)}`);
        lines.push(`        type: ${yamlString(prop.type)}`);
        lines.push(`        required: ${prop.required}`);
        lines.push(`        description: ${yamlString(prop.description || '')}`);
      }

      lines.push(`    variants:`);
      for (const variant of componentData.variants) {
        lines.push(`      - name: ${yamlString(variant.name)}`);
        lines.push(`        values: [${variant.values.map(yamlString).join(', ')}]`);
        lines.push(`        defaultValue: ${yamlString(variant.defaultValue || '')}`);
        lines.push(
          `        description: ${yamlString(
            (variant as VariantInfo & { description?: string }).description || ''
          )}`
        );
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Validate API data before generation
   */
  validateAPIData(apiData: APIData): void {
    if (!apiData.components || Object.keys(apiData.components).length === 0) {
      throw new Error('API data must contain at least one component');
    }

    if (!apiData.metadata) {
      throw new Error('API data must contain metadata');
    }

    // Validate each component
    for (const [componentName, componentData] of Object.entries(apiData.components)) {
      if (!componentData.name) {
        throw new Error(`Component ${componentName} missing name`);
      }

      if (!Array.isArray(componentData.props)) {
        throw new Error(`Component ${componentName} props must be an array`);
      }

      if (!Array.isArray(componentData.variants)) {
        throw new Error(`Component ${componentName} variants must be an array`);
      }
    }
  }

  /**
   * Generate backup of existing API file if it exists
   */
  async createBackup(): Promise<void> {
    try {
      await fs.access(this.config.outputPath);

      // File exists, create backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this.config.outputPath}.backup-${timestamp}`;

      await fs.copyFile(this.config.outputPath, backupPath);
      console.log(`📋 Created backup: ${backupPath}`);
    } catch {
      // File doesn't exist, no backup needed
    }
  }

  /**
   * Compare with existing API file and report changes
   */
  async reportChanges(newAPIData: APIData): Promise<void> {
    try {
      const existingContent = await fs.readFile(this.config.outputPath, 'utf-8');

      // Extract metadata from existing file
      const metadataMatch = existingContent.match(/\/\/ Components: (\d+)/);
      const existingComponentCount = parseInt(metadataMatch?.[1] ?? '0', 10);

      const newComponentCount = Object.keys(newAPIData.components).length;

      if (existingComponentCount !== newComponentCount) {
        console.log(`📊 Component count changed: ${existingComponentCount} → ${newComponentCount}`);
      }

      // Could do more detailed change detection here
    } catch (_error) {
      // File doesn't exist yet
      console.log('📄 Creating new API file');
    }
  }
}
