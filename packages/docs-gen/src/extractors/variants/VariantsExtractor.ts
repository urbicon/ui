import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as ts from 'typescript';
import type { ExtractionResult, VariantInfo, VariantsExtractionConfig } from '../../types';
import { TypeScriptBaseExtractor } from '../typescript/TypeScriptBaseExtractor';

interface VariantsExtractionInput {
  componentPath: string;
  componentName: string;
  variantsFilePath?: string;
}

/**
 * Extracts variant information from Tailwind Variants files
 * Supports tv() function calls and various variant configurations
 */
export class VariantsExtractor extends TypeScriptBaseExtractor<
  VariantsExtractionInput,
  VariantInfo[]
> {
  public config: VariantsExtractionConfig;

  constructor(tsConfig?: Record<string, unknown>) {
    super(tsConfig);

    const ext = (tsConfig as { extraction?: { variants?: Partial<VariantsExtractionConfig> } })
      ?.extraction?.variants;
    this.config = {
      frameworks: ['tailwind-variants'],
      extractDefaults: true,
      includeComputed: false,
      customParsers: [],
      ...ext
    };
  }

  /**
   * Extract variants from component variants file
   */
  async extract(input: VariantsExtractionInput): Promise<ExtractionResult<VariantInfo[]>> {
    const startTime = Date.now();

    if (!this.validateInput(input)) {
      return this.handleError(new Error('Invalid input for variants extraction'), input);
    }

    try {
      console.log(`🎨 Extracting variants for ${input.componentName}`);

      // Find variants file
      const variantsFilePath = input.variantsFilePath || (await this.findVariantsFile(input));
      if (!variantsFilePath) {
        const warning = this.addWarning(
          'no_variants_file',
          `No variants file found for ${input.componentName}`,
          `Create a ${input.componentName.toLowerCase()}.variants.ts file to define component variants`
        );
        return this.createSuccessResult([], [warning], input.componentPath, Date.now() - startTime);
      }

      console.log(`✅ Found variants file: ${path.relative(process.cwd(), variantsFilePath)}`);

      // Parse variants from file
      const variants = await this.parseVariantsFile(variantsFilePath, input.componentName);

      console.log(`🎨 Extracted ${variants.length} variant groups from ${input.componentName}`);

      const duration = Date.now() - startTime;
      return this.createSuccessResult(variants, [], variantsFilePath, duration);
    } catch (error) {
      return this.handleError(error, input);
    }
  }

  // ==========================================
  // VARIANTS FILE DISCOVERY
  // ==========================================

  private async findVariantsFile(input: VariantsExtractionInput): Promise<string | null> {
    const componentDir = path.dirname(input.componentPath);
    const componentName = input.componentName;
    const kebab = componentName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const camel = componentName.charAt(0).toLowerCase() + componentName.slice(1);

    // Try common patterns for variants files. Authors are inconsistent
    // (some use lowercase, some camelCase, some kebab-case), so we
    // probe each variant. Order is "most specific first".
    const patterns = [
      `${componentName.toLowerCase()}.variants.ts`,
      `${componentName}.variants.ts`,
      `${camel}.variants.ts`,
      `${kebab}.variants.ts`,
      'variants.ts',
      `${componentName.toLowerCase()}.variants.js`,
      `${componentName}.variants.js`,
      `${camel}.variants.js`,
      `${kebab}.variants.js`
    ];

    // Discovery probes many candidates in sequence; we don't want each
    // missing path to log a warning. Check existence first via fs.access
    // and only call getSourceFile for paths that actually exist.
    for (const pattern of patterns) {
      const filePath = path.join(componentDir, pattern);
      try {
        await fs.access(filePath);
      } catch {
        continue;
      }
      try {
        const sourceFile = await this.getSourceFile(filePath);
        if (sourceFile) {
          return filePath;
        }
      } catch {
        // Continue to next pattern
      }
    }

    return null;
  }

  // ==========================================
  // VARIANTS FILE PARSING
  // ==========================================

  private async parseVariantsFile(
    variantsFilePath: string,
    componentName: string
  ): Promise<VariantInfo[]> {
    const sourceFile = await this.getSourceFile(variantsFilePath);
    if (!sourceFile) {
      throw new Error(`Could not load variants file: ${variantsFilePath}`);
    }

    // Find variants declaration
    const variantsDeclaration = this.findVariantsDeclaration(sourceFile, componentName);
    if (!variantsDeclaration) {
      throw new Error(`No variants declaration found in ${variantsFilePath}`);
    }

    console.log(`🎯 Found variants declaration: ${variantsDeclaration.name?.getText()}`);

    // Parse the variants based on framework
    return this.parseVariantsDeclaration(variantsDeclaration, sourceFile);
  }

  private findVariantsDeclaration(
    sourceFile: ts.SourceFile,
    componentName: string
  ): ts.VariableDeclaration | null {
    // camelCase covers the repo convention for multi-word components
    // (`segmentGroupVariants`, `guidePanelVariants`); for single-word names it
    // coincides with the lowercase candidate.
    const camel = componentName.charAt(0).toLowerCase() + componentName.slice(1);
    const possibleNames = [
      `${componentName.toLowerCase()}Variants`,
      `${camel}Variants`,
      `${componentName}Variants`,
      'variants'
    ];

    let foundDeclaration: ts.VariableDeclaration | null = null;

    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        const declarationName = node.name.text;
        if (possibleNames.includes(declarationName)) {
          foundDeclaration = node;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return foundDeclaration;
  }

  private parseVariantsDeclaration(
    declaration: ts.VariableDeclaration,
    _sourceFile: ts.SourceFile
  ): VariantInfo[] {
    if (!declaration.initializer) {
      throw new Error('Variants declaration has no initializer');
    }

    // Check for supported frameworks
    for (const framework of this.config.frameworks) {
      switch (framework) {
        case 'tailwind-variants': {
          const tvCall = this.findTailwindVariantsCall(declaration.initializer);
          if (tvCall) {
            return this.parseTailwindVariants(tvCall);
          }
          break;
        }

        // Add support for other frameworks here
        case 'stitches':
          // TODO: Implement Stitches support
          break;

        case 'vanilla-extract':
          // TODO: Implement Vanilla Extract support
          break;
      }
    }

    throw new Error(
      'Unsupported variants pattern - only Tailwind Variants (tv) is currently supported'
    );
  }

  // ==========================================
  // TAILWIND VARIANTS PARSING
  // ==========================================

  private findTailwindVariantsCall(node: ts.Node): ts.CallExpression | null {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'tv') {
        return node;
      }
    }

    let result: ts.CallExpression | null = null;
    ts.forEachChild(node, (child) => {
      if (!result) {
        result = this.findTailwindVariantsCall(child);
      }
    });

    return result;
  }

  private parseTailwindVariants(tvCall: ts.CallExpression): VariantInfo[] {
    const configObject = tvCall.arguments[0];
    if (!configObject || !ts.isObjectLiteralExpression(configObject)) {
      throw new Error('tv() first argument is not an object literal');
    }

    // Extract variants property
    const variantsProperty = this.findPropertyInObject(configObject, 'variants');
    if (!variantsProperty || !ts.isObjectLiteralExpression(variantsProperty)) {
      throw new Error('No variants property found in tv() config');
    }

    // Extract default variants if present
    const defaultVariants = this.findPropertyInObject(configObject, 'defaultVariants');
    const defaults = defaultVariants ? this.extractDefaultVariants(defaultVariants) : {};

    // Parse individual variant groups
    return this.parseVariantGroups(variantsProperty, defaults);
  }

  private findPropertyInObject(
    objectLiteral: ts.ObjectLiteralExpression,
    propertyName: string
  ): ts.Expression | null {
    for (const property of objectLiteral.properties) {
      if (ts.isPropertyAssignment(property)) {
        const propName = this.getObjectPropertyName(property);
        if (propName === propertyName) {
          return property.initializer;
        }
      }
    }
    return null;
  }

  /**
   * Helper method to extract property names from object literal properties
   */
  private getObjectPropertyName(property: ts.PropertyAssignment): string | null {
    return this.extractPropertyName(property.name);
  }

  /**
   * Helper method to extract property names from PropertyName nodes
   */
  private extractPropertyName(propertyName: ts.PropertyName): string | null {
    if (ts.isIdentifier(propertyName)) {
      return propertyName.text;
    }
    if (ts.isStringLiteral(propertyName)) {
      return propertyName.text;
    }
    if (ts.isNumericLiteral(propertyName)) {
      return propertyName.text;
    }
    if (ts.isComputedPropertyName(propertyName)) {
      // For computed property names like [key], we can't easily determine the name
      return null;
    }
    return null;
  }

  private extractDefaultVariants(defaultVariantsNode: ts.Expression): Record<string, string> {
    const defaults: Record<string, string> = {};

    if (ts.isObjectLiteralExpression(defaultVariantsNode)) {
      for (const property of defaultVariantsNode.properties) {
        if (ts.isPropertyAssignment(property)) {
          const key = this.extractPropertyName(property.name);
          const value = this.extractLiteralValue(property.initializer);

          if (key && value) {
            defaults[key] = value;
          }
        }
      }
    }

    return defaults;
  }

  private parseVariantGroups(
    variantsObject: ts.ObjectLiteralExpression,
    defaults: Record<string, string>
  ): VariantInfo[] {
    const variants: VariantInfo[] = [];

    for (const property of variantsObject.properties) {
      if (ts.isPropertyAssignment(property)) {
        const variantName = this.extractPropertyName(property.name);

        if (variantName && ts.isObjectLiteralExpression(property.initializer)) {
          const variantInfo = this.parseVariantGroup(
            variantName,
            property.initializer,
            defaults[variantName]
          );

          if (variantInfo) {
            variants.push(variantInfo);
            console.log(
              `   🎨 ${variantName}: [${variantInfo.values.join(', ')}]${variantInfo.defaultValue ? ` (default: ${variantInfo.defaultValue})` : ''}`
            );
          }
        }
      }
    }

    return variants;
  }

  private parseVariantGroup(
    variantName: string,
    variantObject: ts.ObjectLiteralExpression,
    defaultValue?: string
  ): VariantInfo | null {
    const values: string[] = [];
    const examples: VariantInfo['examples'] = [];

    // Extract variant values from object keys
    for (const property of variantObject.properties) {
      if (ts.isPropertyAssignment(property)) {
        const variantValue = this.extractPropertyName(property.name);
        if (variantValue) {
          values.push(variantValue);

          // Extract example classes if available
          const classes = this.extractVariantClasses(property.initializer);
          if (classes) {
            examples.push({
              value: variantValue,
              label: variantValue,
              description: `${variantName} variant with value "${variantValue}"`,
              code: `<Component ${variantName}="${variantValue}" />`
            });
          }
        }
      } else if (ts.isShorthandPropertyAssignment(property)) {
        values.push(property.name.text);
      } else if (ts.isMethodDeclaration(property) && ts.isIdentifier(property.name)) {
        values.push(property.name.text);
      }
    }

    if (values.length === 0) {
      return null;
    }

    // Sort values for consistency
    values.sort();

    const variantInfo: VariantInfo = {
      name: variantName,
      values,
      examples: examples.length > 0 ? examples : []
    };

    if (defaultValue) {
      variantInfo.defaultValue = defaultValue;
    }

    return variantInfo;
  }

  private extractVariantClasses(initializer: ts.Expression): string | null {
    if (ts.isStringLiteral(initializer)) {
      return initializer.text;
    }

    if (ts.isArrayLiteralExpression(initializer)) {
      const classes = initializer.elements
        .filter(ts.isStringLiteral)
        .map((element) => element.text)
        .join(' ');
      return classes || null;
    }

    return null;
  }

  private extractLiteralValue(node: ts.Expression): string | null {
    if (ts.isStringLiteral(node)) {
      return node.text;
    }
    if (ts.isNumericLiteral(node)) {
      return node.text;
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return 'true';
    }
    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return 'false';
    }
    return null;
  }

  /**
   * Clear any caches
   */
  clearCache(): void {
    // No persistent cache in this implementation
  }
}
