<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { CodeBlock } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const SAMPLE = `type Source = { id: string; title: string; url?: string };

function cite(sources: Source[]): string {
  return sources.map((s, i) => \`[\${i + 1}] \${s.title}\`).join('\\n');
}`;

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 4 },
    { id: 'installation', title: 'Installation', order: 5 }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const parts: string[] = [];
    if (vals.lang) parts.push(`lang="${vals.lang}"`);
    if (vals.wrap) parts.push('wrap');
    if (vals.showCopy === false) parts.push('showCopy={false}');
    const attrs = parts.length ? ` ${parts.join(' ')}` : '';
    return `<CodeBlock${attrs} {code} />`;
  }
</script>

<SeoMeta
  title="CodeBlock Component"
  description="Read-only code display card with a one-click copy button, an accessible copy status, and horizontal scroll contained inside the block."
/>

<DocsPageLayout
  title="CodeBlock"
  description="Read-only code display card with a one-click copy button, an accessible copy status, and horizontal scroll contained inside the block. Renders raw text — highlighting is layered in by a consumer or the StreamingMarkdown renderer."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="CodeBlock"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        { type: 'text', key: 'lang', label: 'Language', defaultValue: 'ts' },
        { type: 'checkbox', key: 'wrap', label: 'Wrap lines', defaultValue: false },
        { type: 'checkbox', key: 'showCopy', label: 'Copy button', defaultValue: true }
      ]}
      values={{ lang: 'ts', wrap: false, showCopy: true }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="mx-auto max-w-xl">
          <CodeBlock
            code={SAMPLE}
            lang={(values.lang as string) || undefined}
            wrap={values.wrap as boolean}
            showCopy={values.showCopy as boolean}
          />
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="03"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="04" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { CodeBlock } from '@urbicon-ui/blocks';
import type { CodeBlockProps } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/code-block/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
