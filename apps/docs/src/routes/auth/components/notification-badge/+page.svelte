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
      <Note title="The handler decides what it is">
        <p>
          With an <code class="text-text-primary">onclick</code> the badge is a
          <code class="text-text-primary">role="button"</code> with
          <code class="text-text-primary">tabindex="0"</code>, activated by
          <Kbd keys="Enter" /> or <Kbd keys="Space" />. Without one it is a
          <code class="text-text-primary">role="status"</code> — a polite live region, so a count
          that changes announces itself — and it stays out of the tab order rather than being a
          focus stop on which every key is dead. Pass <code class="text-text-primary">role</code>
          explicitly to override either. The badge keeps the interactive styling (pointer cursor, hover
          scale) in both cases, so a decorative count still looks clickable; wrap it in your own button
          where that would mislead.
        </p>
      </Note>
      <Note title="It names itself">
        <p>
          The visible content is <code class="text-text-primary">3</code> or
          <code class="text-text-primary">99+</code>, and the accessible name is the localized
          <code class="text-text-primary">notifications.badge.unread</code> with that same text
          substituted — "Unread notifications: 3" — so the badge never announces a bare number. Past
          the cap the name says <code class="text-text-primary">99+</code> too, not the real count:
          a voice-control user can only say the label they can read. Your own
          <code class="text-text-primary">aria-label</code> wins over it, as does a
          <code class="text-text-primary">t</code> override of the string.
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
