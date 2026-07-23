<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
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
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { AvatarGroup } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const team = [
    { name: 'Ada Lovelace' },
    { name: 'Alan Turing' },
    { name: 'Grace Hopper', randomColor: true },
    { name: 'Katherine Johnson', randomColor: true },
    { name: 'Edsger Dijkstra' },
    { name: 'Barbara Liskov' }
  ];

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'appearance', title: 'Appearance', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];
</script>

<SeoMeta
  title="AvatarGroup Component"
  description="Stack avatars into an overlapping row with an optional +N overflow chip — collaborators, assignees or participants shown compactly."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="AvatarGroup"
  description="Stacks avatars into an overlapping row with an optional “+N” overflow chip — the canonical way to show a set of collaborators, assignees or participants compactly. Data-driven: pass an items array of Avatar props and the group propagates a shared size and a cut-out ring."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      showHeader={false}
      {propDocs}
      {variantKeys}
      componentName="AvatarGroup"
      controls={[
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'max',
          label: 'Max',
          items: [
            { label: '3', value: 3 },
            { label: '4', value: 4 },
            { label: '5', value: 5 },
            { label: 'all', value: 'all' }
          ],
          defaultValue: 4
        },
        {
          type: 'dropdown',
          key: 'spacing',
          label: 'Spacing',
          items: [
            { label: 'tight', value: 'tight' },
            { label: 'normal', value: 'normal' },
            { label: 'loose', value: 'loose' }
          ],
          defaultValue: 'normal'
        }
      ]}
      values={{
        size: 'md',
        max: 4,
        spacing: 'normal'
      }}
    >
      {#snippet children(values)}
        <AvatarGroup
          items={team}
          size={values.size}
          max={typeof values.max === 'number' ? values.max : undefined}
          spacing={values.spacing}
        />
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
      code={`import { AvatarGroup } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/avatar-group/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
