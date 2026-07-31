import { createConfig } from '@urbicon-ui/commitlint-config';

export default createConfig({
  // Workspace packages (packages/*, apps/*) + `deps` for Renovate. The scope is
  // the package name minus the `@urbicon-ui/` prefix, which is why `apps/docs`
  // is `docs-app` and not `docs` — that one is `packages/docs`.
  scopes: [
    // packages/*
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
    // apps/*
    'artifact-studio',
    'docs-app',
    'deps'
  ]
});
