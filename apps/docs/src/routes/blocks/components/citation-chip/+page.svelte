<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import { CitationChip, type CitationSource } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'related', title: 'Related' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
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
  description="A compact source marker for a citation. Clicking opens a popover with the source title, snippet, and a policy-checked link. StreamingMarkdown creates these chips from its sources prop."
/>

<DocsPageLayout
  title="CitationChip"
  description="A compact chip that marks a citation. Clicking opens a popover with the source title, snippet, and a policy-checked link. StreamingMarkdown creates these chips from its sources prop, or use CitationChip on its own for a reference list."
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
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <Section
    marker
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker id="installation" title="Installation">
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
</DocsPageLayout>
