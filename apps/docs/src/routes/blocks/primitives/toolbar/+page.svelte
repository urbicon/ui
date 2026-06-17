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
  import { Button, Separator, Toolbar } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];
</script>

<SeoMeta
  title="Toolbar Component"
  description="Action bars for grouping tools, controls, and contextual actions."
/>

<DocsPageLayout
  title="Toolbar"
  description="Action bars for grouping tools, controls, and contextual actions."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Toolbar"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'text',
          key: 'aria-label',
          label: 'ARIA Label',
          defaultValue: 'Formatting toolbar'
        },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'elevated', value: 'elevated' },
            { label: 'outlined', value: 'outlined' },
            { label: 'ghost', value: 'ghost' }
          ],
          defaultValue: 'elevated'
        },
        {
          type: 'dropdown',
          key: 'orientation',
          label: 'Orientation',
          items: [
            { label: 'horizontal', value: 'horizontal' },
            { label: 'vertical', value: 'vertical' }
          ],
          defaultValue: 'horizontal'
        },
        {
          type: 'dropdown',
          key: 'gap',
          label: 'Gap',
          items: [
            { label: 'xs', value: 'xs' },
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' }
          ],
          defaultValue: 'sm'
        },
        {
          type: 'dropdown',
          key: 'padding',
          label: 'Padding',
          items: [
            { label: 'xs', value: 'xs' },
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' }
          ],
          defaultValue: 'sm'
        },
        {
          type: 'dropdown',
          key: 'tier',
          label: 'Tier (propagated)',
          description:
            'Propagated radius tier for tier-aware descendants (Button, Badge, Input, …). The toolbar surface itself stays contain.',
          items: [
            { label: 'modify (default)', value: 'modify' },
            { label: 'commit (pill)', value: 'commit' }
          ],
          defaultValue: 'modify'
        },
        {
          type: 'checkbox',
          key: 'unstyled',
          label: 'Unstyled',
          defaultValue: false
        }
      ]}
      values={{
        'aria-label': 'Formatting toolbar',
        variant: 'quiet',
        orientation: 'horizontal',
        gap: 'sm',
        padding: 'sm',
        tier: 'modify',
        unstyled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Toolbar
          aria-label={values['aria-label']}
          variant={values.variant}
          orientation={values.orientation}
          gap={values.gap}
          padding={values.padding}
          tier={values.tier}
          unstyled={values.unstyled}
        >
          <Button variant="ghost" size="sm" class="font-bold">B</Button>
          <Button variant="ghost" size="sm" class="italic">I</Button>
          <Button variant="ghost" size="sm" class="underline">U</Button>
          <Separator orientation="vertical" size="sm" />
          <Button variant="ghost" size="sm">⇤</Button>
          <Button variant="ghost" size="sm">≡</Button>
          <Button variant="ghost" size="sm">⇥</Button>
          <Separator orientation="vertical" size="sm" />
          <Button variant="ghost" size="sm">🔗</Button>
          <Button variant="ghost" size="sm">📷</Button>
        </Toolbar>
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
      code={`import { Toolbar, Button, Separator } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/toolbar/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
