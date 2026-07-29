import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentBundleEmitter } from '../generators/content/ContentBundleEmitter';
import type { PackageGuide } from '../generators/llm/guide-injection';
import { LlmsFullAssembler } from '../generators/llm/LlmsFullAssembler';
import { MCPCatalogAssembler } from '../generators/mcp/MCPCatalogAssembler';
import { ConfigurationFactory } from '../schema/ConfigurationBuilder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve a path relative to the docs-gen package root (two levels above
 * this file), so the CLI works regardless of the caller's CWD.
 */
function resolveFromDocsGen(...segments: string[]): string {
  return path.resolve(__dirname, '..', '..', ...segments);
}

/**
 * The canonical, tarball-shipped package guides distributed into the generated
 * channels (docs/DOCS-SURFACES.md): every entry lands in the design-content
 * bundle (`guides/<slug>.md` + index → `urbicon guide <slug>` and the MCP
 * guide resources); entries flagged `embedInLlmsFull` are additionally inlined
 * into `llms-full.txt` via their `{{GUIDE:<slug>}}` template placeholder.
 */
const PACKAGE_GUIDES: (PackageGuide & { embedInLlmsFull?: boolean })[] = [
  {
    slug: 'auth',
    title: 'Auth Reference',
    description:
      'Architecture, consumer integration, federation (SSO), known limitations & production checklist',
    sourcePath: resolveFromDocsGen('..', 'auth', 'docs', 'AUTH.md'),
    embedInLlmsFull: true
  },
  {
    slug: 'guide-system',
    title: 'Guide System (blocks)',
    description:
      'Non-modal help panel, contextual hints, UI↔guide linking, opt-in guided tour — architecture + as-built contract',
    sourcePath: resolveFromDocsGen('..', 'blocks', 'docs', 'GUIDE.md')
  },
  {
    slug: 'a2ui',
    title: 'A2UI — Agent-generated UI',
    description:
      'Rendering A2UI in a chat: surfaces that outlive their reply, the action-only return path, fetched options, and the shipped transport/routing pieces',
    sourcePath: resolveFromDocsGen('..', 'blocks', 'docs', 'A2UI.md')
  },
  {
    slug: 'migration-v5',
    title: 'Migration v4 → v5',
    description:
      'Consumer migration guide for the v5 "lighter design" refactor — variant renames, table chrome, new tokens',
    sourcePath: resolveFromDocsGen('..', 'blocks', 'docs', 'MIGRATION-v5.md')
  },
  {
    slug: 'table-sticky',
    title: 'Table Sticky Pinning & Contained Scroll',
    description:
      'The two table scroll models — page-relative sticky pinning and contained viewport scroll — API + CSS vars',
    sourcePath: resolveFromDocsGen('..', 'table', 'docs', 'STICKY-PINNING.md')
  }
];

/**
 * The `docs-gen` command-line interface (the package `bin`, driving
 * `bun run docs:gen:*` from the repo root). Commands:
 *
 * - `generate` / `build` (default) — run the pipeline for one target
 *   (`--target blocks|docs|table|auth`) or all. The `all` run additionally
 *   assembles the cross-target artifacts: `llms-full.txt`, the MCP component
 *   catalog, and the `@urbicon-ui/design-content` bundle — which is why JSDoc
 *   edits require `docs:gen:all`, not a single target.
 * - `scaffold <Name> [--group primitives|components]` — create the docs
 *   route skeleton (+page.svelte / Docs.svelte) for a new component.
 * - `help` — usage text.
 *
 * Any command failure exits with code 1 (fail-loud; CI relies on this).
 */
export class DocsGeneratorCLI {
  /**
   * Parse argv and dispatch to the requested command. Defaults to
   * `generate`; unknown commands print help and exit 1.
   */
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

  /**
   * Run generation for `--target` (default `all`). `all` runs the four
   * package targets sequentially and then the cross-target assembly step
   * (`assembleLlmsFull`); a single target deliberately skips assembly, which
   * leaves the aggregated artifacts stale until the next full run.
   */
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

  /**
   * Execute the full pipeline for one package target using its
   * `ConfigurationFactory` preset. Throws (→ exit 1) when the pipeline
   * reports failure, printing every collected error first.
   */
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

  /**
   * The cross-target assembly step that only `--target all` runs, in order:
   * (1) `llms-full.txt` from the per-scope static trees, (2) the MCP
   * component catalog (stamped with the repo-root version — fail-loud when
   * that is missing), (3) the `@urbicon-ui/design-content` bundle the MCP
   * server and `urbicon` CLI consume.
   */
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
      ],
      guides: PACKAGE_GUIDES.filter((g) => g.embedInLlmsFull)
    });

    const result = await assembler.assemble();
    console.log(`✅ llms-full.txt assembled (${result.componentCount} components)`);

    // Assemble MCP component catalog
    console.log('\n📦 Assembling MCP component catalog...');

    // Catalog version tracks the repo root (bump.sh keeps package.json in
    // lockstep with the published packages). Previously hardcoded '0.2.38',
    // which drifted the catalog's `version` field ~6 majors from the real
    // release. Fail loud if the field is ever missing rather than stamping junk.
    const rootPkgRaw = await fs.readFile(resolveFromDocsGen('..', '..', 'package.json'), 'utf-8');
    const rootVersion: unknown = JSON.parse(rootPkgRaw).version;
    if (typeof rootVersion !== 'string') {
      throw new Error(
        'MCP catalog: root package.json has no string "version" — cannot stamp the catalog.'
      );
    }

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
      version: rootVersion
    });

    const catalogResult = await catalogAssembler.assemble();
    console.log(
      `✅ MCP catalog assembled (${catalogResult.componentCount} components, ${catalogResult.recipeCount} recipes)`
    );

    // Bundle the generated catalog + llm.txt tree + authored design-system, template
    // and icon metadata into the version-pinned @urbicon-ui/design-content package, so
    // the MCP server and the urbicon CLI read self-contained content (no sibling paths).
    console.log('\n🧱 Emitting design-content bundle...');

    const bundleEmitter = new ContentBundleEmitter({
      staticDir: resolveFromDocsGen('..', '..', 'apps', 'docs', 'static'),
      designSystemDir: resolveFromDocsGen('..', '..', 'design-system'),
      templatePath: resolveFromDocsGen('templates', 'llms-full-template.md'),
      iconRegistryPath: resolveFromDocsGen(
        '..',
        'blocks',
        'src',
        'lib',
        'icons',
        'icon-registry.ts'
      ),
      verbsDir: resolveFromDocsGen('..', 'design', 'skill', 'verbs'),
      packageGuides: PACKAGE_GUIDES,
      outputDir: resolveFromDocsGen('..', 'design-content', 'content')
    });

    const bundleResult = await bundleEmitter.emit();
    console.log(
      `✅ design-content bundle emitted (v${bundleResult.version}, ${bundleResult.llmTxtCount} llm.txt, ${bundleResult.patternCount} patterns, ${bundleResult.verbCount} verbs, ${bundleResult.guideCount} guides, ${bundleResult.iconCount} icons, hash ${bundleResult.contentHash})`
    );
  }

  /**
   * Scaffold the docs route for a component: creates
   * `apps/docs/src/routes/blocks/<group>/<slug>/` with a `+page.svelte`
   * (playground + API sections wired to the generated `api.ts`) and a
   * `Docs.svelte` (the authored example/customization/a11y sections that the
   * page composes in). Refuses to overwrite an
   * existing directory; the `api.ts` itself comes from a later
   * `docs:gen:all` run.
   */
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
  import { asset, resolve } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];
</script>

<SeoMeta title="${name} Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="${name}"
  description=""
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: '${group === 'primitives' ? 'Primitives' : 'Components'}', href: resolve('/blocks/${group}') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <Playground />
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
      preview={false}
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
</DocsPageLayout>
`;

    // Generate Playground.svelte
    //
    // Separate file, not inline on the page: the playground has two consumers —
    // the docs page and the landing hero, which collects every
    // `Playground.svelte` via `import.meta.glob`. Built inline it would become a
    // second, drifting example on the landing page.
    //
    // Controls come from the generated api.ts (`deriveControls`) rather than a
    // hand-written list, so a new variant value shows up here the next time
    // docs-gen runs. Hand-written control literals are how twelve dropdowns fell
    // behind their components before this was introduced.
    const playgroundSvelte = `<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { ${name} } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // \`pick\` lists the props that should become knobs, in display order. What
  // derivation cannot know goes in \`overrides\` (nicer label, tighter min/max, a
  // deliberately shorter item list, or a whole definition with its own \`type\`
  // for props whose type the extractor does not resolve); demo-only toggles go
  // in \`extra\`. A picked key that is neither derivable nor overridden throws —
  // a typo should not swallow a control silently.
  const controls = deriveControls(componentData, {
    // TODO: pick the props worth a knob
    pick: []
  });
</script>

<PlaygroundConfigurator
  componentName="${name}"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
>
  {#snippet children(values)}
    <${name}>
      <!-- TODO: Add component content -->
    </${name}>
  {/snippet}
</PlaygroundConfigurator>
`;

    // Generate Docs.svelte
    const docsSvelte = `<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
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
    await fs.writeFile(path.join(docsDir, 'Playground.svelte'), playgroundSvelte, 'utf-8');
    await fs.writeFile(path.join(docsDir, 'Docs.svelte'), docsSvelte, 'utf-8');

    console.log(`✅ Scaffolded docs page for ${name}:`);
    console.log(`   ${docsDir}/+page.svelte`);
    console.log(`   ${docsDir}/Playground.svelte`);
    console.log(`   ${docsDir}/Docs.svelte`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Fill \`pick\` in Playground.svelte — it also feeds the landing hero`);
    console.log(`   2. Add examples, customization, and accessibility content to Docs.svelte`);
    console.log(`   3. Run \`bun run docs:gen:all\` to generate the api.ts file`);
  }

  /**
   * Minimal `--flag [value]` parser: a `--key` followed by a non-flag token
   * becomes `key: value`, a bare `--key` becomes `key: true`. Positional
   * arguments are handled by the callers, not here.
   */
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

  /** Print command/option usage to stdout. */
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
