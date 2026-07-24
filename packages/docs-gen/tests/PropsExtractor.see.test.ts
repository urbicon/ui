import * as path from 'node:path';
import type { PropInfo } from '@urbicon-ui/shared-types';
import { beforeAll, describe, expect, it } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

let byName: Record<string, PropInfo>;

beforeAll(async () => {
  const extractor = new PropsExtractor();
  const result = await extractor.extract({
    filePath: path.join(FIXTURES, 'see-tags.ts'),
    componentName: 'SeeTags'
  });
  expect(result.success).toBe(true);
  byName = Object.fromEntries((result.data ?? []).map((p) => [p.name, p]));
});

/**
 * `@see` serves two jobs and only one of them is a link. `seeAlso` keeps the
 * navigable targets (ApiReference renders them as an anchor); everything else
 * is prose and moves to `seeAlsoRefs`, which used to be dropped on the floor.
 */
describe('PropsExtractor — @see link targets land in seeAlso', () => {
  it('keeps an absolute URL', () => {
    expect(byName.externalLink.seeAlso).toBe('https://svelte.dev/docs/svelte/snippet');
    expect(byName.externalLink.seeAlsoRefs).toBeUndefined();
  });

  it('keeps a route-relative path', () => {
    expect(byName.routeLink.seeAlso).toBe('/blocks/primitives/button#variants');
    expect(byName.routeLink.seeAlsoRefs).toBeUndefined();
  });

  it('keeps a bare fragment', () => {
    expect(byName.fragmentLink.seeAlso).toBe('#type-MintProp');
    expect(byName.fragmentLink.seeAlsoRefs).toBeUndefined();
  });

  it('unwraps a {@link target text} payload down to the target', () => {
    expect(byName.jsdocLink.seeAlso).toBe('https://example.com/linked');
  });
});

describe('PropsExtractor — prose @see lands in seeAlsoRefs', () => {
  it('keeps a bare type name', () => {
    expect(byName.bareType.seeAlsoRefs).toEqual(['CartesianDatum']);
    expect(byName.bareType.seeAlso).toBeUndefined();
  });

  it('keeps a dotted member — TS puts it entirely in JSDocSeeTag.name', () => {
    // Regression: `tag.comment` is undefined for this shape, so the old
    // `extractJSDocTag(member, 'see')` path dropped the tag without a trace.
    expect(byName.dottedMember.seeAlsoRefs).toEqual(['HTMLButtonAttributes.value']);
  });

  it('keeps a dotted member whose last segment is a keyword', () => {
    // TS ends the name reference at `HTMLButtonAttributes.` and leaves `class`
    // in `comment`; the old path stored the mangled remainder `"class"`.
    expect(byName.keywordMember.seeAlsoRefs).toEqual(['HTMLButtonAttributes.class']);
  });

  it('is not polluted by the next JSDoc line’s comment asterisk', () => {
    // The old path stored `"*"` here, which then rendered as a stray token.
    expect(byName.followedByTag.seeAlsoRefs).toEqual(['HTMLButtonAttributes.disabled']);
    expect(byName.followedByTag.defaultValue).toBe('false');
  });
});

describe('PropsExtractor — multiple @see tags on one prop', () => {
  it('routes each value to exactly one field, in source order', () => {
    expect(byName.multiple.seeAlso).toBe('https://example.com/docs');
    expect(byName.multiple.seeAlsoRefs).toEqual(['Foo', 'Bar.baz']);
  });
});

describe('PropsExtractor — props without @see', () => {
  it('sets neither field', () => {
    expect(byName.plain.seeAlso).toBeUndefined();
    expect(byName.plain.seeAlsoRefs).toBeUndefined();
  });
});
