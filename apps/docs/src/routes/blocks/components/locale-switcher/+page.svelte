<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { LocaleSwitcher } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];

  const apiProps = [
    {
      name: 'showFlag',
      type: 'boolean',
      defaultValue: 'true',
      description: 'Show flag emoji alongside locale name.'
    },
    {
      name: 'locales',
      type: 'Locale[]',
      description: 'Restrict displayed locales. Defaults to all locales registered in i18n.'
    },
    {
      name: 'onLocaleChange',
      type: '(locale: Locale) => void',
      description: 'Called after the locale has been changed successfully.'
    },
    {
      name: 'variant',
      type: "'ghost' | 'filled' | 'outlined' | 'text'",
      defaultValue: "'outlined'",
      description: 'Visual style of the trigger (inherited from Menu).'
    },
    {
      name: 'size',
      type: "'2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'",
      defaultValue: "'sm'",
      description: 'Size of the trigger (inherited from Menu).'
    },
    {
      name: 'intent',
      type: "'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'",
      defaultValue: "'neutral'",
      description: 'Color intent (inherited from Menu).'
    },
    {
      name: 'disabled',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Disable the selector. Also auto-disabled while loading translations.'
    },
    {
      name: 'unstyled',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Remove all default styling from the underlying Menu.'
    },
    {
      name: 'slotClasses',
      type: 'Partial<Record<MenuSlot, string>>',
      description: 'Per-slot CSS class overrides forwarded to the Menu.'
    },
    {
      name: 'class',
      type: 'string',
      description: 'Additional CSS classes applied to the root element.'
    }
  ];
</script>

<SeoMeta
  title="LocaleSwitcher Component"
  description="Language selector composed from the Menu primitive, powered by the i18n system with flag support and all Menu styling options."
/>

<DocsPageLayout
  title="LocaleSwitcher"
  description="Language selector composed from the Menu primitive, powered by the i18n system with flag support and all Menu styling options."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="LocaleSwitcher"
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
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
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'sm'
        },
        { type: 'checkbox', key: 'showFlag', label: 'Show Flag', defaultValue: true },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{ variant: 'outlined', size: 'sm', showFlag: true, disabled: false }}
      showHeader={false}
    >
      {#snippet children(values)}
        <LocaleSwitcher {...values} />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${apiProps.length} props`}
  >
    <ApiReference props={apiProps} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { LocaleSwitcher } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
