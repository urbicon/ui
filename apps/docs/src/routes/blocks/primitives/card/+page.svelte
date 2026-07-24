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
  import { Card, Button } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

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
  title="Card Component"
  description="Flexible container for grouping related content with headers, footers, and interactive states."
/>

<DocsPageLayout
  title="Card"
  description="Flexible container for grouping related content with headers, footers, and interactive states."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Card"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'quiet', value: 'quiet' },
            { label: 'outlined', value: 'outlined' },
            { label: 'elevated', value: 'elevated' },
            { label: 'floating', value: 'floating' }
          ],
          defaultValue: 'quiet'
        },
        {
          type: 'dropdown',
          key: 'padding',
          label: 'Padding',
          items: [
            { label: 'none', value: 'none' },
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' }
          ],
          defaultValue: 'md'
        },
        { type: 'checkbox', key: 'dividers', label: 'Dividers', defaultValue: false },
        { type: 'checkbox', key: 'clickable', label: 'Clickable', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        variant: 'quiet',
        padding: 'md',
        dividers: false,
        clickable: false,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="max-w-md">
          <Card
            variant={values.variant}
            padding={values.padding}
            dividers={values.dividers}
            clickable={values.clickable}
            disabled={values.disabled}
          >
            {#snippet header()}
              <div class="font-semibold">Card Title</div>
              <div class="text-text-tertiary text-xs">Optional subtitle</div>
            {/snippet}

            <div class="text-text-secondary text-sm">
              Cards group related content. Change variant and padding to see different looks.
            </div>

            {#snippet footer()}
              <div class="flex justify-end gap-2">
                <Button variant="ghost" size="sm">Cancel</Button>
                <Button variant="filled" intent="primary" size="sm">Confirm</Button>
              </div>
            {/snippet}
          </Card>
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
      code={`import { Card } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/card/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
