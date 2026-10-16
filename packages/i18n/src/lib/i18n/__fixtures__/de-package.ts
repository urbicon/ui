import { createPackageI18n } from '../package-integration';

/** A German-only package: `de` is the base bundle, there is no `en`. */
export const dePackage = createPackageI18n(
  'base-de-fixture',
  { de: { greeting: 'Hallo {{name}}', save: 'Speichern' } as const },
  { base: 'de' }
);
