import { auditPackage } from '@urbicon-ui/i18n/audit';
import { describe, expect, it } from 'vitest';
import { docsI18n } from './index';

/**
 * CI gate: every locale bundle passes the translation audit against the `en`
 * base. A missing or misspelled nested key in `de` fails the build here.
 */
describe('docs translations — audit against the en base', () => {
  it('reports no findings', async () => {
    // Empty in every locale on purpose: the default of the optional `subtitle`
    // prop (`translations/en.ts`).
    const report = await auditPackage(docsI18n, { ignoreKeys: ['playgroundSubtitle'] });
    expect(report.findings).toEqual([]);
  });
});
