import * as ts from 'typescript';
import type { ExtractionResult } from '../../types/validation';
import { TypeScriptBaseExtractor } from './TypeScriptBaseExtractor';

interface ExamplesExtractionInput {
  filePath: string;
  componentName: string;
}

/**
 * Extracts interface-level @example snippets from the <Component>Props JSDoc using TS AST,
 * avoiding fragile regex parsing in later pipeline stages.
 */
export class ExamplesExtractor extends TypeScriptBaseExtractor<ExamplesExtractionInput, string[]> {
  async extract(input: ExamplesExtractionInput): Promise<ExtractionResult<string[]>> {
    const start = Date.now();

    try {
      if (!input?.filePath || !input?.componentName) {
        return this.createSuccessResult([], [], input?.filePath ?? 'unknown', 0);
      }

      const sourceFile = await this.getSourceFile(input.filePath);
      if (!sourceFile) {
        return this.createSuccessResult([], [], input.filePath, 0);
      }

      const ifaceName = `${input.componentName}Props`;
      const iface = this.findInterface(sourceFile, ifaceName);
      const typeAlias = !iface ? this.findTypeAlias(sourceFile, ifaceName) : null;
      const propsNode = iface ?? typeAlias;

      let examples: string[] = [];

      if (propsNode) {
        // First, try to read explicit @example tags
        const tags = ts.getJSDocTags(propsNode) || [];
        for (const tag of tags) {
          if (tag.tagName?.getText() === 'example') {
            const raw = this.getTagCommentText(tag) || '';
            const cleaned = this.normalizeExampleFromTag(raw);
            if (cleaned) examples.push(cleaned);
          }
        }

        // If none found, fallback to scanning the full JSDoc comment attached to the interface
        if (examples.length === 0) {
          const jsDocs = (ts.getJSDocCommentsAndTags(propsNode) || []).filter((n) =>
            ts.isJSDoc(n)
          ) as ts.JSDoc[];
          for (const doc of jsDocs) {
            const text = this.getCommentText(doc.comment ?? '') || '';
            const fromFences = this.extractFencedExamples(text);
            if (fromFences.length > 0) examples.push(...fromFences);
            const fromFallback = this.extractFallbackExamples(text);
            if (fromFallback.length > 0) examples.push(...fromFallback);
          }
        }

        // Still nothing? Scan the file head (content before the interface) for top-level
        // JSDoc blocks containing @example (common authoring pattern for component props docs)
        if (examples.length === 0) {
          const fromHead = this.extractExamplesFromHead(sourceFile, propsNode);
          if (fromHead.length > 0) examples.push(...fromHead);
        }
      }

      // Deduplicate and trim
      examples = this.dedupeExamples(examples);

      return this.createSuccessResult(examples, [], input.filePath, Date.now() - start);
    } catch (error) {
      return this.handleError(error, { component: input?.componentName, file: input?.filePath });
    }
  }

  /**
   * Full-text ranges of sibling components' Props declarations (incl. their leading
   * JSDoc trivia). A sibling is another `export { default as X } from './X.svelte'`
   * of the same file — in a multi-component index.ts (e.g. the Guide surfaces) the
   * head-scan must not attribute a sibling's `@example` blocks to this component.
   * Helper interfaces like `MenuSpecificProps` (no matching `.svelte` export) are
   * deliberately NOT excluded: their head JSDoc is the documented authoring spot
   * for the primary component's examples.
   */
  private collectSiblingPropsRanges(
    sourceFile: ts.SourceFile,
    propsNode: ts.Node
  ): Array<{ start: number; end: number }> {
    const svelteExports = new Set<string>();
    for (const statement of sourceFile.statements) {
      if (
        ts.isExportDeclaration(statement) &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.endsWith('.svelte')
      ) {
        for (const element of statement.exportClause.elements) {
          if (element.propertyName?.text === 'default') svelteExports.add(element.name.text);
        }
      }
    }

    const ranges: Array<{ start: number; end: number }> = [];
    for (const statement of sourceFile.statements) {
      if (statement === propsNode) continue;
      if (
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
        statement.name.text.endsWith('Props') &&
        svelteExports.has(statement.name.text.slice(0, -'Props'.length))
      ) {
        ranges.push({ start: statement.getFullStart(), end: statement.getEnd() });
      }
    }
    return ranges;
  }

  private getTagCommentText(tag: ts.JSDocTag): string | undefined {
    // TypeScript does not expose a typed API for tag.comment text slices directly,
    // but JSDocTag has a 'comment' field we can stringify.
    const tagWithComment = tag as ts.JSDocTag & { comment?: string | ts.JSDocComment[] };
    const comment = tagWithComment?.comment;
    if (comment == null) return undefined;
    if (typeof comment === 'string') return comment;
    if (Array.isArray(comment))
      return comment
        .map((p: string | { text?: string }) => (typeof p === 'string' ? p : (p?.text ?? '')))
        .join('');
    return String(comment ?? '');
  }

  private extractFencedExamples(text: string): string[] {
    const out: string[] = [];
    const fenceRe = /```(?:\w+)?\n([\s\S]*?)```/g;
    for (const m of text.matchAll(fenceRe)) {
      const block = this.sanitizeExampleCode(m[1] || '');
      if (block) out.push(block);
    }
    return out;
  }

  private extractFallbackExamples(text: string): string[] {
    // Split by @example markers and take the part until the next tag or end
    const parts = text.split(/@example/g).slice(1);
    const out: string[] = [];
    for (const part of parts) {
      const body = part.split('@')[0] || '';
      const cleaned = this.sanitizeExampleCode(body);
      if (cleaned) out.push(cleaned);
    }
    return out;
  }

  private normalizeExampleFromTag(text: string): string {
    const fenced = this.extractFencedExamples(text);
    if (fenced.length > 0) {
      const first = fenced[0];
      if (first) return first;
    }
    return this.sanitizeExampleCode(text || '');
  }

  private extractExamplesFromHead(sourceFile: ts.SourceFile, iface: ts.Node): string[] {
    try {
      const text = sourceFile.getFullText();
      const end = iface.getStart();
      let head = text.slice(0, end);
      // Blank out sibling components' Props declarations (incl. their JSDoc trivia)
      // so their @example blocks are never attributed to this component.
      for (const range of this.collectSiblingPropsRanges(sourceFile, iface)) {
        if (range.start >= head.length) continue;
        const sliceEnd = Math.min(range.end, head.length);
        head =
          head.slice(0, range.start) + ' '.repeat(sliceEnd - range.start) + head.slice(sliceEnd);
      }
      // Look for @example fenced blocks in the head
      const out: string[] = [];
      const fenceRe = /@example[\s\S]*?```(?:\w+)?\n([\s\S]*?)```/g;
      for (const m of head.matchAll(fenceRe)) {
        const cleaned = this.sanitizeExampleCode(m[1] || '');
        if (cleaned) out.push(cleaned);
      }
      if (out.length > 0) return out;
      // Fallback inside head: split by @example and take until next @ or end of block
      const parts = head.split(/@example/g).slice(1);
      for (const part of parts) {
        const snippet = part.split('@')[0] || '';
        const cleaned = this.sanitizeExampleCode(snippet);
        if (cleaned) out.push(cleaned);
      }
      return out;
    } catch {
      return [];
    }
  }

  private sanitizeExampleCode(code: string): string {
    if (!code) return '';
    const lines = String(code)
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\*\s?/, ''));
    // strip leading/trailing empties
    while (lines.length > 0 && lines[0]?.trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();
    return lines.join('\n');
  }

  private dedupeExamples(examples: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ex of examples) {
      const key = ex.replace(/\s+/g, '').toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ex);
      }
    }
    return out;
  }
}
