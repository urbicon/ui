import { createConfig } from '@urbicon/commitlint-config';

export default createConfig({
  // Workspace packages (packages/*, apps/*) + `deps` for Renovate.
  scopes: [
    'auth',
    'blocks',
    'table',
    'design',
    'design-content',
    'design-engine',
    'docs',
    'docs-gen',
    'i18n',
    'mcp-server',
    'shared-types',
    'sveltekit-utils',
    'deps'
  ]
});
