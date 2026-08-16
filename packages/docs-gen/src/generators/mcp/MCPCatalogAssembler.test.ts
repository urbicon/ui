import { describe, expect, it } from 'vitest';
import { MCPCatalogAssembler } from './MCPCatalogAssembler';

/**
 * `extractArray` reads the `components` / `features` lists a recipe's `meta.ts`
 * declares, and those lists reach agents verbatim through `get_recipe`. The
 * only thing worth testing here is the boundary the previous implementation got
 * wrong: what separates two entries.
 */
const META = `import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Layout',
  title: 'Filter Sidebar',
  components: ['Sidebar', 'Input', 'Card'],
  features: [
    'Mixed filter controls — Input search, RadioGroup property type, Checkbox amenities',
    "Search and sort come from the table's own toolbar",
    'A "Show N results" button dismisses the sheet',
    'The rail doesn\\'t trap focus'
  ]
};
`;

describe('MCPCatalogAssembler.extractArray', () => {
  it('reads a flat list of string literals', () => {
    expect(MCPCatalogAssembler.extractArray(META, 'components')).toEqual([
      'Sidebar',
      'Input',
      'Card'
    ]);
  });

  it('keeps a comma inside a literal as a character', () => {
    // Positive control on the defect this replaced: splitting on commas turned
    // the first line into three entries, the last two of them fragments.
    const features = MCPCatalogAssembler.extractArray(META, 'features');
    expect(features).toHaveLength(4);
    expect(features[0]).toBe(
      'Mixed filter controls — Input search, RadioGroup property type, Checkbox amenities'
    );
  });

  it('reads a double-quoted literal holding a single quote', () => {
    expect(MCPCatalogAssembler.extractArray(META, 'features')[1]).toBe(
      "Search and sort come from the table's own toolbar"
    );
  });

  it('reads a single-quoted literal holding double quotes', () => {
    expect(MCPCatalogAssembler.extractArray(META, 'features')[2]).toBe(
      'A "Show N results" button dismisses the sheet'
    );
  });

  it('does not end a literal on an escaped quote', () => {
    expect(MCPCatalogAssembler.extractArray(META, 'features')[3]).toBe(
      "The rail doesn't trap focus"
    );
  });

  it('returns nothing for a key the file does not declare', () => {
    expect(MCPCatalogAssembler.extractArray(META, 'variants')).toEqual([]);
  });
});

describe('MCPCatalogAssembler.extractRecipeCode', () => {
  // Written the way a recipe page writes it: a template literal holding a whole
  // Svelte component, with the closing script tag escaped.
  const page = (body: string) =>
    `<script lang="ts">\n  const recipeCode = \`${body}\`;\n<\\/script>\n<div>…</div>`;

  it('takes the whole literal', () => {
    expect(MCPCatalogAssembler.extractRecipeCode(page('<Table {items} />'))).toBe(
      '<Table {items} />'
    );
  });

  it('does not stop at an escaped backtick in the snippet', () => {
    // Positive control on the defect this guards, and it has to be an ODD
    // number of escaped backticks before a `;`: an even count toggles the old
    // scan's depth back and survives by luck, which is why the first version of
    // this test passed against the broken implementation too. With one — prose
    // quoting the character itself — the old scan read the literal as closed
    // and handed back everything up to `const pageSize = 6`, dropping the
    // markup that follows. `get_recipe` then shipped half a recipe.
    const code = MCPCatalogAssembler.extractRecipeCode(
      page('// the escape is a \\` character\\n  const pageSize = 6;\\n<Table {items} />')
    );
    expect(code).toContain('<Table {items} />');
  });

  it('returns nothing when the page declares no recipeCode', () => {
    expect(MCPCatalogAssembler.extractRecipeCode('<script>const x = 1;<\\/script>')).toBe('');
  });

  // The literals escape BOTH script tags — the closer because it would end the
  // page's real script block, the opener because Vite's dependency scanner
  // lexes .svelte files as HTML and a raw `<script` inside the literal starts
  // a phantom module (its `$lib/…` imports then ENOENT the whole scan; found
  // live on 2026-08-16). What `get_recipe` ships must be the cooked string the
  // code panel displays, never those backslashes.
  it('cooks the script-tag escapes: what ships is what the page displays', () => {
    const code = MCPCatalogAssembler.extractRecipeCode(
      page('<\\script lang="ts">\\n  let n = 1;\\n<\\/script>\\n<Table {items} />')
    );
    expect(code).toBe('<script lang="ts">\n  let n = 1;\n</script>\n<Table {items} />');
  });

  it('keeps a doubled backslash as one: a regex in the snippet survives cooking', () => {
    const code = MCPCatalogAssembler.extractRecipeCode(page('const re = /^[^\\\\s@]+$/;'));
    expect(code).toBe('const re = /^[^\\s@]+$/;');
  });
});
