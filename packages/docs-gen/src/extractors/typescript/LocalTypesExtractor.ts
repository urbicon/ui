import * as path from 'node:path';
import * as ts from 'typescript';
import type { TypeDefinition } from '../../types';
import { TypeScriptBaseExtractor } from './TypeScriptBaseExtractor';

interface LocalTypesExtractionInput {
  filePath: string;
  componentName: string;
  packageName: string;
}

type SupportedTypeDeclaration =
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration
  | ts.ClassDeclaration;

/** Hard ceilings for the imported-types pass so a hub file like $lib/utils
 *  can never flood a component's type reference. */
const MAX_IMPORTED_TYPE_DEPTH = 2;
const MAX_TYPES_PER_COMPONENT = 40;

/**
 * Extracts exported local type/interface definitions from a component's index.ts file.
 * Focus: concrete business-relevant types (e.g., MenuItemType, MenuObjectOption, ...)
 *
 * When the extractor is program-backed (configPath set), a second pass
 * resolves the file's *type-only imports* (`import type { GuideTour } from
 * '$lib/utils'`) through the shared ts.Program to their declarations inside
 * the package sources and includes those too (scope: 'imported'), following
 * type references transitively up to a bounded depth — so e.g. GuideTour
 * pulls in GuideStep and its analytics event payloads. Classes are rendered
 * as a public-signature summary. Without a program this pass is a no-op and
 * behavior matches the historical single-file extraction.
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

      // cross-file: type-only imports resolved through the shared program
      this.collectImportedTypes(sourceFile, typeDefs, input.packageName, input.componentName);

      return this.createSuccessResult(typeDefs, [], input.filePath, Date.now() - start);
    } catch (error) {
      return this.handleError(error, input);
    }
  }

  // ==========================================
  // IMPORTED TYPES (cross-file, program-backed)
  // ==========================================

  private collectImportedTypes(
    sourceFile: ts.SourceFile,
    out: TypeDefinition[],
    packageName: string,
    componentName: string
  ): void {
    // Only meaningful with a real program; single-file mode has no imports
    // to follow (and its nodes carry no symbols).
    if (!this.packageRoot) return;

    const componentFile = path.resolve(sourceFile.fileName);
    const existing = new Set(out.map((t) => t.name));
    const visited = new Set<string>();
    const queue: Array<{ decl: SupportedTypeDeclaration; depth: number }> = [];

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
      const clause = statement.importClause;
      if (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
      for (const element of clause.namedBindings.elements) {
        // Value imports (functions, tv configs, …) are deliberately not
        // documented as types — only `import type` / `{ type X }` bindings.
        if (!clause.isTypeOnly && !element.isTypeOnly) continue;
        const decl = this.resolveCrossFileDeclaration(element.name);
        if (decl) queue.push({ decl, depth: 0 });
      }
    }

    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      const { decl, depth } = entry;
      const declSourceFile = decl.getSourceFile();

      // Package sources only — svelte/elements etc. stay opaque references.
      if (!this.isInPackageSources(declSourceFile)) continue;
      // The component's own file (and its collected names) are the local
      // pass's business — don't re-emit them as imported.
      if (path.resolve(declSourceFile.fileName) === componentFile) continue;

      const name = decl.name?.text;
      if (!name) continue;
      const key = `${declSourceFile.fileName}#${name}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (existing.has(name)) continue;

      if (out.length >= MAX_TYPES_PER_COMPONENT) {
        console.warn(
          `⚠️  ${componentName}: imported-type collection capped at ${MAX_TYPES_PER_COMPONENT} definitions`
        );
        break;
      }

      const typeDef = this.toTypeDefinition(decl, declSourceFile, packageName);
      if (typeDef) {
        out.push(typeDef);
        existing.add(name);
      }

      if (depth < MAX_IMPORTED_TYPE_DEPTH) {
        for (const referenced of this.collectReferencedDeclarations(decl)) {
          queue.push({ decl: referenced, depth: depth + 1 });
        }
      }
    }
  }

  private toTypeDefinition(
    decl: SupportedTypeDeclaration,
    declSourceFile: ts.SourceFile,
    packageName: string
  ): TypeDefinition | null {
    const name = decl.name?.text;
    if (!name) return null;

    const documentation = this.extractJSDocComment(decl) || '';
    const base = {
      name,
      package: packageName,
      documentation,
      ...this.extractSeeTags(decl),
      scope: 'imported' as const,
      sourcePath: this.toRepoRelativePath(declSourceFile.fileName)
    };

    if (ts.isTypeAliasDeclaration(decl)) {
      return { ...base, type: 'type', definition: decl.type?.getText() || 'unknown' };
    }
    if (ts.isInterfaceDeclaration(decl)) {
      const body = decl.members?.length
        ? declSourceFile.text.slice(decl.members.pos, decl.members.end)
        : ' {}';
      return {
        ...base,
        type: 'interface',
        definition: body.trim(),
        members: decl.members?.length ?? 0
      };
    }
    if (ts.isEnumDeclaration(decl)) {
      const body = decl.members?.length
        ? declSourceFile.text.slice(decl.members.pos, decl.members.end)
        : '';
      return { ...base, type: 'enum', definition: body.trim(), members: decl.members?.length ?? 0 };
    }
    // Class: public-signature summary (methods/accessors without bodies,
    // properties without initializers) — the full engine body is noise.
    return {
      ...base,
      type: 'class',
      definition: this.renderClassSignature(decl, declSourceFile),
      members: decl.members.filter((m) => this.isPublicClassMember(m)).length
    };
  }

  private renderClassSignature(cls: ts.ClassDeclaration, sourceFile: ts.SourceFile): string {
    const lines: string[] = [];
    for (const member of cls.members) {
      if (!this.isPublicClassMember(member)) continue;

      let end: number;
      if (
        (ts.isMethodDeclaration(member) ||
          ts.isConstructorDeclaration(member) ||
          ts.isGetAccessorDeclaration(member) ||
          ts.isSetAccessorDeclaration(member)) &&
        member.body
      ) {
        end = member.body.getFullStart();
      } else if (ts.isPropertyDeclaration(member) && member.initializer) {
        end = member.type ? member.type.getEnd() : member.name.getEnd();
      } else {
        end = member.getEnd();
      }

      const signature = sourceFile.text
        .slice(member.getStart(sourceFile), end)
        .trim()
        .replace(/[;,]?\s*$/, '');
      if (signature) lines.push(`  ${signature};`);
    }
    return lines.join('\n');
  }

  private isPublicClassMember(member: ts.ClassElement): boolean {
    if (member.name && ts.isPrivateIdentifier(member.name)) return false;
    if (ts.canHaveModifiers(member)) {
      const modifiers = ts.getModifiers(member) ?? [];
      if (
        modifiers.some(
          (m) =>
            m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword
        )
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Type declarations referenced from a collected declaration — the
   * transitive edge of the imported-types pass. For classes, only the
   * public signature surface is walked (member/parameter/return types),
   * never method bodies, so internal state types stay private.
   */
  private collectReferencedDeclarations(
    decl: SupportedTypeDeclaration
  ): SupportedTypeDeclaration[] {
    const roots: ts.Node[] = [];
    if (ts.isClassDeclaration(decl)) {
      for (const member of decl.members) {
        if (!this.isPublicClassMember(member)) continue;
        if (ts.isPropertyDeclaration(member) && member.type) roots.push(member.type);
        if (
          ts.isMethodDeclaration(member) ||
          ts.isConstructorDeclaration(member) ||
          ts.isGetAccessorDeclaration(member) ||
          ts.isSetAccessorDeclaration(member)
        ) {
          for (const param of member.parameters) {
            if (param.type) roots.push(param.type);
          }
          if (member.type) roots.push(member.type);
        }
      }
    } else {
      roots.push(decl);
    }

    const found: SupportedTypeDeclaration[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
        const resolved = this.resolveCrossFileDeclaration(node.typeName);
        if (resolved) found.push(resolved);
      }
      ts.forEachChild(node, visit);
    };
    for (const root of roots) visit(root);
    return found;
  }

  private collectExportedTypesFromSource(
    sourceFile: ts.SourceFile,
    out: TypeDefinition[],
    packageName: string
  ): void {
    const existing = new Set(out.map((t) => t.name));
    const sourcePath = this.toRepoRelativePath(sourceFile.fileName);
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
          documentation: this.extractJSDocComment(node) || '',
          ...this.extractSeeTags(node),
          sourcePath
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
          documentation: this.extractJSDocComment(node) || '',
          ...this.extractSeeTags(node),
          members: node.members?.length ?? 0,
          sourcePath
        });
        existing.add(name);
      }
    });
  }

  /**
   * Repo-relative path of a declaring file for the oversize summary: from
   * the `packages/` segment when present, else relative to the package root,
   * else the basename (synthetic test fixtures).
   */
  private toRepoRelativePath(fileName: string): string {
    const resolved = path.resolve(fileName);
    const marker = `${path.sep}packages${path.sep}`;
    const idx = resolved.indexOf(marker);
    if (idx >= 0) return resolved.slice(idx + 1);
    if (this.packageRoot && resolved.startsWith(`${this.packageRoot}${path.sep}`)) {
      return path.relative(this.packageRoot, resolved);
    }
    return path.basename(resolved);
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
