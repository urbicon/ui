interface CodeExampleOptions {
  debug?: boolean;
}

/**
 * Vite plugin that auto-extracts children markup from <CodeExample isolate>
 * and injects it as the `code` prop, eliminating the need to duplicate code.
 *
 * Only processes CodeExamples that have the `isolate` attribute.
 * Skips any that already have an explicit `code` prop.
 */
export function codeExamplePlugin(options: CodeExampleOptions = {}) {
  const { debug = false } = options;

  return {
    name: 'code-example-extract',
    enforce: 'pre' as const,

    transform(code: string, id: string) {
      if (!id.endsWith('.svelte')) return null;
      if (!code.includes('CodeExample')) return null;

      const path = id.replace(/\\/g, '/');
      if (/\/node_modules\//.test(path) || /\/packages\/.+\/dist\//.test(path)) {
        return null;
      }

      const regex = /<CodeExample([^>]*)>([\s\S]*?)<\/CodeExample>/g;

      let hasTransformations = false;
      const transformedCode = code.replace(regex, (match, attrs, children) => {
        if (!/\bisolate\b/.test(attrs)) return match;
        if (/\scode\s*=/.test(attrs)) return match;

        hasTransformations = true;
        const extractedCode = extractTemplateCode(children);
        const escaped = escapeTemplateLiteral(extractedCode);

        if (debug) {
          console.log(`[code-example-extract] ${id}\n  → ${extractedCode.split('\n')[0]}…`);
        }

        return `<CodeExample${attrs} code={\`${escaped}\`}>${children}</CodeExample>`;
      });

      return hasTransformations ? { code: transformedCode, map: null } : null;
    }
  };
}

function extractTemplateCode(raw: string): string {
  const lines = raw.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length === 0) return raw.trim();

  const minIndent = Math.min(
    ...nonEmptyLines.map((line) => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    })
  );

  return lines
    .map((line) => (line.trim().length === 0 ? '' : line.slice(minIndent)))
    .join('\n')
    .trim();
}

function escapeTemplateLiteral(code: string): string {
  return code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}
