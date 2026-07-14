import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as ts from 'typescript';
import { BaseExtractor } from '../BaseExtractor';
import { getProgramBundle } from './ProgramCache';

/**
 * TypeScript-specific base extractor with TypeScript program management.
 *
 * With a `configPath` in its config, the extractor is backed by the shared
 * per-tsconfig `ts.Program` (see ProgramCache) and can resolve types across
 * files via `resolveCrossFileDeclaration`. Without one it falls back to the
 * historical single-file mode (empty program + isolated source files).
 */
export abstract class TypeScriptBaseExtractor<
  TInput = unknown,
  TOutput = unknown
> extends BaseExtractor<TInput, TOutput> {
  protected program: ts.Program;
  protected checker: ts.TypeChecker;
  protected compilerOptions: ts.CompilerOptions;
  /** Package root (tsconfig directory) when program-backed, else null. */
  protected packageRoot: string | null = null;

  constructor(tsConfig?: { configPath?: string } | Record<string, unknown>) {
    super(tsConfig);
    this.program = this.initializeProgram(tsConfig);
    this.checker = this.program.getTypeChecker();
    this.compilerOptions = this.program.getCompilerOptions();
  }

  // ==========================================
  // TYPESCRIPT UTILITIES
  // ==========================================

  /**
   * Get or create source file from path. Returns null when the file
   * does not exist or fails to load — most callers probe several
   * candidate paths in sequence (variants files, inheritance lookups),
   * so we stay silent on miss. Real failures are surfaced through the
   * caller's null-check + `handleError` path.
   */
  protected async getSourceFile(filePath: string): Promise<ts.SourceFile | null> {
    let sourceFile = this.program.getSourceFile(path.resolve(filePath));

    if (!sourceFile) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
      } catch (_error) {
        return null;
      }
    }

    return sourceFile;
  }

  /**
   * Find interface by name in source file
   */
  protected findInterface(
    sourceFile: ts.SourceFile,
    interfaceName: string
  ): ts.InterfaceDeclaration | null {
    let foundInterface: ts.InterfaceDeclaration | null = null;

    const visit = (node: ts.Node): void => {
      if (ts.isInterfaceDeclaration(node) && node.name?.text === interfaceName) {
        foundInterface = node;
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return foundInterface;
  }

  protected findTypeAlias(
    sourceFile: ts.SourceFile,
    typeName: string
  ): ts.TypeAliasDeclaration | null {
    let found: ts.TypeAliasDeclaration | null = null;

    const visit = (node: ts.Node): void => {
      if (ts.isTypeAliasDeclaration(node) && node.name?.text === typeName) {
        found = node;
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return found;
  }

  /**
   * Extract JSDoc comment from node
   */
  protected extractJSDocComment(node: ts.Node): string | null {
    const jsDocTags = ts.getJSDocCommentsAndTags(node);
    for (const tag of jsDocTags) {
      if (ts.isJSDoc(tag) && tag.comment) {
        return this.getCommentText(tag.comment);
      }
    }
    return null;
  }

  /**
   * Extract JSDoc tag value (e.g., @default, @example)
   */
  protected extractJSDocTag(node: ts.Node, tagName: string): string | undefined {
    const jsDocTags = ts.getJSDocTags(node);
    for (const tag of jsDocTags) {
      if (tag.tagName.text === tagName && tag.comment) {
        return this.getCommentText(tag.comment);
      }
    }
    return undefined;
  }

  /**
   * Extract all values of a repeated JSDoc tag (e.g., multiple @tag or @related)
   */
  protected extractJSDocTagAll(node: ts.Node, tagName: string): string[] {
    const jsDocTags = ts.getJSDocTags(node);
    const results: string[] = [];
    for (const tag of jsDocTags) {
      if (tag.tagName.text === tagName && tag.comment) {
        results.push(this.getCommentText(tag.comment));
      }
    }
    return results;
  }

  /**
   * Get type string from type node
   */
  protected getTypeString(typeNode: ts.TypeNode | undefined): string {
    if (!typeNode) return 'any';

    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.map((t) => this.getTypeString(t)).join(' | ');
    }

    if (ts.isLiteralTypeNode(typeNode)) {
      if (ts.isStringLiteral(typeNode.literal)) {
        return `'${typeNode.literal.text}'`;
      }
      if (ts.isNumericLiteral(typeNode.literal)) {
        return typeNode.literal.text;
      }
      if (typeNode.literal.kind === ts.SyntaxKind.TrueKeyword) return 'true';
      if (typeNode.literal.kind === ts.SyntaxKind.FalseKeyword) return 'false';
    }

    if (ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText();
      if (typeNode.typeArguments) {
        const args = typeNode.typeArguments.map((arg) => this.getTypeString(arg)).join(', ');
        return `${typeName}<${args}>`;
      }
      return typeName;
    }

    return typeNode.getText();
  }

  /**
   * Extract string/number/boolean literal values from a type node. Handles
   * both single literals (`'dot'`) and unions of literals (`'a' | 'b'`).
   * Returns an empty array for anything else.
   */
  protected extractUnionValues(typeNode: ts.TypeNode): string[] {
    const collect = (node: ts.TypeNode): string[] => {
      if (ts.isLiteralTypeNode(node)) {
        if (ts.isStringLiteral(node.literal)) return [node.literal.text];
        if (ts.isNumericLiteral(node.literal)) return [node.literal.text];
        if (node.literal.kind === ts.SyntaxKind.TrueKeyword) return ['true'];
        if (node.literal.kind === ts.SyntaxKind.FalseKeyword) return ['false'];
      }
      return [];
    };

    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.flatMap(collect);
    }
    return collect(typeNode);
  }

  /**
   * Check if property is required (no question token)
   */
  protected isPropertyRequired(member: ts.PropertySignature): boolean {
    return !member.questionToken;
  }

  /**
   * Get property name from property signature
   */
  protected getPropertyName(member: ts.PropertySignature): string | null {
    if (!member.name) {
      return null;
    }
    if (ts.isIdentifier(member.name)) {
      return member.name.text;
    }
    if (ts.isStringLiteral(member.name)) {
      return member.name.text;
    }
    if (ts.isNumericLiteral(member.name)) {
      return member.name.text;
    }
    return null;
  }

  /**
   * Get comment text from JSDoc comment
   */
  protected getCommentText(comment: string | ts.NodeArray<ts.JSDocComment>): string {
    if (typeof comment === 'string') {
      return comment.trim();
    }
    return comment
      .map((part) => (typeof part === 'string' ? part : part.text || ''))
      .join('')
      .trim();
  }

  /**
   * Update TypeScript program with new files (useful for watch mode)
   */
  updateProgram(newFiles: string[]): void {
    this.program = ts.createProgram(newFiles, this.compilerOptions);
    this.checker = this.program.getTypeChecker();
  }

  /**
   * Get program for advanced usage
   */
  getProgram(): ts.Program {
    return this.program;
  }

  /**
   * Get type checker for advanced usage
   */
  getChecker(): ts.TypeChecker {
    return this.checker;
  }

  // ==========================================
  // PRIVATE UTILITIES
  // ==========================================

  private initializeProgram(
    tsConfig?: { configPath?: string } | Record<string, unknown>
  ): ts.Program {
    const config = tsConfig as { configPath?: string } | undefined;
    if (config?.configPath) {
      // Shared per-tsconfig bundle; throws loudly on a missing/broken
      // tsconfig — a *set* configPath must never silently degrade to the
      // single-file mode (that's how cross-file types vanish unnoticed).
      const bundle = getProgramBundle(config.configPath);
      this.packageRoot = bundle.packageRoot;
      return bundle.program;
    }

    // No configPath: documented single-file fallback (tests, ad-hoc usage).
    const defaultOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      allowJs: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: false, // More lenient for documentation extraction
      noEmit: true
    };

    return ts.createProgram([], defaultOptions);
  }

  // ==========================================
  // CROSS-FILE TYPE RESOLUTION
  // ==========================================

  /**
   * Resolve an identifier / entity name to the type declaration it refers
   * to — across files, through import aliases and barrel re-exports — via
   * the shared program's checker. Returns null when the extractor runs in
   * single-file mode, the node is not program-backed, or the symbol does
   * not resolve to an interface / type alias / enum / class declaration.
   */
  protected resolveCrossFileDeclaration(
    node: ts.Node
  ):
    | ts.InterfaceDeclaration
    | ts.TypeAliasDeclaration
    | ts.EnumDeclaration
    | ts.ClassDeclaration
    | null {
    try {
      const symbol = this.checker.getSymbolAtLocation(node);
      if (!symbol) return null;
      const resolved =
        symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
      for (const decl of resolved.declarations ?? []) {
        if (
          ts.isInterfaceDeclaration(decl) ||
          ts.isTypeAliasDeclaration(decl) ||
          ts.isEnumDeclaration(decl) ||
          ts.isClassDeclaration(decl)
        ) {
          return decl;
        }
      }
      return null;
    } catch {
      // Node not part of this program (isolated source file) — single-file
      // mode simply has no cross-file answers.
      return null;
    }
  }

  /**
   * Like resolveCrossFileDeclaration, narrowed to interfaces declared inside
   * the package's own sources (never node_modules / other packages), so
   * heritage expansion stays scoped to the package being documented.
   */
  protected resolveCrossFileInterface(node: ts.Node): ts.InterfaceDeclaration | null {
    const decl = this.resolveCrossFileDeclaration(node);
    if (!decl || !ts.isInterfaceDeclaration(decl)) return null;
    if (!this.isInPackageSources(decl.getSourceFile())) return null;
    return decl;
  }

  /**
   * Resolve the base type of an `Omit<Base, Keys>` heritage clause across
   * files: `Base` is the first type argument; when it is a plain type
   * reference, follow it through the shared program to its interface
   * declaration inside the package sources. Null in single-file mode or for
   * non-reference bases (intersections, literals, externals).
   */
  protected resolveOmitBaseInterface(
    heritageType: ts.ExpressionWithTypeArguments
  ): ts.InterfaceDeclaration | null {
    const baseArg = heritageType.typeArguments?.[0];
    if (!baseArg || !ts.isTypeReferenceNode(baseArg)) return null;
    return this.resolveCrossFileInterface(baseArg.typeName);
  }

  /**
   * Whether a source file belongs to the documented package's own sources
   * (under the tsconfig directory, outside node_modules). Always false in
   * single-file mode.
   */
  protected isInPackageSources(sourceFile: ts.SourceFile): boolean {
    if (!this.packageRoot) return false;
    const fileName = path.resolve(sourceFile.fileName);
    return (
      fileName.startsWith(`${this.packageRoot}${path.sep}`) &&
      !fileName.includes(`${path.sep}node_modules${path.sep}`)
    );
  }
}
