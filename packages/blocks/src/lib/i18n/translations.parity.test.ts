import { auditPackage } from '@urbicon-ui/i18n/audit';
import { describe, expect, it } from 'vitest';
import { blocksI18n } from './index';

/**
 * CI gate: `auditPackage(blocksI18n)` loads the lazy `de` bundle and audits it
 * against the eager `en` base — a missing or misspelled nested key, an empty
 * value or a dropped `{{param}}` in `de` fails the build here. The generic
 * `createPackageI18n` cannot check `de` at compile time: a loader's bundle is
 * not visible to the type-checker.
 */
describe('blocks translations — audit against the en base', () => {
  it('reports no findings', async () => {
    expect((await auditPackage(blocksI18n)).findings).toEqual([]);
  });
});
