<script lang="ts">
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import { componentData } from './api';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';

  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta
  title="AvatarGroup Component"
  description="Stack avatars into an overlapping row with a +N overflow chip for collaborators, assignees, or participants."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="AvatarGroup"
  description="Stacks avatars into an overlapping row for a set of collaborators, assignees, or participants, with a “+N” chip once the count passes max. Pass an items array of Avatar props; a shared size and the cut-out ring apply to every avatar."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { AvatarGroup } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('blocks/components/avatar-group/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
