<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { asset, resolve } from '$app/paths';
  import { buildRelatedLinks } from '$lib/component-links';
  import { componentData } from './api';
  import Playground from './Playground.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'usage', title: 'Usage' },
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="LoginPage - Auth"
  description="Pre-built login page using blocks primitives. Fully localizable and customizable."
/>

<DocsPageLayout
  title="LoginPage"
  description="Pre-built login page using blocks primitives (Card, Input, Button, Alert). Fully localizable via AuthLocale, customizable via snippet overrides and slotClasses."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Auth', href: resolve('/auth') },
    { label: 'Components', href: resolve('/auth') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section marker="01" id="usage" title="Usage" intent="primary">
    <Playground />
    <div class="mt-6">
      <CodeExample title="Basic" code={basicCode} language="svelte" preview={false} />
    </div>
  </Section>

  <Section marker="02" id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="03" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { LoginPage } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/login-page/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
