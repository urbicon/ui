import { describe, expect, it } from 'vitest';
import { repoRelativePackageDir, repoRelativePackagePath } from '../src/utils/repo-path';

// One rule for "path from the `packages/` segment", shared by the type
// extractor's `sourcePath`, the `sourceHref` GitHub link and the ownership
// directory index. Ownership only resolves when all three agree character for
// character, and every way of getting this wrong so far has been silent.

const DIALOG = 'packages/blocks/src/lib/primitives/Dialog/index.ts';

describe('repoRelativePackagePath — checkout shapes', () => {
  it.each([
    ['plain checkout', `/home/me/ui/${DIALOG}`, DIALOG],
    // `packages` must be a whole segment: matching the bare substring made
    // the checkout directory itself look like the package root.
    ['checkout under …-packages/', `/home/me/dev-packages/ui/${DIALOG}`, DIALOG],
    ['checkout under my-packages/', `/home/me/my-packages/ui/${DIALOG}`, DIALOG],
    // A directory genuinely named `packages` is indistinguishable from the
    // repo's own from a single path, so the first segment wins — what matters
    // is that the answer is stable, see the idempotence block below.
    ['checkout under packages/', `/home/me/packages/ui/${DIALOG}`, `packages/ui/${DIALOG}`],
    ['already repo-relative', DIALOG, DIALOG],
    ['windows separators', `C:\\dev\\ui\\${DIALOG.replace(/\//g, '\\')}`, DIALOG]
  ])('%s', (_label, input, expected) => {
    expect(repoRelativePackagePath(input)).toBe(expected);
  });

  it.each([
    ['outside any package tree', '/home/me/ui/apps/docs/src/routes/+page.svelte'],
    ['empty', '']
  ])('returns null %s', (_label, input) => {
    expect(repoRelativePackagePath(input)).toBeNull();
  });
});

describe('repoRelativePackagePath — idempotence', () => {
  // The property, not two example paths. Ownership applies the rule once to a
  // component's absolute filePath and a second time to a type's stored
  // `sourcePath` (which is itself an output of this function). If f(f(x)) can
  // differ from f(x), the two sides disagree and `owner` silently vanishes
  // from every entry in the run — which is exactly what a segment-first scan
  // did to a checkout under a directory named `packages`.
  const inputs = [
    `/home/me/ui/${DIALOG}`,
    `/home/me/packages/ui/${DIALOG}`,
    `/home/me/dev-packages/ui/${DIALOG}`,
    `/home/me/packages/packages/ui/${DIALOG}`,
    DIALOG,
    'packages/table/src/lib/index.ts'
  ];

  it.each(inputs)('f(f(x)) === f(x) for %s', (input) => {
    const once = repoRelativePackagePath(input);
    expect(once).not.toBeNull();
    expect(repoRelativePackagePath(once as string)).toBe(once);
  });

  it('holds for the directory form too — that is the one ownership compares', () => {
    for (const input of inputs) {
      const asPath = repoRelativePackagePath(input) as string;
      expect(repoRelativePackageDir(input)).toBe(repoRelativePackageDir(asPath));
    }
  });
});
