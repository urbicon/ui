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
  import { Scroller } from '@urbicon-ui/blocks';
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

  const cards = [
    { id: 'sync', title: 'Sync', body: 'Keeps every device on the same page.' },
    { id: 'audit', title: 'Audit', body: 'Every change, with who and when.' },
    { id: 'reports', title: 'Reports', body: 'Numbers your board actually reads.' },
    { id: 'access', title: 'Access', body: 'Roles, invites and passkeys.' },
    { id: 'api', title: 'API', body: 'Everything the UI does, scriptable.' }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      align: 'start',
      snap: 'proximity',
      gap: 'md',
      controls: 'auto',
      indicator: 'none',
      itemBasis: '16rem',
      emphasis: false
    };

    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false) return false;
        return true;
      })
      .map(([key, value]) => (typeof value === 'boolean' ? key : `${key}="${value}"`));

    const propsStr = props.length > 0 ? ` ${props.join(' ')}` : '';

    return `<Scroller label="Main features"${propsStr}>
  {#each features as feature (feature.id)}
    <FeatureCard {...feature} />
  {/each}
</Scroller>`;
  }
</script>

<SeoMeta
  title="Scroller Component"
  description="Horizontal row that becomes scrollable only when it runs out of room — snap points, a keyboard-reachable scroll region, optional jump buttons and dots, and a CSS-only centred stage."
/>

<DocsPageLayout
  title="Scroller"
  description="A horizontal row of equal-rank items that scrolls only when it has to. On a wide viewport it is an ordinary row — no scrolling, no arrows, no dots, and none of the accessibility duties a scroll container carries. Once it overflows it snaps to item boundaries and becomes a named, keyboard-reachable scroll region. It never auto-rotates."
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
      componentName="Scroller"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'align',
          label: 'Align',
          items: [
            { label: 'start', value: 'start' },
            { label: 'center', value: 'center' }
          ],
          defaultValue: 'start'
        },
        {
          type: 'dropdown',
          key: 'itemBasis',
          label: 'Item width',
          items: [
            { label: '12rem', value: '12rem' },
            { label: '16rem', value: '16rem' },
            { label: '22rem', value: '22rem' }
          ],
          defaultValue: '16rem'
        },
        {
          type: 'dropdown',
          key: 'snap',
          label: 'Snap',
          items: [
            { label: 'proximity', value: 'proximity' },
            { label: 'mandatory', value: 'mandatory' },
            { label: 'none', value: 'none' }
          ],
          defaultValue: 'proximity'
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
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'controls',
          label: 'Controls',
          items: [
            { label: 'auto', value: 'auto' },
            { label: 'always', value: 'always' },
            { label: 'none', value: 'none' }
          ],
          defaultValue: 'auto'
        },
        {
          type: 'dropdown',
          key: 'indicator',
          label: 'Indicator',
          items: [
            { label: 'none', value: 'none' },
            { label: 'dots', value: 'dots' }
          ],
          defaultValue: 'none'
        },
        { type: 'checkbox', key: 'emphasis', label: 'Emphasis', defaultValue: false }
      ]}
      values={{
        align: 'start',
        itemBasis: '16rem',
        snap: 'proximity',
        gap: 'md',
        controls: 'auto',
        indicator: 'none',
        emphasis: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Scroller
          label="Main features"
          align={values.align as 'start' | 'center'}
          snap={values.snap as 'proximity' | 'mandatory' | 'none'}
          gap={values.gap as 'xs' | 'sm' | 'md' | 'lg' | 'xl'}
          itemBasis={values.itemBasis as string}
          controls={values.controls as 'auto' | 'always' | 'none'}
          indicator={values.indicator as 'none' | 'dots'}
          emphasis={values.emphasis as boolean}
        >
          {#each cards as card (card.id)}
            <article class="border-border-subtle bg-surface-elevated rounded-contain border p-4">
              <h3 class="text-text-primary text-sm font-semibold">{card.title}</h3>
              <p class="text-text-secondary mt-1 text-sm">{card.body}</p>
            </article>
          {/each}
        </Scroller>
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
      code={`import { Scroller } from '@urbicon-ui/blocks';
import type { ScrollerProps, ScrollerAlign } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/scroller/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
