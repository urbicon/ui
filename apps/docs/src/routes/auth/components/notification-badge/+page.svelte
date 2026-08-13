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
  import { Kbd } from '@urbicon-ui/blocks';
  import { asset, resolve } from '$app/paths';
  import { buildRelatedLinks } from '$lib/component-links';
  import { componentData } from './api';
  import BasicExample from './examples/Basic.svelte';
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
  title="NotificationBadge - Auth"
  description="An unread-count badge that renders nothing when the count is 0."
/>

<DocsPageLayout
  title="NotificationBadge"
  description="An unread-count badge that renders nothing when the count is 0."
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
  <Section marker id="usage" title="Usage" intent="primary">
    <CodeExample title="Basic" code={basicCode} language="svelte">
      <BasicExample />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Nothing is rendered at zero">
        <p>
          The badge only exists while <code class="text-text-primary">count &gt; 0</code>. At zero
          it renders nothing at all, so a keyboard user tabbing past a quiet bell moves straight to
          the next control instead of stopping on an empty badge.
        </p>
      </Note>
      <Note title="It is always a button, even without a handler">
        <p>
          The badge always takes <code class="text-text-primary">role="button"</code> and
          <code class="text-text-primary">tabindex="0"</code>, but
          <code class="text-text-primary">onclick</code> is optional and the key handler fires only
          when one was given. A badge with no handler is still a focusable stop that announces as a
          button and does nothing on
          <Kbd keys="Enter" /> or <Kbd keys="Space" />, so pass an
          <code class="text-text-primary">onclick</code>, or wrap the count in your own button
          rather than leaving the badge to stand alone.
        </p>
      </Note>
      <Note title="The accessible name is only the number">
        <p>
          The badge's entire content is <code class="text-text-primary">3</code> or
          <code class="text-text-primary">99+</code>, and it takes no
          <code class="text-text-primary">aria-label</code> of its own, so alone it announces a bare number.
          Give the bell button the name instead: label it "Notifications" and let the badge supply the
          count inside it.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section marker id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { NotificationBadge } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/notification-badge/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
