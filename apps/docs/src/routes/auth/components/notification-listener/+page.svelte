<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { asset, resolve } from '$app/paths';
  import { componentData } from './api';
  import BasicExample from './examples/Basic.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  const navigation = [
    { id: 'usage', title: 'Usage', order: 1 },
    { id: 'api', title: 'API Reference', order: 2 },
    { id: 'installation', title: 'Installation', order: 3 }
  ];
</script>

<SeoMeta
  title="NotificationListener - Auth"
  description="Headless SSE listener that connects to the notification stream."
/>

<DocsPageLayout
  title="NotificationListener"
  description="Headless SSE listener that connects to the notification stream. Fires a callback on each incoming notification. No visual output."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Auth', href: resolve('/auth') },
    { label: 'Components', href: resolve('/auth') }
  ]}
  {navigation}
>
  <Section id="usage" intent="primary">
    <CodeExample title="Basic" code={basicCode} language="svelte">
      <BasicExample />
    </CodeExample>
  </Section>

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { NotificationListener } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/notification-listener/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
