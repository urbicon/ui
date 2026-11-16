import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createConfig } from '@urbicon-ui/commitlint-config';

const root = new URL('./', import.meta.url);
const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));

// A scope is a workspace package's name minus the `@urbicon-ui/` prefix, read off
// the root's workspace globs, so a new package is a valid scope the day it lands.
// That is why `apps/docs` is `docs-app` and not `docs` — that one is `packages/docs`.
const workspaceScopes = readJson(new URL('package.json', root)).workspaces.packages.flatMap(
  (glob) => {
    if (!glob.endsWith('/*')) {
      throw new Error(`commitlint.config.mjs reads <dir>/* workspace globs only, got "${glob}"`);
    }
    const dir = new URL(glob.slice(0, -1), root);
    return readdirSync(dir)
      .map((name) => new URL(`${name}/package.json`, dir))
      .filter((file) => existsSync(file))
      .map((file) => readJson(file).name.replace(/^@urbicon-ui\//, ''));
  }
);

const config = createConfig({
  // Plus `deps`, the scope Renovate commits under.
  scopes: [...workspaceScopes, 'deps'],
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
