import { loadCatalog } from './data/catalog-loader.js';
import { loadPatterns, loadPrinciples } from './data/design-system-loader.js';
import { loadTemplateSections } from './data/template-loader.js';
import { createServer } from './server.js';
import { startHttpTransport } from './transports/http.js';
import { startStdioTransport } from './transports/stdio.js';

interface CliArgs {
  transport: 'stdio' | 'http';
  port: number;
  contentDir?: string;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    transport: 'stdio',
    port: 3001
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--transport' && next) {
      if (next === 'stdio' || next === 'http') {
        result.transport = next;
      }
      i++;
    } else if (arg === '--port' && next) {
      result.port = parseInt(next, 10);
      i++;
    } else if (arg === '--content-dir' && next) {
      result.contentDir = next;
      i++;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.contentDir) {
    process.env.URBICON_CONTENT_DIR = args.contentDir;
  }

  // Pre-load cached data (recipes travel inside the catalog).
  try {
    await Promise.all([loadCatalog(), loadTemplateSections(), loadPrinciples(), loadPatterns()]);
  } catch (err) {
    console.error('Warning: Failed to pre-load some data:', err);
  }

  if (args.transport === 'http') {
    await startHttpTransport(args.port);
  } else {
    const server = createServer();
    await startStdioTransport(server);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
