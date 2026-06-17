import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { codeExamplePlugin } from '@urbicon-ui/docs/vite';
import { defineConfig, type Plugin } from 'vite';

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

function changelogPlugin(): Plugin {
  let cached: string | undefined;
  const changelogPath = resolve(__dirname, '../../CHANGELOG.md');

  function getChangelogModule(): string {
    if (cached !== undefined) return cached;
    try {
      const content = readFileSync(changelogPath, 'utf-8');
      cached = `export default ${JSON.stringify(content)};`;
    } catch {
      cached = `export default '# Changelog\\n\\nNo changelog available yet.';`;
    }
    return cached;
  }

  return {
    name: 'changelog-loader',
    resolveId(id) {
      if (id === 'virtual:changelog') return '\0virtual:changelog';
    },
    load(id) {
      if (id === '\0virtual:changelog') return getChangelogModule();
    },
    handleHotUpdate({ file }) {
      if (file === changelogPath) cached = undefined;
    }
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version)
  },
  plugins: [changelogPlugin(), codeExamplePlugin(), tailwindcss(), sveltekit()],
  optimizeDeps: {
    exclude: ['@tailwindcss/oxide', '@tailwindcss/oxide-darwin-arm64', 'fsevents', 'lightningcss']
  }
});
