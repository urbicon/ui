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
  description="Unread notification count badge. Uses blocks Badge primitive."
/>

<DocsPageLayout
  title="NotificationBadge"
  description="Unread notification count badge. Uses blocks Badge primitive. Renders nothing when count is 0."
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
      <Note title="Nothing is rendered at zero">
        <p>
          The badge only exists while <code class="text-text-primary">count &gt; 0</code>. It leaves
          no empty element and no focusable stop behind, so tabbing past a quiet bell does not hit a
          control that announces nothing.
        </p>
      </Note>
      <Note title="It is always a button, even without a handler">
        <p>
          The component passes <code class="text-text-primary">interactive</code> to blocks'
          <code class="text-text-primary">Badge</code> unconditionally, so the badge always takes
          <code class="text-text-primary">role="button"</code> and
          <code class="text-text-primary">tabindex="0"</code> — but
          <code class="text-text-primary">onclick</code> is optional, and the key handler only fires
          when one was given. A badge rendered without a handler is therefore a focusable stop that
          announces as a button and does nothing on
          <Kbd keys="Enter" /> or <Kbd keys="Space" />. Pass an
          <code class="text-text-primary">onclick</code>, or wrap the count in your own control
          rather than leaving the badge to stand alone.
        </p>
      </Note>
      <Note title="The accessible name is only the number">
        <p>
          The badge's entire content is <code class="text-text-primary">3</code> or
          <code class="text-text-primary">99+</code>, and its props do not accept an
          <code class="text-text-primary">aria-label</code> — so on its own it announces a number with
          no noun. Give the surrounding control the name instead: label the bell button "Notifications"
          and let the badge supply the count inside it.
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
