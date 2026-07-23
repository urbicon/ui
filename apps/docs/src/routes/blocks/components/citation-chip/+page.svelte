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
  import { CitationChip, type CitationSource } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const DEMO_SOURCE: CitationSource = {
    id: '1',
    title: 'Attention Is All You Need',
    url: 'https://arxiv.org/abs/1706.03762',
    snippet:
      'We propose the Transformer, a network architecture based solely on attention mechanisms.'
  };

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'related', title: 'Related', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const parts = ['{source}'];
    if (vals.index) parts.push(`index={${vals.index}}`);
    if (vals.citationStyle && vals.citationStyle !== 'numeric')
      parts.push(`citationStyle="${vals.citationStyle}"`);
    if (vals.openLabel) parts.push(`openLabel="${vals.openLabel}"`);
    return `<CitationChip ${parts.join(' ')} />`;
  }
</script>

<SeoMeta
  title="CitationChip Component"
  description="Compact source marker for a citation. Click opens a popover with the source title, snippet, and a policy-checked outbound link. StreamingMarkdown wires it up from its sources prop."
/>

<DocsPageLayout
  title="CitationChip"
  description="Compact source marker rendered for a citation. Clicking opens a popover with the source title, snippet, and a policy-checked outbound link — wired up automatically by StreamingMarkdown, or usable standalone for reference lists."
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
      componentName="CitationChip"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'citationStyle',
          label: 'Style',
          items: [
            { label: 'numeric', value: 'numeric' },
            { label: 'label', value: 'label' }
          ],
          defaultValue: 'numeric'
        },
        { type: 'number', key: 'index', label: 'Index', min: 1, max: 99, step: 1, defaultValue: 1 },
        { type: 'text', key: 'openLabel', label: 'Open label', defaultValue: 'Open source' }
      ]}
      values={{ citationStyle: 'numeric', index: 1, openLabel: 'Open source' }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="flex min-h-24 items-center justify-center">
          <CitationChip
            source={DEMO_SOURCE}
            index={(values.index as number) || undefined}
            citationStyle={values.citationStyle as 'numeric' | 'label'}
            openLabel={(values.openLabel as string) || undefined}
          />
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { CitationChip } from '@urbicon-ui/blocks';
import type { CitationChipProps, CitationSource } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/citation-chip/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
