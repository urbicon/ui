import * as path from 'node:path';
import type { PropInfo } from '@urbicon-ui/shared-types';
import { beforeAll, describe, expect, it } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

let byName: Record<string, PropInfo>;

beforeAll(async () => {
  const extractor = new PropsExtractor();
  const result = await extractor.extract({
    filePath: path.join(FIXTURES, 'inline-links.ts'),
    componentName: 'InlineLinks'
  });
  expect(result.success).toBe(true);
  byName = Object.fromEntries((result.data ?? []).map((p) => [p.name, p]));
});

/**
 * TypeScript parses `{@link Target}` into its own node whose `.text` carries
 * only the optional display text — the target lives in `.name`. Reading `.text`
 * alone left a hole in the published prose ("debounced by  on each change"),
 * visible in every llm.txt, api.ts and doc page that used an inline link.
 */
describe('PropsExtractor — inline {@link} in descriptions', () => {
  it('renders a bare target as code instead of dropping it', () => {
    expect(byName.queryFn.description).toBe(
      'Server-side search, debounced by `debounceMs` on each change.'
    );
  });

  it('keeps a qualified target whole', () => {
    expect(byName.qualified.description).toBe(
      'Pair with `InlineLinksProps.debounceMs` for a controlled setup.'
    );
  });

  it('prefers the display text when the link carries one', () => {
    expect(byName.withDisplayText.description).toBe('See the upstream note for details.');
  });

  it('keeps a member reference whole', () => {
    expect(byName.memberName.description).toBe('Mirrors `InlineLinksProps#queryFn`.');
  });
});
