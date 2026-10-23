<script lang="ts">
  import { ThemeSwitcher } from '@urbicon-ui/blocks';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { componentData } from './api';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';

  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta
  title="ThemeSwitcher Component"
  description="A button that switches the theme between light, dark, and system, and remembers the choice in localStorage."
/>

<DocsPageLayout
  title="ThemeSwitcher"
  description="A button that switches the theme between light, dark, and system, and remembers the choice in localStorage. It cycles through the three by default, or toggles between light and dark only."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
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
  (() => {
    var d = document.documentElement;
    // Storage is not guaranteed usable: reading it throws where it is switched
    // off (a hardened profile, an embedded webview), and an unguarded read
    // aborts the rest of this head script.
    var read = (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    };
    // Only explicit choices set a class; system mode leaves
    // color-scheme: light dark to follow the OS via light-dark().
    var t = read('urbicon-theme');
    if (t === 'dark') d.classList.add('dark');
    else if (t === 'light') d.classList.add('light');
  })();
<` +
          `/script>`}
        language="html"
        preview={false}
      />
    </div>
  </Section>
</DocsPageLayout>
