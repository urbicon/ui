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
  import { SplitPane } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 4 },
    { id: 'installation', title: 'Installation', order: 5 }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      orientation: 'horizontal',
      collapsible: false,
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
        return `${key}="${value}"`;
      })
      .filter(Boolean);

    const propsStr = props.length > 0 ? ` ${props.join(' ')}` : '';

    return `<SplitPane${propsStr} defaultRatio={0.4} min="20%" max="80%">
  {#snippet start()}
    <nav class="h-full overflow-auto p-4">Sidebar</nav>
  {/snippet}
  {#snippet end()}
    <main class="h-full overflow-auto p-4">Content</main>
  {/snippet}
</SplitPane>`;
  }
</script>

<SeoMeta
  title="SplitPane Component"
  description="Resizable two-pane layout with a draggable divider — keyboard-accessible (WAI-ARIA window splitter), collapsible, horizontal or vertical."
/>

<DocsPageLayout
  title="SplitPane"
  description="Resizable two-pane layout with a draggable divider. The divider is the WAI-ARIA 'window splitter' — focusable, keyboard-resizable, and optionally collapsible. Panes clip their own overflow and scroll independently. Reach for it when both regions are primary content the user should be able to rebalance."
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
      componentName="SplitPane"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
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
        { type: 'checkbox', key: 'collapsible', label: 'Collapsible', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        orientation: 'horizontal',
        collapsible: false,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="border-border-subtle h-80 w-full overflow-hidden rounded-xl border">
          <SplitPane
            orientation={values.orientation as 'horizontal' | 'vertical'}
            collapsible={values.collapsible as boolean}
            disabled={values.disabled as boolean}
            defaultRatio={0.4}
            min="20%"
            max="80%"
          >
            {#snippet start()}
              <div class="bg-surface-elevated flex h-full items-center justify-center p-4">
                <span class="text-text-secondary text-sm font-medium">Start pane</span>
              </div>
            {/snippet}
            {#snippet end()}
              <div class="flex h-full items-center justify-center p-4">
                <span class="text-text-secondary text-sm font-medium">End pane</span>
              </div>
            {/snippet}
          </SplitPane>
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
      code={`import { SplitPane } from '@urbicon-ui/blocks';
import type { SplitPaneProps, SplitPaneLimit, SplitPaneOrientation } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/split-pane/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
