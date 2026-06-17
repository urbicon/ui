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
  import { Menu, type MenuObjectOption } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  let lastAction = $state('—');

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 4 },
    { id: 'installation', title: 'Installation', order: 5 }
  ];

  const playgroundItems: MenuObjectOption[] = [
    { label: 'Dashboard', onSelect: () => (lastAction = 'Dashboard') },
    { label: 'User Settings', onSelect: () => (lastAction = 'User Settings') },
    { label: 'Notifications', onSelect: () => (lastAction = 'Notifications') },
    { label: 'Billing', onSelect: () => (lastAction = 'Billing') },
    { label: 'Help', onSelect: () => (lastAction = 'Help') }
  ];
</script>

<SeoMeta
  title="Menu Component"
  description="Action menu with sections, sub-menus, custom triggers, and keyboard navigation."
/>

<DocsPageLayout
  title="Menu"
  description="Action menu for invoking actions. Items dispatch onSelect callbacks. For selecting a value from a list, use Select."
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
      componentName="Menu"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Trigger Variant',
          items: [
            { label: 'outlined', value: 'outlined' },
            { label: 'filled', value: 'filled' },
            { label: 'ghost', value: 'ghost' },
            { label: 'text', value: 'text' }
          ],
          defaultValue: 'outlined'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Trigger Intent',
          items: [
            { label: 'neutral', value: 'neutral' },
            { label: 'primary', value: 'primary' },
            { label: 'secondary', value: 'secondary' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' }
          ],
          defaultValue: 'neutral'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Trigger Size',
          items: [
            { label: '2xs', value: '2xs' },
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
          key: 'tier',
          label: 'Tier',
          items: [
            { label: 'commit (pill)', value: 'commit' },
            { label: 'modify (soft)', value: 'modify' }
          ],
          defaultValue: 'commit'
        },
        {
          type: 'dropdown',
          key: 'itemSize',
          label: 'Item Size',
          description: 'Size of list items, independent from trigger size.',
          items: [
            { label: '(inherit)', value: '' },
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: ''
        },
        {
          type: 'dropdown',
          key: 'placement',
          label: 'Placement',
          items: [
            { label: 'bottom-start', value: 'bottom-start' },
            { label: 'bottom', value: 'bottom' },
            { label: 'bottom-end', value: 'bottom-end' },
            { label: 'top-start', value: 'top-start' },
            { label: 'top', value: 'top' },
            { label: 'top-end', value: 'top-end' }
          ],
          defaultValue: 'bottom-start'
        },
        {
          type: 'dropdown',
          key: 'chevronAnimation',
          label: 'Chevron Animation',
          description: 'How the chevron icon animates when the menu opens.',
          items: [
            { label: 'rotate', value: 'rotate' },
            { label: 'translate', value: 'translate' },
            { label: 'fade', value: 'fade' },
            { label: 'none', value: 'none' }
          ],
          defaultValue: 'rotate'
        },
        {
          type: 'text',
          key: 'placeholder',
          label: 'Placeholder',
          defaultValue: 'Actions'
        },
        { type: 'checkbox', key: 'syncWidth', label: 'Sync Width', defaultValue: true },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false },
        { type: 'checkbox', key: 'loading', label: 'Loading', defaultValue: false }
      ]}
      values={{
        variant: 'outlined',
        intent: 'neutral',
        size: 'md',
        tier: 'commit',
        itemSize: '',
        placement: 'bottom-start',
        chevronAnimation: 'rotate',
        placeholder: 'Actions',
        syncWidth: true,
        disabled: false,
        loading: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        {@const menuProps = {
          ...values,
          itemSize: values.itemSize || undefined,
          chevronAnimation: values.chevronAnimation || undefined
        }}
        <div class="flex items-center gap-4">
          <Menu {...menuProps} items={playgroundItems} />
          <span class="text-text-tertiary text-sm">
            Last action: <code>{lastAction}</code>
          </span>
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
      code={`import { Menu, MenuItem, MenuDivider, MenuSection } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/menu/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
