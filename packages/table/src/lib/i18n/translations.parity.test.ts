import { auditPackage } from '@urbicon-ui/i18n/audit';
import { describe, expect, it } from 'vitest';
import { tableI18n } from './index';

/**
 * CI gate: every locale bundle passes the translation audit against the `en`
 * base. A missing or misspelled nested key in `de` fails the build here.
 */
describe('table translations — audit against the en base', () => {
  it('reports no findings', async () => {
    expect((await auditPackage(tableI18n)).findings).toEqual([]);
  });
});
