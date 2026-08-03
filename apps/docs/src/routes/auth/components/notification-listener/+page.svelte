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
  // Die Vorschau zeigt `BasicDemo`, nicht `Basic`: Letzteres mountet den echten
  // Listener, der beim Mount einen SSE-Stream gegen einen Endpunkt öffnet, den
  // diese Seite nicht hat. Gedruckt wird trotzdem `Basic` — der Aufruf, den ein
  // Leser übernimmt.
  import BasicExample from './examples/BasicDemo.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'usage', title: 'Usage' },
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
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
