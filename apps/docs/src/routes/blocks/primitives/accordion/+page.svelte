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
  import { Accordion, AccordionItem } from '@urbicon-ui/blocks';
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
    { id: 'collapsible', title: 'Built on Collapsible', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];

  function accordionCodeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      variant: 'default',
      size: 'md',
      type: 'single',
      collapsible: true,
      disabled: false
    };

    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false) return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'boolean') return value ? key : '';
        if (typeof value === 'string') return `${key}="${value}"`;
        return `${key}={${JSON.stringify(value)}}`;
      })
      .filter(Boolean);

    const propsStr = props.length > 0 ? ` ${props.join(' ')}` : '';

    return `<Accordion${propsStr}>
  <AccordionItem value="item-1" title="Section One">
    Content for the first section.
  </AccordionItem>
  <AccordionItem value="item-2" title="Section Two">
    Content for the second section.
  </AccordionItem>
  <AccordionItem value="item-3" title="Section Three">
    Content for the third section.
  </AccordionItem>
</Accordion>`;
  }
</script>

<SeoMeta
  title="Accordion Component"
  description="Collapsible content sections with expand/collapse animation, single or multiple mode, and full keyboard navigation."
/>

<DocsPageLayout
  title="Accordion"
  description="Collapsible content sections with expand/collapse animation. Supports single or multiple open items, three visual variants, keyboard navigation, and full ARIA accordion pattern."
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
      componentName="Accordion"
      {propDocs}
      {variantKeys}
      codeGenerator={accordionCodeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'default', value: 'default' },
            { label: 'separated', value: 'separated' },
            { label: 'ghost', value: 'ghost' }
          ],
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'type',
          label: 'Type',
          items: [
            { label: 'single', value: 'single' },
            { label: 'multiple', value: 'multiple' }
          ],
          defaultValue: 'single'
        },
        { type: 'checkbox', key: 'collapsible', label: 'Collapsible', defaultValue: true },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        variant: 'default',
        size: 'md',
        type: 'single',
        collapsible: true,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="w-full max-w-lg">
          <Accordion
            variant={values.variant}
            size={values.size}
            type={values.type}
            collapsible={values.collapsible}
            disabled={values.disabled}
            defaultValue="item-1"
          >
            <AccordionItem value="item-1" title="What are design tokens?">
              <p class="text-text-secondary text-sm">
                Design tokens are named values — colors, spacing, radii — that form the single
                source of truth for your design system.
              </p>
            </AccordionItem>
            <AccordionItem value="item-2" title="How does theming work?">
              <p class="text-text-secondary text-sm">
                Semantic tokens map to foundation tokens. Swap the foundation layer and the entire
                UI updates automatically.
              </p>
            </AccordionItem>
            <AccordionItem value="item-3" title="Is dark mode automatic?">
              <p class="text-text-secondary text-sm">
                Yes — semantic tokens handle dark mode via the CSS light-dark() function. No manual
                dark: classes needed.
              </p>
            </AccordionItem>
          </Accordion>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="05"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="06" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Accordion, AccordionItem } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/accordion/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
