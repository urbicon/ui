import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import * as ts from 'typescript';
import type {
  ComponentFiles,
  ComponentInfo,
  ComponentManifest,
  ExtractionResult,
  PackageConfig,
  PackageInfo
} from '../../types';

/**
 * Finds and analyzes components in packages using glob patterns
 */
export class ComponentFinder {
  private cache = new Map<string, ComponentManifest[]>();

  /**
   * Find all components in a package
   */
  async findComponents(packageConfig: PackageConfig): Promise<ComponentManifest[]> {
    const cacheKey = `${packageConfig.name}:${packageConfig.path}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`📦 Using cached results for ${packageConfig.name}`);
      return cached;
    }

    console.log(`🔍 Discovering components in ${packageConfig.name}`);

    try {
      const manifests = await this.discoverComponents(packageConfig);
      this.cache.set(cacheKey, manifests);

      console.log(`✅ Found ${manifests.length} components in ${packageConfig.name}`);
      return manifests;
    } catch (error) {
      console.error(`❌ Failed to discover components in ${packageConfig.name}:`, error);
      throw new Error(
        `Component discovery failed for ${packageConfig.name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  /**
   * Clear the cache (useful for watch mode)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get package info from package.json
   */
  async getPackageInfo(packagePath: string): Promise<PackageInfo> {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      return {
        name: packageJson.name,
        version: packageJson.version || '0.0.0',
        description: packageJson.description,
        homepage: packageJson.homepage,
        repository:
          typeof packageJson.repository === 'string'
            ? packageJson.repository
            : packageJson.repository?.url
      };
    } catch (_error) {
      console.warn(`⚠️  Could not read package.json from ${packagePath}, using defaults`);
      return {
        name: path.basename(packagePath),
        version: '0.0.0'
      };
    }
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  private async discoverComponents(packageConfig: PackageConfig): Promise<ComponentManifest[]> {
    const manifests: ComponentManifest[] = [];

    // Find component files using glob pattern
    const componentFiles = await this.findComponentFiles(packageConfig);

    if (componentFiles.length === 0) {
      console.warn(
        `⚠️  No component files found in ${packageConfig.name} using pattern: ${packageConfig.glob.components}`
      );
      return manifests;
    }

    console.log(`📁 Found ${componentFiles.length} component files`);

    // Get package info once
    const packageInfo = await this.getPackageInfo(packageConfig.path);

    // Process each component file
    for (const componentFile of componentFiles) {
      try {
        const manifest = await this.createComponentManifest(
          componentFile,
          packageConfig,
          packageInfo
        );

        if (manifest) {
          manifests.push(manifest);
          console.log(`  ✅ ${manifest.component.name}`);

          // A multi-component index.ts can opt additional exports into the catalog via a
          // `@standalone` JSDoc tag on their `<Name>Props` interface (e.g. the Guide surfaces).
          // Each one becomes a full manifest pointing at the same index.ts — the extractors
          // already work per (filePath, componentName) pair.
          const standaloneNames = await this.findStandaloneComponentNames(
            componentFile,
            manifest.component.name
          );
          for (const standaloneName of standaloneNames) {
            const standaloneManifest = await this.createComponentManifest(
              componentFile,
              packageConfig,
              packageInfo,
              standaloneName
            );
            if (standaloneManifest) {
              manifests.push(standaloneManifest);
              console.log(`  ✅ ${standaloneName} (@standalone in ${manifest.component.name})`);
            }
          }
        }
      } catch (error) {
        console.warn(
          `  ⚠️  Failed to process ${componentFile}:`,
          error instanceof Error ? error.message : String(error)
        );
        // Continue with other components
      }
    }

    return manifests;
  }

  /**
   * Find component exports in an index.ts that opt into their own catalog entry.
   *
   * An export qualifies when both hold:
   *   1. it is re-exported from a Svelte file: `export { default as X } from './X.svelte'`
   *   2. a local `interface XProps` carries the `@standalone` JSDoc tag
   *
   * The tag is the explicit opt-in that separates independent surfaces (Guide family) from
   * compound subcomponents (TabItem, MenuItem, CalendarDay, …), which carry the same
   * `@description`/`@tag` metadata but must NOT become standalone catalog entries.
   */
  private async findStandaloneComponentNames(
    indexFilePath: string,
    primaryComponentName: string
  ): Promise<string[]> {
    let content: string;
    try {
      content = await fs.readFile(indexFilePath, 'utf-8');
    } catch {
      return [];
    }
    // Cheap pre-filter before paying for an AST parse.
    if (!content.includes('@standalone')) return [];

    const sourceFile = ts.createSourceFile(
      indexFilePath,
      content,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true
    );

    const svelteExports: string[] = [];
    const standaloneProps = new Set<string>();

    for (const statement of sourceFile.statements) {
      // `export { default as X } from './X.svelte'`
      if (
        ts.isExportDeclaration(statement) &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.endsWith('.svelte')
      ) {
        for (const element of statement.exportClause.elements) {
          if (element.propertyName?.text === 'default') {
            svelteExports.push(element.name.text);
          }
        }
      }

      // `interface XProps { … }` or `type XProps = …` (discriminated-union pattern,
      // e.g. TabProps/BadgeProps) with an `@standalone` JSDoc tag
      if (
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
        statement.name.text.endsWith('Props')
      ) {
        const hasTag = ts.getJSDocTags(statement).some((tag) => tag.tagName.text === 'standalone');
        if (hasTag) {
          standaloneProps.add(statement.name.text.slice(0, -'Props'.length));
        }
      }
    }

    const names: string[] = [];
    for (const exportName of svelteExports) {
      if (exportName === primaryComponentName) continue; // already the primary manifest
      if (standaloneProps.has(exportName)) {
        names.push(exportName);
        standaloneProps.delete(exportName);
      }
    }
    standaloneProps.delete(primaryComponentName);
    for (const orphan of standaloneProps) {
      console.warn(
        `  ⚠️  @standalone on ${orphan}Props in ${indexFilePath} has no matching ` +
          `\`export { default as ${orphan} } from './${orphan}.svelte'\` — entry skipped.`
      );
    }
    return names;
  }

  private async findComponentFiles(packageConfig: PackageConfig): Promise<string[]> {
    const pattern = path.join(packageConfig.path, packageConfig.glob.components);

    // Debug logging
    console.log(`🔍 Searching for components:`);
    console.log(`   📦 Package: ${packageConfig.name}`);
    console.log(`   📂 Path: ${packageConfig.path}`);
    console.log(`   🔍 Glob: ${packageConfig.glob.components}`);
    console.log(`   📋 Pattern: ${pattern}`);
    console.log(`   🏠 CWD: ${process.cwd()}`);

    try {
      // glob has not sorted since v9, and this order is the order components
      // are emitted in — it reaches `llms.txt` and `_catalog.json` directly, so
      // two runs of the same tree disagreed. Sorted with the default
      // comparator: `localeCompare` would follow the runtime locale and put the
      // reproducibility back where it was.
      const files = (
        await glob(pattern, {
          ignore: packageConfig.exclude || [],
          absolute: true
        })
      ).sort();

      console.log(`   ✅ Found ${files.length} files`);
      if (files.length === 0) {
        console.log(`   🔍 Debug: Trying to resolve pattern...`);
        const resolvedPattern = path.resolve(pattern);
        console.log(`   📍 Resolved pattern: ${resolvedPattern}`);
      }

      // Filter by include patterns if specified
      const include = packageConfig.include;
      if (include?.length) {
        return files.filter((file) =>
          include.some((includePattern) => file.includes(includePattern))
        );
      }

      return files;
    } catch (error) {
      throw new Error(
        `Glob pattern failed: ${pattern} - ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  private async createComponentManifest(
    componentFilePath: string,
    packageConfig: PackageConfig,
    packageInfo: PackageInfo,
    nameOverride?: string
  ): Promise<ComponentManifest | null> {
    // Extract component name from file path (or take the @standalone export's name —
    // related-file discovery below still keys on the path-derived family name, so a
    // surface shares its family's variants/docs files, e.g. Guide/guide.variants.ts).
    const componentName = nameOverride ?? this.extractComponentName(componentFilePath);

    if (!componentName) {
      console.warn(`⚠️  Could not extract component name from ${componentFilePath}`);
      return null;
    }

    // Verify the file exists and is readable
    try {
      await fs.access(componentFilePath);
    } catch (error) {
      throw new Error(`Component file not accessible: ${componentFilePath}`, { cause: error });
    }

    // A family barrel (e.g. components/Chat/index.ts) only re-exports member
    // directories — it neither re-exports a Svelte file of its own nor declares
    // a `*Props` interface (the catalog substance per ComponentStructureStandard).
    // Such a file is not a component and must not become a catalog entry; its
    // members are discovered via their own index.ts. Real component indexes
    // keep at least one of the two markers (e.g. table's core/table/index.ts
    // has no .svelte re-export but declares TableProps).
    if (!nameOverride && path.basename(componentFilePath) === 'index.ts') {
      const source = await fs.readFile(componentFilePath, 'utf-8');
      const hasSvelteDefaultExport =
        /export\s*\{\s*default\s+as\s+\w+\s*\}\s*from\s*'[^']*\.svelte'/.test(source);
      const declaresPropsInterface = /\binterface\s+\w+Props\b/.test(source);
      if (!hasSvelteDefaultExport && !declaresPropsInterface) {
        console.log(
          `  ⏭️  ${componentName} — barrel (no .svelte export, no *Props interface), skipped`
        );
        return null;
      }
    }

    // Create component info
    const componentInfo: ComponentInfo = {
      name: componentName,
      packageName: packageConfig.name,
      filePath: componentFilePath,
      version: packageInfo.version,
      description: `${componentName} component`, // TODO: Extract from JSDoc
      props: [], // Will be populated by TypeScript extractor
      variants: [], // Will be populated by variants extractor
      inheritance: [], // Will be populated by inheritance extractor
      stats: {
        // Basic stats, will be enriched later
        totalProps: 0,
        directProps: 0,
        variantProps: 0,
        inheritedProps: 0
      }
    };

    // Discover related files
    const files = await this.discoverRelatedFiles(componentFilePath, packageConfig);

    return {
      component: componentInfo,
      files,
      packageInfo
    };
  }

  private extractComponentName(filePath: string): string | null {
    const basename = path.basename(filePath, path.extname(filePath));

    // Handle index.ts files - use parent directory name
    if (basename === 'index') {
      const parentDir = path.basename(path.dirname(filePath));
      // Skip group root aggregators like src/lib/components/index.ts or src/lib/primitives/index.ts
      if (parentDir.toLowerCase() === 'components' || parentDir.toLowerCase() === 'primitives') {
        return null;
      }

      // 🔧 FIX: Better PascalCase handling
      if (parentDir.match(/^[A-Z]/)) {
        // Already PascalCase: Button, Badge, etc.
        return parentDir;
      } else {
        // Convert to PascalCase: button -> Button
        return parentDir.charAt(0).toUpperCase() + parentDir.slice(1);
      }
    }

    // Handle direct component files
    if (basename.match(/^[A-Z]/)) {
      return basename;
    }

    // Handle kebab-case or snake_case
    const pascalCase = basename
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    return pascalCase || null;
  }

  private async discoverRelatedFiles(
    componentFilePath: string,
    packageConfig: PackageConfig
  ): Promise<ComponentFiles> {
    const componentName = this.extractComponentName(componentFilePath);

    const files: ComponentFiles = {
      main: componentFilePath
    };

    // Look for variants file
    if (packageConfig.glob.variants) {
      const variantsFile = await this.findRelatedFile(
        packageConfig.path, // ← FIX: Use package path instead of component dir
        packageConfig.glob.variants,
        componentName
      );

      if (variantsFile) {
        files.variants = variantsFile;
        console.log(`    🎨 Found variants: ${path.relative(packageConfig.path, variantsFile)}`);
      }
    }

    // Look for documentation file
    if (packageConfig.glob.documentation) {
      const docFile = await this.findRelatedFile(
        packageConfig.path,
        packageConfig.glob.documentation,
        componentName
      );

      if (docFile) {
        files.documentation = docFile;
        console.log(`    📚 Found docs: ${path.relative(packageConfig.path, docFile)}`);
      }
    }

    // Look for test files
    if (packageConfig.glob.tests) {
      const testFiles = await this.findRelatedFiles(
        packageConfig.path,
        packageConfig.glob.tests,
        componentName
      );
      if (testFiles.length > 0) {
        files.tests = testFiles;
        console.log(`    🧪 Found tests: ${testFiles.length} files`);
      }
    }

    return files;
  }

  private async findRelatedFile(
    baseDir: string,
    globPattern: string,
    componentName?: string | null
  ): Promise<string | undefined> {
    const files = await this.findRelatedFiles(baseDir, globPattern, componentName);
    return files[0]; // Return first match
  }

  private async findRelatedFiles(
    baseDir: string,
    globPattern: string,
    componentName?: string | null
  ): Promise<string[]> {
    try {
      // Replace {component} placeholder with actual component name
      let pattern = globPattern;
      if (componentName) {
        pattern = pattern.replace(/\{component\}/g, componentName.toLowerCase());
      }

      // 🔧 FIX: Try multiple patterns for better coverage
      const patterns = [
        path.join(baseDir, pattern),
        // Also try without ** if it exists (for direct files)
        path.join(baseDir, pattern.replace('/**/', '/')),
        // Try with PascalCase component name too
        componentName
          ? path.join(baseDir, globPattern.replace(/\{component\}/g, componentName))
          : null
      ].filter(Boolean) as string[];

      console.log(
        `    🔍 Searching for related files with patterns:`,
        patterns.map((p) => path.relative(baseDir, p))
      );

      let allFiles: string[] = [];
      for (const patternToTry of patterns) {
        try {
          const files = (await glob(patternToTry, { absolute: true })).sort();
          allFiles.push(...files);
          if (files.length > 0) {
            console.log(
              `      ✅ Pattern "${path.relative(baseDir, patternToTry)}" found:`,
              files.map((f) => path.relative(baseDir, f))
            );
          }
        } catch (error) {
          console.log(`      ⚠️  Pattern "${path.relative(baseDir, patternToTry)}" failed:`, error);
        }
      }

      // Remove duplicates
      allFiles = [...new Set(allFiles)];

      // Enhanced filtering logic
      if (componentName && allFiles.length > 0) {
        const componentDirName = componentName;
        const componentFileNameLower = componentName.toLowerCase();

        return allFiles.filter((file) => {
          const relativePath = path.relative(baseDir, file);
          const fileName = path.basename(file);

          return (
            // File is in component directory (PascalCase): src/lib/primitives/Button/...
            relativePath.includes(`/${componentDirName}/`) ||
            // File is in component directory (lowercase): src/lib/primitives/button/...
            relativePath.includes(`/${componentFileNameLower}/`) ||
            // File matches component name pattern: button.variants.ts
            fileName.startsWith(`${componentFileNameLower}.`) ||
            // File matches component name pattern: Button.variants.ts
            fileName.startsWith(`${componentDirName}.`) ||
            // Special case for common docs files: docs.svelte, docs.md, etc.
            fileName.startsWith('docs.')
          );
        });
      }

      return allFiles;
    } catch (error) {
      console.warn(`    ⚠️  Failed to find related files with pattern ${globPattern}:`, error);
      return [];
    }
  }

  /**
   * Validate that a component manifest is complete and valid
   */
  async validateManifest(
    manifest: ComponentManifest
  ): Promise<ExtractionResult<ComponentManifest>> {
    const errors = [];
    const warnings = [];

    // Validate main component file exists
    try {
      await fs.access(manifest.files.main);
    } catch {
      errors.push({
        type: 'missing_file',
        message: `Main component file does not exist: ${manifest.files.main}`,
        location: { file: manifest.files.main, line: 0, column: 0 }
      });
    }

    // Validate component name
    if (!manifest.component.name.match(/^[A-Z][a-zA-Z0-9]*$/)) {
      warnings.push({
        type: 'naming_convention',
        message: `Component name should be PascalCase: ${manifest.component.name}`,
        suggestion: 'Use PascalCase naming convention for components'
      });
    }

    // Check if variants file exists
    if (manifest.files.variants) {
      try {
        await fs.access(manifest.files.variants);
      } catch {
        warnings.push({
          type: 'missing_variants',
          message: `Variants file claimed but not found: ${manifest.files.variants}`,
          suggestion: 'Remove variants glob pattern or create the variants file'
        });
      }
    }

    return {
      success: errors.length === 0,
      data: manifest,
      errors,
      warnings,
      metadata: {
        duration: 0,
        extractorVersion: '2.0.0',
        sourceFile: manifest.files.main,
        timestamp: new Date().toISOString()
      }
    };
  }
}
