<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { ThemeSwitcher } from '@urbicon-ui/blocks';
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
      name: 'theme',
      type: "'light' | 'dark' | 'system'",
      defaultValue: "'system'",
      description: 'Current theme. Supports bind:theme for two-way binding.'
    },
    {
      name: 'strategy',
      type: "'cycle' | 'toggle'",
      defaultValue: "'cycle'",
      description:
        "Interaction mode. 'cycle' rotates light → dark → system. 'toggle' switches light ↔ dark."
    },
    {
      name: 'storageKey',
      type: 'string | false',
      defaultValue: "'urbicon-theme'",
      description: 'localStorage key for persistence. Set to false to disable.'
    },
    {
      name: 'onThemeChange',
      type: '(theme: Theme) => void',
      description: 'Called after the theme changes.'
    },
    {
      name: 'variant',
      type: "'ghost' | 'outlined' | 'filled'",
      defaultValue: "'ghost'",
      description: 'Visual style of the button.'
    },
    {
      name: 'size',
      type: "'sm' | 'md' | 'lg'",
      defaultValue: "'md'",
      description: 'Button dimensions.'
    },
    {
      name: 'disabled',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Disable the switcher.'
    },
    {
      name: 'unstyled',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Strip all default styles.'
    },
    {
      name: 'slotClasses',
      type: "Partial<Record<'button' | 'icon', string>>",
      description: 'Per-slot CSS class overrides for button and icon.'
    },
    {
      name: 'class',
      type: 'string',
      description: 'Additional CSS classes on the button element.'
    }
  ];
</script>

<SeoMeta
  title="ThemeSwitcher Component"
  description="Light/dark/system theme switcher with localStorage persistence, system preference detection, and multiple interaction modes."
/>

<DocsPageLayout
  title="ThemeSwitcher"
  description="Light/dark/system theme switcher with localStorage persistence, system preference detection, and multiple interaction modes."
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
      componentName="ThemeSwitcher"
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'ghost', value: 'ghost' },
            { label: 'outlined', value: 'outlined' },
            { label: 'filled', value: 'filled' }
          ],
          defaultValue: 'ghost'
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
          key: 'strategy',
          label: 'Strategy',
          items: [
            { label: 'cycle', value: 'cycle' },
            { label: 'toggle', value: 'toggle' }
          ],
          defaultValue: 'cycle'
        },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{ variant: 'ghost', size: 'md', strategy: 'cycle', disabled: false }}
      showHeader={false}
    >
      {#snippet children(values)}
        <ThemeSwitcher {...values} storageKey={false} />
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
      code={`import { ThemeSwitcher } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
    <div class="mt-4">
      <CodeExample
        title="FOUC Prevention"
        code={`<!-- Add to app.html <head> for flash-free theme loading -->
<` +
          `script>
  // Only explicit choices set a class; system mode leaves
  // color-scheme: light dark to follow the OS via light-dark().
  const t = localStorage.getItem('urbicon-theme');
  if (t === 'dark') document.documentElement.classList.add('dark');
  else if (t === 'light') document.documentElement.classList.add('light');
<` +
          `/script>`}
        language="html"
        preview={false}
      />
    </div>
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
