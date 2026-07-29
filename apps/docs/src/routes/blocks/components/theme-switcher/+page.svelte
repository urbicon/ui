<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { ThemeSwitcher } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { resolve } from '$app/paths';

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
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
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
</DocsPageLayout>
