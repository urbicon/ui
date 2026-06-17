import { DocsGeneratorCLI } from './CLI';

const cli = new DocsGeneratorCLI();
cli.run().catch((error) => {
  console.error('❌ CLI execution failed:', error);
  process.exit(1);
});
