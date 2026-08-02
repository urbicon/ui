import { loadCatalog } from './data/catalog-loader.js';
import { loadPatterns, loadPrinciples } from './data/design-system-loader.js';
import { loadTemplateSections } from './data/template-loader.js';
import { createServer } from './server.js';
import { startHttpTransport } from './transports/http.js';
import { startStdioTransport } from './transports/stdio.js';

interface CliArgs {
  transport: 'stdio' | 'http';
  port: number;
  host: string;
  contentDir?: string;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    transport: 'stdio',
    port: 3001,
    // Loopback by default: this server has no authentication of its own and is
    // meant to sit behind a reverse proxy. Binding every interface was the old
    // behaviour — the deploy host set `HOST=127.0.0.1` for years and nothing
    // read it, so the listener answered on `0.0.0.0` and only the firewall kept
    // it private. Widening this is now a deliberate `--host 0.0.0.0`.
    host: process.env.HOST ?? '127.0.0.1'
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
    } else if (arg === '--host' && next) {
      result.host = next;
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
    await startHttpTransport(args.port, args.host);
  } else {
    const server = createServer();
    await startStdioTransport(server);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
