import { createConfig } from '@urbicon-ui/commitlint-config';

const config = createConfig({
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
    'sv',
    'sveltekit-utils',
    // apps/*
    'artifact-studio',
    'docs-app',
    'deps'
  ],
  rules: {
    'no-agent-trailer': [2, 'always']
  }
});

// AGENTS.md § Commits bans agent-session trailers (the links are account-bound
// and resolve for nobody else); this is the oracle that makes the ban real
// instead of prose a harness can override.
config.plugins = [
  {
    rules: {
      'no-agent-trailer': (parsed) => {
        const hasAgentTrailer = /^(Claude-Session|Co-Authored-By:\s*Claude)/im.test(
          parsed.raw ?? ''
        );
        return [
          !hasAgentTrailer,
          'commit message must not carry a Claude-Session or Co-Authored-By: Claude trailer'
        ];
      }
    }
  }
];

export default config;
