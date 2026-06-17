import * as path from 'node:path';
import * as ts from 'typescript';
import type { TypeDefinition } from '../../types';
import { TypeScriptBaseExtractor } from './TypeScriptBaseExtractor';

interface LocalTypesExtractionInput {
  filePath: string;
  componentName: string;
  packageName: string;
}

/**
 * Extracts exported local type/interface definitions from a component's index.ts file.
 * Focus: concrete business-relevant types (e.g., MenuItemType, MenuObjectOption, ...)
 * Does not follow re-exports in this first iteration.
 */
export class LocalTypesExtractor extends TypeScriptBaseExtractor<
  LocalTypesExtractionInput,
  TypeDefinition[]
> {
  async extract(input: LocalTypesExtractionInput) {
    const start = Date.now();
    try {
      const sourceFile = await this.getSourceFile(input.filePath);
      if (!sourceFile) {
        return this.createSuccessResult([], [], input.filePath, Date.now() - start);
      }

      const typeDefs: TypeDefinition[] = [];

      // collect from component index/source file
      this.collectExportedTypesFromSource(sourceFile, typeDefs, input.packageName);

      // optionally collect types from variants file (e.g., menu.variants.ts)
      const variantsFilePath = await this.findVariantsFile(input.filePath, input.componentName);
      if (variantsFilePath) {
        const variantsSource = await this.getSourceFile(variantsFilePath);
        if (variantsSource) {
          this.collectExportedTypesFromSource(variantsSource, typeDefs, input.packageName);
        }
      }

      return this.createSuccessResult(typeDefs, [], input.filePath, Date.now() - start);
    } catch (error) {
      return this.handleError(error, input);
    }
  }

  private collectExportedTypesFromSource(
    sourceFile: ts.SourceFile,
    out: TypeDefinition[],
    packageName: string
  ): void {
    const existing = new Set(out.map((t) => t.name));
    sourceFile.forEachChild((node) => {
      // type alias: export type Name = ...
      if (ts.isTypeAliasDeclaration(node) && this.hasExportModifier(node)) {
        const name = node.name?.getText() || '';
        if (!name || existing.has(name)) return;
        const rhs = node.type?.getText() || 'unknown';
        out.push({
          name,
          type: 'type',
          definition: rhs,
          package: packageName,
          documentation: this.extractJSDocComment(node) || ''
        });
        existing.add(name);
      }

      // interface: export interface Name { ... }
      if (ts.isInterfaceDeclaration(node) && this.hasExportModifier(node)) {
        const name = node.name?.getText() || '';
        if (!name || existing.has(name)) return;
        const body = node.members?.length
          ? sourceFile.text.slice(node.members.pos, node.members.end)
          : ' {}';
        out.push({
          name,
          type: 'interface',
          definition: body.trim(),
          package: packageName,
          documentation: this.extractJSDocComment(node) || ''
        });
        existing.add(name);
      }
    });
  }

  private hasExportModifier(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    const modifiers = ts.getModifiers(node);
    return (modifiers ?? []).some((m: ts.ModifierLike) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  private async findVariantsFile(
    componentFilePath: string,
    componentName: string
  ): Promise<string | null> {
    const dir = path.dirname(componentFilePath);
    const patterns = [
      `${componentName.toLowerCase()}.variants.ts`,
      `${componentName}.variants.ts`,
      'variants.ts',
      `${componentName.toLowerCase()}.variants.js`,
      `${componentName}.variants.js`
    ];
    for (const p of patterns) {
      const candidate = path.join(dir, p);
      try {
        const sf = await this.getSourceFile(candidate);
        if (sf) return candidate;
      } catch {
        // ignore
      }
    }
    return null;
  }
}
