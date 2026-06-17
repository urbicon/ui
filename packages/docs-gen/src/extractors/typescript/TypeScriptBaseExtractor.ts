import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as ts from 'typescript';
import { BaseExtractor } from '../BaseExtractor';

/**
 * TypeScript-specific base extractor with TypeScript program management
 */
export abstract class TypeScriptBaseExtractor<
  TInput = unknown,
  TOutput = unknown
> extends BaseExtractor<TInput, TOutput> {
  protected program: ts.Program;
  protected checker: ts.TypeChecker;
  protected compilerOptions: ts.CompilerOptions;

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
    let sourceFile = this.program.getSourceFile(filePath);

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
      try {
        const configFile = ts.readConfigFile(config.configPath, ts.sys.readFile);
        if (!configFile.error) {
          const compilerOptions = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            path.dirname(config.configPath)
          );
          if (compilerOptions.errors.length === 0) {
            return ts.createProgram(compilerOptions.fileNames, compilerOptions.options);
          }
        }
      } catch (_error) {
        console.warn('⚠️  Could not load TypeScript config, using defaults');
      }
    }

    // Default TypeScript configuration
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
}
