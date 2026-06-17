import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmsFullAssembler } from '../generators/llm/LlmsFullAssembler';
import { MCPCatalogAssembler } from '../generators/mcp/MCPCatalogAssembler';
import { ConfigurationFactory } from '../schema/ConfigurationBuilder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveFromDocsGen(...segments: string[]): string {
  return path.resolve(__dirname, '..', '..', ...segments);
}

export class DocsGeneratorCLI {
  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    const command = args[0] || 'generate';
    const options = this.parseOptions(args.slice(1));

    try {
      switch (command) {
        case 'generate':
        case 'build':
          await this.generateCommand(options);
          break;

        case 'scaffold':
          await this.scaffoldCommand(args.slice(1));
          break;

        case 'help':
          this.showHelp();
          break;

        default:
          console.error(`Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ Command failed:', error);
      process.exit(1);
    }
  }

  private async generateCommand(options: { target?: string }): Promise<void> {
    const target = options.target || 'all';

    if (target === 'all' || target === 'both') {
      console.log('📚 Generating documentation for all packages...');
      await this.generateTarget('blocks');
      await this.generateTarget('docs');
      await this.generateTarget('table');
      await this.generateTarget('auth');
      await this.assembleLlmsFull();
    } else if (
      target === 'blocks' ||
      target === 'docs' ||
      target === 'table' ||
      target === 'auth'
    ) {
      console.log(`📚 Generating documentation for ${target}...`);
      await this.generateTarget(target);
    } else {
      console.error(`Unknown target: ${target}. Valid: blocks, docs, table, auth, all`);
      process.exit(1);
    }
  }

  private async generateTarget(target: 'blocks' | 'docs' | 'table' | 'auth'): Promise<void> {
    console.log(`\n🔄 Processing ${target} package...`);

    const configMap = {
      blocks: ConfigurationFactory.blocks,
      docs: ConfigurationFactory.docs,
      table: ConfigurationFactory.table,
      auth: ConfigurationFactory.auth
    };
    const config = configMap[target]();

    console.log(`✅ Configuration loaded: ${config.input.packages.length} packages`);

    const { PipelineOrchestrator } = await import('../core/pipeline/PipelineOrchestrator');
    const orchestrator = new PipelineOrchestrator(config);

    const result = await orchestrator.execute();

    if (result.success) {
      console.log(`🎉 ${target} documentation generation completed successfully!`);
      console.log(
        `📊 Generated ${result.stats.totalComponents} components in ${result.duration}ms`
      );

      if (result.outputs.length > 0) {
        console.log('📄 Generated outputs:');
        result.outputs.forEach((output) => {
          console.log(
            `  - ${output.type}: ${output.path} (${output.components.length} components)`
          );
        });
      }
    } else {
      console.error(`❌ ${target} documentation generation failed`);
      result.errors.forEach((error) => {
        console.error(`  - ${error.type}: ${error.message}`);
      });
      throw new Error(`${target} generation failed`);
    }
  }

  private async assembleLlmsFull(): Promise<void> {
    console.log('\n🔗 Assembling llms-full.txt...');

    const assembler = new LlmsFullAssembler({
      templatePath: resolveFromDocsGen('templates', 'llms-full-template.md'),
      staticDirs: [
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'blocks'),
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'docs'),
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'table'),
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'auth')
      ],
      outputPaths: [
        resolveFromDocsGen('..', '..', 'llms-full.txt'),
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'llms-full.txt')
      ]
    });

    const result = await assembler.assemble();
    console.log(`✅ llms-full.txt assembled (${result.componentCount} components)`);

    // Assemble MCP component catalog
    console.log('\n📦 Assembling MCP component catalog...');

    const catalogAssembler = new MCPCatalogAssembler({
      staticDirs: [
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'blocks'),
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'docs'),
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'table'),
        resolveFromDocsGen('..', '..', 'apps', 'docs', 'static', 'auth')
      ],
      recipesDir: resolveFromDocsGen('..', '..', 'apps', 'docs', 'src', 'routes', 'recipes'),
      outputPath: resolveFromDocsGen(
        '..',
        '..',
        'apps',
        'docs',
        'static',
        'mcp',
        'component-catalog.json'
      ),
      version: '0.2.38'
    });

    const catalogResult = await catalogAssembler.assemble();
    console.log(
      `✅ MCP catalog assembled (${catalogResult.componentCount} components, ${catalogResult.recipeCount} recipes)`
    );
  }

  private async scaffoldCommand(args: string[]): Promise<void> {
    const name = args[0];
    const options = this.parseOptions(args.slice(1));
    const group = (options.group as string) || 'primitives';

    if (!name) {
      console.error(
        '❌ Component name required. Usage: docs-gen scaffold Button --group primitives'
      );
      process.exit(1);
    }

    if (group !== 'primitives' && group !== 'components') {
      console.error(`❌ Invalid group "${group}". Must be "primitives" or "components".`);
      process.exit(1);
    }

    const slug = name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase();

    const docsDir = resolveFromDocsGen(
      '..',
      '..',
      'apps',
      'docs',
      'src',
      'routes',
      'blocks',
      group,
      slug
    );

    // Check if directory already exists
    try {
      await fs.access(docsDir);
      console.error(`❌ Directory already exists: ${docsDir}`);
      process.exit(1);
    } catch {
      // Expected — directory doesn't exist yet
    }

    await fs.mkdir(docsDir, { recursive: true });

    // Generate +page.svelte
    const pageSvelte = `<script lang="ts">
  import { page } from '$app/state';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { ${name} } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const navigation = [
    { id: 'playground', label: 'Playground', order: 1 },
    { id: 'examples', label: 'Examples', order: 2 },
    { id: 'customization', label: 'Customization', order: 3 },
    { id: 'accessibility', label: 'Accessibility', order: 4 },
    { id: 'api', label: 'API Reference', order: 10 },
    { id: 'installation', label: 'Installation', order: 11 }
  ];
</script>

<SeoMeta title="${name} Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="${name}"
  description=""
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: '${group === 'primitives' ? 'Primitives' : 'Components'}', href: '/blocks/${group}' }
  ]}
  {navigation}
>
  <Section id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      showHeader={false}
      {propDocs}
      {variantKeys}
      componentName="${name}"
      controls={[
        // TODO: Add playground controls
      ]}
    >
      {#snippet children(values)}
        <${name} {...values}>
          <!-- TODO: Add component content -->
        </${name}>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={\`import { ${name} } from '@urbicon-ui/blocks';\`}
      language="svelte"
      hasPreview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/${group}/${slug}/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
`;

    // Generate Docs.svelte
    const docsSvelte = `<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: true, order: 1 },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: { include: true },
    meta: { title: '${name} Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->
<Section id="examples" title="Examples">
  <div class="space-y-8">
    <!-- TODO: Add examples -->
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section id="customization" title="Customization">
  <div class="space-y-4">
    <!-- TODO: Add customization examples -->
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section id="accessibility" title="Accessibility">
  <div class="prose prose-sm">
    <!-- TODO: Document accessibility features -->
  </div>
</Section>
`;

    await fs.writeFile(path.join(docsDir, '+page.svelte'), pageSvelte, 'utf-8');
    await fs.writeFile(path.join(docsDir, 'Docs.svelte'), docsSvelte, 'utf-8');

    console.log(`✅ Scaffolded docs page for ${name}:`);
    console.log(`   ${docsDir}/+page.svelte`);
    console.log(`   ${docsDir}/Docs.svelte`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Add playground controls to +page.svelte`);
    console.log(`   2. Add examples, customization, and accessibility content to Docs.svelte`);
    console.log(`   3. Run \`bun run docs:gen:all\` to generate the api.ts file`);
  }

  private parseOptions(args: string[]): Record<string, string | boolean> {
    const options: Record<string, string | boolean> = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg?.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];

        if (value && !value.startsWith('--')) {
          options[key] = value;
          i++;
        } else {
          options[key] = true;
        }
      }
    }

    return options;
  }

  private showHelp(): void {
    console.log(`
📚 Docs Generator

Usage:
  docs-gen [command] [options]

Commands:
  generate, build    Generate documentation (default)
  scaffold <Name>    Scaffold a new docs page for a component
  help              Show this help

Options:
  --target <type>   Target package: 'blocks', 'docs', 'table', or 'all' (default: 'all')
  --group <group>   Component group for scaffold: 'primitives' or 'components' (default: 'primitives')

Examples:
  docs-gen                                        # Generate all packages
  docs-gen --target blocks                        # Generate only blocks docs
  docs-gen scaffold Button                        # Scaffold docs for Button (primitives)
  docs-gen scaffold DatePicker --group components # Scaffold docs for DatePicker (components)
    `);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new DocsGeneratorCLI();
  cli.run().catch((error) => {
    console.error('❌ CLI execution failed:', error);
    process.exit(1);
  });
}
