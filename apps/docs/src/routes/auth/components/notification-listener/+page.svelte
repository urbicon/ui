<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section,
    TypesReference
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
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
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

  <Section marker="02" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="It renders no DOM at all">
        <p>
          The component is a lifecycle hook around an
          <code class="text-text-primary">EventSource</code> — there is no markup, so it adds nothing
          to the accessibility tree, cannot be focused, and cannot be reached by a screen reader. Placing
          it anywhere in the page is equally correct.
        </p>
      </Note>
      <Note title="Announcing an arrival is the consumer’s job">
        <p>
          Because it renders nothing, a notification arriving over the stream is completely silent
          for assistive tech. If arrival should be announced, route
          <code class="text-text-primary">onNotification</code> somewhere that speaks — a live region
          of your own, a toast, or the badge and centre this component is meant to feed.
        </p>
      </Note>
      <Note title="Reconnection is silent by design">
        <p>
          Dropped connections retry with exponential backoff and give up after
          <code class="text-text-primary">maxReconnectAttempts</code>, reporting through
          <code class="text-text-primary">onError</code> and
          <code class="text-text-primary">onReconnect</code> callbacks rather than any UI. If a stalled
          stream should be visible to the user, that surface is yours to build — silently missing notifications
          is the failure mode worth designing against.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section marker="03" id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker="04" id="installation" title="Installation">
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
