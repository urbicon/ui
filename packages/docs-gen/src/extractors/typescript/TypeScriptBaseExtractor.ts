import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as ts from 'typescript';
import { BaseExtractor } from '../BaseExtractor';
import { getProgramBundle } from './ProgramCache';

/**
 * One member of a heritage clause resolved through the type checker.
 *
 * `declaration` is set only when the member traces back to a real
 * `PropertySignature` — then the caller can read its JSDoc as usual. Members
 * that originate in a tv() config have none: `VariantProps<typeof
 * buttonVariants>` maps `variant` onto a `PropertyAssignment` in
 * `button.variants.ts`, which carries no prop documentation. For those,
 * `type` and `values` are everything that is knowable.
 */
export interface ResolvedHeritageMember {
  name: string;
  declaration: ts.PropertySignature | null;
  /** Declared with a `?` (or otherwise optional through the mapped type). */
  optional: boolean;
  /** Literal union members, `[]` when the type is not a literal union. */
  values: string[];
  /** Rendered type, in the same spelling the rest of the pipeline emits. */
  type: string;
}

/**
 * The description a prop gets when its declaration carries no JSDoc at all. One
 * definition, so a surface that must recognise the stand-in (the catalog's
 * `propDocs` leaves it out — a name restated says nothing the name does not)
 * cannot drift from the two extractors that emit it.
 */
export function noJsDocDescription(propName: string): string {
  return `${propName} property`;
}

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
  /**
   * Names reachable from the package's public entry points, or null when the
   * surface is unknown (single-file mode, or a package root with no typed
   * entry). Shared per program — see `ProgramBundle.publicExportNames`.
   */
  protected publicExportNames: ReadonlySet<string> | null = null;

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
   * Extract all values of a repeated JSDoc tag (e.g., multiple @tag or @related).
   *
   * Single-value tags only. TypeScript attaches every line that follows a tag to
   * that tag's comment, so free prose written *after* the tag block lands inside
   * the last tag's value — `@related Toast` followed by a paragraph shipped
   * `"Toast\n\nBadge props are a discriminated union…"` as one related component
   * name into the MCP catalogue, `llm.txt` and the docs site. The value is
   * therefore the first line; anything beyond it is prose in the wrong place and
   * says so, rather than being folded in silently.
   */
  protected extractJSDocTagAll(node: ts.Node, tagName: string): string[] {
    const jsDocTags = ts.getJSDocTags(node);
    const results: string[] = [];
    for (const tag of jsDocTags) {
      if (tag.tagName.text !== tagName || !tag.comment) continue;
      const raw = this.getCommentText(tag.comment);
      // `split` always yields at least one element, but not to the type
      // checker under noUncheckedIndexedAccess — and '' is what the empty case
      // would produce anyway.
      const [first = '', ...rest] = raw.split('\n');
      const trailing = rest.join('\n').trim();
      if (trailing) {
        console.warn(
          `⚠️  @${tagName} "${first.trim()}" is followed by prose in the same JSDoc block — ` +
            'move that text above the tags, or it is dropped. ' +
            `Dropped: "${trailing.slice(0, 60)}${trailing.length > 60 ? '…' : ''}"`
        );
      }
      results.push(first.trim());
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
      .map((part) => {
        if (typeof part === 'string') return part;
        // `{@link Target}` arrives as its own node whose `.text` holds only the
        // optional display text — the target itself lives in `.name`. Reading
        // `.text` alone dropped the link without a trace, leaving holes in the
        // published prose ("debounced by  — on each query change").
        if (ts.isJSDocLink(part) || ts.isJSDocLinkCode(part) || ts.isJSDocLinkPlain(part)) {
          return this.formatJSDocLink(part);
        }
        return part.text || '';
      })
      .join('')
      .trim();
  }

  /** Renders a `{@link …}` node back to readable text (display text, else the target as code). */
  private formatJSDocLink(link: ts.JSDocLink | ts.JSDocLinkCode | ts.JSDocLinkPlain): string {
    // The split between `.name` and `.text` is not the split between target and
    // display text: for `{@link https://example.test/x label}` TypeScript parses
    // `https` as the name and leaves `://example.test/x label` as the text. Glue
    // them back together first, then separate on the real delimiter.
    const target = link.name ? TypeScriptBaseExtractor.entityNameToString(link.name) : '';
    const raw = `${target}${link.text ?? ''}`.trim();
    if (!raw) return '';

    const [, destination, display = ''] = raw.match(/^([^\s|]+)\s*\|?\s*([\s\S]*)$/) ?? [];
    if (!destination) return '';
    if (display.trim()) return display.trim();

    // A bare URL or path stays as-is; a symbol name reads better as code.
    return /^(https?:\/\/|\/|#)/.test(destination) ? destination : `\`${destination}\``;
  }

  /** `Foo`, `Foo.bar`, `Foo#bar` — without touching the source text of synthetic nodes. */
  private static entityNameToString(name: ts.EntityName | ts.JSDocMemberName): string {
    if (ts.isIdentifier(name)) return name.text;
    if (ts.isQualifiedName(name)) {
      return `${TypeScriptBaseExtractor.entityNameToString(name.left)}.${name.right.text}`;
    }
    // JSDocMemberName — `Class#member`
    return `${TypeScriptBaseExtractor.entityNameToString(name.left)}#${name.right.text}`;
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
      this.publicExportNames = bundle.publicExportNames;
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
   * The base type argument of a generic heritage clause (`Pick<Base, K>`,
   * `Omit<Base, K>`) as written, or null when the clause takes no arguments.
   * Reading `typeArguments[0]` instead of regexing `getText()` is what keeps
   * `Omit<Record<string, number>, 'a'>`-shaped bases from being cut at their
   * first comma.
   */
  protected heritageBaseTypeText(heritageType: ts.ExpressionWithTypeArguments): string | null {
    const baseArg = heritageType.typeArguments?.[0];
    return baseArg ? baseArg.getText().trim() : null;
  }

  /**
   * The key argument of a key-filtering heritage clause (`Pick<B, K>` /
   * `Omit<B, K>`) as written — `'a' | 'b'`, `keyof XVariants`, …
   */
  protected heritageKeyArgText(heritageType: ts.ExpressionWithTypeArguments): string {
    return heritageType.typeArguments?.[1]?.getText().trim() ?? '';
  }

  /**
   * The keys a key-filtering heritage clause (`Omit<B, K>` / `Pick<B, K>`)
   * names, as the checker resolves `K`.
   *
   * Only *some* spellings of `K` list their members at the use site. `keyof U`,
   * a union alias and an `Exclude<…>` each name them somewhere else, so reading
   * quoted words out of the written argument finds nothing and the clause reads
   * as filtering nothing — which is how `Omit<PlannerVariants, 'view' | keyof
   * PlannerCellState>` published four props `svelte-check` rejects. Asking the
   * checker for `K` is one question that covers every spelling, including the
   * ones nobody has written yet.
   *
   * Null, never an empty set, when there is no answer to delegate to: this node
   * is not in a program, or `K` is not a union of literals (an unresolved
   * reference widens to `keyof any`). The caller then reads the written text
   * instead — which recovers the literal keys, and only those: for `keyof U`
   * the fallback does report a clause that filters nothing, and the
   * `Omit<Interface, keyof *Variants>` branch keeps its own net for that.
   *
   * The precondition is this node's own binding, not that a package root was
   * configured — a file outside the tsconfig's `include` has the latter without
   * the former, and the checker then answers from a synthesised, unbound source
   * file. Measured on such a fixture: `keyof GridCellState` yielded nothing,
   * only the written `'view'` was suppressed, and `success` stayed true with no
   * warning. Identity, not a path match, because a second parse of the same
   * path is exactly the unbound case.
   */
  protected resolveHeritageKeyLiterals(
    heritageType: ts.ExpressionWithTypeArguments
  ): Set<string> | null {
    const sourceFile = heritageType.getSourceFile();
    if (this.program.getSourceFile(sourceFile.fileName) !== sourceFile) return null;
    const keyArg = heritageType.typeArguments?.[1];
    if (!keyArg) return null;
    try {
      const literals = TypeScriptBaseExtractor.literalMembersOfType(
        this.checker.getTypeFromTypeNode(keyArg)
      );
      return literals.length > 0 ? new Set(literals.map((l) => l.value)) : null;
    } catch {
      // The out-of-program case is the guard's above; what is left here is a
      // type reference the checker cannot make sense of at all.
      return null;
    }
  }

  /**
   * TypeScript's built-in type transformers. Named individually rather than
   * detected structurally because the point is narrow: a heritage clause whose
   * *expression* is one of these describes its base, never itself, so no
   * fallback may ever name a prop after it.
   */
  private static readonly UTILITY_TYPE_NAMES = new Set([
    'Pick',
    'Omit',
    'Partial',
    'Required',
    'Readonly',
    'Record',
    'Extract',
    'Exclude',
    'NonNullable'
  ]);

  protected static isUtilityTypeName(typeName: string): boolean {
    return TypeScriptBaseExtractor.UTILITY_TYPE_NAMES.has(typeName);
  }

  /**
   * Expand a heritage clause the syntactic paths cannot name — `Pick<X, K>`
   * above all — into its members, via the shared program's checker.
   *
   * This is the only route that sees through a tv() variant alias: the five
   * members of `Pick<ButtonProps, 'variant' | 'intent' | 'size' | 'tier' |
   * 'disabled'>` live in three different places (four `PropertyAssignment`s in
   * `button.variants.ts`, one `PropertySignature` in `Button/index.ts`), and
   * only the checker joins them. Purely syntactic resolution of the same clause
   * finds `disabled` and silently loses the other four.
   *
   * Returns null in single-file mode (no real program), for clauses the checker
   * cannot resolve, and for anything that resolves to zero properties — the
   * caller then falls back to its syntactic path rather than reporting an empty
   * heritage.
   */
  protected resolveHeritageMembersViaChecker(
    heritageType: ts.ExpressionWithTypeArguments
  ): ResolvedHeritageMember[] | null {
    if (!this.packageRoot) return null; // single-file mode: no program, no checker
    try {
      const type = this.checker.getTypeAtLocation(heritageType);
      if (!type) return null;
      const members: ResolvedHeritageMember[] = [];
      for (const symbol of this.checker.getPropertiesOfType(type)) {
        const declaration = symbol.declarations?.find(ts.isPropertySignature) ?? null;
        const propertyType = this.checker.getTypeOfSymbolAtLocation(symbol, heritageType);
        const literals = TypeScriptBaseExtractor.literalMembersOfType(propertyType);
        members.push({
          name: symbol.name,
          declaration,
          optional: (symbol.flags & ts.SymbolFlags.Optional) !== 0,
          values: literals.map((l) => l.value),
          // Same spelling the variants pass emits (`'sm' | 'md' | 'lg'`), so a
          // picked tv() axis and the same axis taken from the tv() config read
          // identically in the API table.
          type:
            literals.length > 0
              ? literals.map((l) => (l.quoted ? `'${l.value}'` : l.value)).join(' | ')
              : this.checker
                  .typeToString(propertyType)
                  .replace(/\s*\|\s*undefined$/, '')
                  .trim()
        });
      }
      return members.length > 0 ? members : null;
    } catch {
      // Node not part of this program, or an unresolvable type reference.
      return null;
    }
  }

  /**
   * String / number literal members of a (possibly union) type, minus
   * `undefined` and `null`.
   *
   * `[]` for anything that is not a pure literal union: a `boolean` prop must
   * not be reported as the enumerable two-value union `true | false`, which is
   * how TypeScript represents it internally — that would turn every boolean
   * into a dropdown. tv() axes keyed `{ true: …, false: … }` are unaffected:
   * `VariantProps` maps them to the *string* literals `'true' | 'false'`.
   */
  private static literalMembersOfType(type: ts.Type): Array<{ value: string; quoted: boolean }> {
    const parts = type.isUnion() ? type.types : [type];
    const literals: Array<{ value: string; quoted: boolean }> = [];
    for (const part of parts) {
      if (part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) continue;
      if (part.isStringLiteral()) {
        literals.push({ value: part.value, quoted: true });
        continue;
      }
      if (part.isNumberLiteral()) {
        literals.push({ value: String(part.value), quoted: false });
        continue;
      }
      return [];
    }
    return literals;
  }

  /**
   * Split a declaration's `@see` tags into the two jobs the tag actually
   * serves: navigable link targets and prose references.
   *
   * Lives on the base rather than on PropsExtractor because prop members and
   * *type* declarations need the identical rule — and a second hand-aligned
   * copy is exactly how the four `toSlug` copies drifted apart.
   *
   * `extractJSDocTag(node, 'see')` cannot be used: TypeScript parses `@see`
   * into a `JSDocSeeTag` whose `name` (a `JSDocNameReference`) swallows an
   * unpredictable prefix of the value and leaves only the remainder — or the
   * next line's comment asterisk — in `comment`:
   *
   * | JSDoc                                | `tag.name`              | `tag.comment` |
   * | ------------------------------------ | ----------------------- | ------------- |
   * | `@see HTMLButtonAttributes.value`    | `HTMLButtonAttributes.value` | *(none)* → tag dropped |
   * | `@see HTMLButtonAttributes.class`    | `HTMLButtonAttributes.` | `class` (a keyword ends the name) |
   * | `@see X.disabled` + a following tag  | `X.disabled`            | `*` (leaked comment marker) |
   * | `@see https://example.com`           | `https`                 | `://example.com` |
   *
   * Reading the tag's raw source text and keeping its first line is the only
   * form that survives all of these. `@see` is single-line by convention here;
   * a wrapped continuation line would be dropped, which is preferable to
   * re-importing the mis-parse above.
   *
   * CAVEAT: TypeScript parses **any** `@see` as a `JSDocSeeTag`, including one
   * written mid-sentence inside a description. Such a description would grow a
   * reference chip it never asked for. No declaration in the repo does that
   * today; catching it wants a JSDoc lint, not a change here.
   */
  protected extractSeeTags(node: ts.Node): { seeAlso?: string; seeAlsoRefs?: string[] } {
    const values = new Set<string>();
    for (const tag of ts.getJSDocTags(node)) {
      if (tag.tagName.text !== 'see') continue;
      const firstLine = tag.getText().split('\n')[0] ?? '';
      const value = TypeScriptBaseExtractor.unwrapJSDocLink(
        firstLine.replace(/^@see\b/, '').trim()
      );
      if (value) values.add(value);
    }
    const all = [...values];
    const seeAlso = all.find((value) => TypeScriptBaseExtractor.isSeeLinkTarget(value));
    const refs = all.filter((value) => !TypeScriptBaseExtractor.isSeeLinkTarget(value));
    // Absent keys, not keys set to `undefined` — the package compiles under
    // `exactOptionalPropertyTypes`, and callers spread this straight into a
    // TypeDefinition where an explicit `undefined` is not the same as omitted.
    return {
      ...(seeAlso ? { seeAlso } : {}),
      ...(refs.length > 0 ? { seeAlsoRefs: refs } : {})
    };
  }

  /** Reduce a `{@link target}` / `{@link target text}` payload to its target. */
  protected static unwrapJSDocLink(value: string): string {
    return value.match(/^\{@link\s+([^\s|}]+)(?:[\s|][^}]*)?\}$/)?.[1]?.trim() ?? value;
  }

  /**
   * Whether a `@see` value is something a doc page can actually navigate to:
   * an absolute URL, a route-relative path (`/blocks/…#api`) or a bare
   * fragment (`#type-Foo`). Everything else — `HTMLButtonAttributes.value`,
   * `CartesianDatum` — is prose and belongs in `seeAlsoRefs`.
   */
  protected static isSeeLinkTarget(value: string): boolean {
    return /^https?:\/\//.test(value) || value.startsWith('/') || value.startsWith('#');
  }

  /**
   * `{ exported: true | false }` for a declared name, or `{}` when the
   * package's public surface is unknown.
   *
   * Absent keys, not keys set to `undefined`: the package compiles under
   * `exactOptionalPropertyTypes` and callers spread this straight into a
   * `TypeDefinition`, where an explicit `undefined` is not the same as
   * omitted. The distinction carries meaning here — an omitted flag says
   * "could not be determined", which must not read as "not exported".
   */
  protected exportedFlag(name: string): { exported?: boolean } {
    if (!this.publicExportNames) return {};
    return { exported: this.publicExportNames.has(name) };
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
