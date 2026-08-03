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
  import BasicExample from './examples/Basic.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'usage', title: 'Usage' },
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="PushPermissionPrompt - Auth"
  description="Dismissible prompt asking the user to enable push notifications."
/>

<DocsPageLayout
  title="PushPermissionPrompt"
  description="Dismissible prompt asking the user to enable push notifications. Handles VAPID subscription and server-side registration."
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
    <CodeExample title="Basic" code={basicCode} language="svelte">
      <BasicExample />
    </CodeExample>
  </Section>

  <Section marker="02" id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="03" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { PushPermissionPrompt } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/push-permission-prompt/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
