import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ExamplesExtractor } from '../src/extractors/typescript/ExamplesExtractor';

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'examples-prose.ts');

let extractor: ExamplesExtractor;

beforeAll(() => {
  extractor = new ExamplesExtractor();
});

async function extract(componentName: string): Promise<string[]> {
  const result = await extractor.extract({ filePath: FIXTURE, componentName });
  expect(result.success).toBe(true);
  return result.data ?? [];
}

describe('ExamplesExtractor — prose that names @example is not a code sample', () => {
  it('does not slice a free-text lead paragraph mentioning @example (Path 2 fallback)', async () => {
    expect(await extract('ProseLead')).toEqual([]);
  });

  it('does not attribute an @description that names @example to the component (head-scan)', async () => {
    expect(await extract('ProseDesc')).toEqual([]);
  });

  it('still extracts a genuine fenced @example', async () => {
    const examples = await extract('ProseReal');
    expect(examples).toHaveLength(1);
    expect(examples[0]).toContain('<ProseReal open />');
  });
});
