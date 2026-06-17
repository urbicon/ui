import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ExamplesExtractor } from '../src/extractors/typescript/ExamplesExtractor';

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'examples-head.ts');

let extractor: ExamplesExtractor;

beforeAll(() => {
  extractor = new ExamplesExtractor();
});

async function extract(componentName: string): Promise<string[]> {
  const result = await extractor.extract({ filePath: FIXTURE, componentName });
  expect(result.success).toBe(true);
  return result.data ?? [];
}

describe('ExamplesExtractor — head-scan in multi-component files', () => {
  it('keeps the helper-interface authoring pattern (Menu/Select style)', async () => {
    // WidgetProps has no own @example; WidgetSpecificProps (no .svelte export)
    // carries it in the file head — that example belongs to Widget.
    const examples = await extract('Widget');
    expect(examples.some((e) => e.includes('<Widget items='))).toBe(true);
  });

  it("never attributes a sibling component's @example to another component", async () => {
    const examples = await extract('Widget');
    expect(examples.some((e) => e.includes('<WidgetPanel'))).toBe(false);
  });

  it("extracts a sibling component's own @example normally", async () => {
    const examples = await extract('WidgetPanel');
    expect(examples).toHaveLength(1);
    expect(examples[0]).toContain('<WidgetPanel title="Help" />');
  });
});
