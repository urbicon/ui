import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintDesign } from '@urbicon-ui/design-engine/linter';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import { MCPCatalogAssembler } from '../src/generators/mcp/MCPCatalogAssembler';

// Recipe sources live in the docs app; resolve from this test file's location
// (packages/docs-gen/tests → repo root is three levels up).
const recipesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../apps/docs/src/routes/recipes'
);
const pages = globSync('*/+page.svelte', { cwd: recipesDir, absolute: true }).sort();

/**
 * The official recipes are the code LLMs copy verbatim via `get_recipe` /
 * `suggest_implementation`, so they must pass the project's own design linter —
 * both correctness (errors) and the craft axis (warnings: heading-skip,
 * transition-all, hand-rolled components in place of real ones, …). This guards
 * against a recipe drifting from the very rules it is meant to model.
 */
describe('recipe live-preview code passes the design linter', () => {
  it('discovers recipe pages to lint', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  for (const page of pages) {
    const id = page.split('/').at(-2) ?? page;
    const code = MCPCatalogAssembler.extractRecipeCode(readFileSync(page, 'utf-8'));
    if (!code) continue; // metadata-only recipe — no live-preview code to lint

    it(`${id} is lint-clean (0 errors, 0 warnings)`, () => {
      const findings = lintDesign(code).findings.filter(
        (f) => f.severity === 'error' || f.severity === 'warning'
      );
      const report = findings
        .map((f) => `  [${f.severity}/${f.ruleId}:${f.line}] ${f.message}`)
        .join('\n');
      expect(findings, report ? `\n${report}` : undefined).toHaveLength(0);
    });
  }
});
