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
  title="NotificationCenter - Auth"
  description="A notification list with mark-as-read, delete and an empty state."
/>

<DocsPageLayout
  title="NotificationCenter"
  description="A notification list with per-item mark-as-read and delete, an empty state, and each entry rendered as a clickable card with its timestamp."
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
      <Note title="Each notification is a button">
        <p>
          The body of every item is a <code class="text-text-primary">&lt;button&gt;</code>, not a
          click handler on the <code class="text-text-primary">&lt;li&gt;</code>, so it is reachable
          with
          <Kbd keys="Tab" /> and activatable with <Kbd keys="Enter" /> or
          <Kbd keys="Space" /> without any extra ARIA.
        </p>
      </Note>
      <Note title="Unread state does not reach assistive tech">
        <p>
          The unread dot is <code class="text-text-primary">aria-hidden="true"</code>, so it is
          decoration. Nothing replaces it: the read/unread distinction lives only in that dot, a
          background tint, and a <code class="text-text-primary">data-unread</code> attribute for
          CSS, so a screen-reader user cannot currently tell a read notification from an unread one.
          Use the
          <code class="text-text-primary">item</code> snippet if your application needs that distinction
          spoken.
        </p>
      </Note>
      <Note title="The delete button is icon-only and generically named">
        <p>
          It renders a <code class="text-text-primary">×</code> glyph, so an
          <code class="text-text-primary">aria-label</code> is present, but it is the bare localized "Delete"
          without the notification's title. In a list of ten notifications that is ten identically named
          buttons, and a reader tells them apart through list position rather than the button name.
        </p>
      </Note>
      <Note title="The list is announced; the timestamp is text only">
        <p>
          Items sit in a <code class="text-text-primary">&lt;ul&gt;</code>, so the count is
          announced before the contents. The relative age uses a
          <code class="text-text-primary">&lt;time&gt;</code> element but supplies no
          <code class="text-text-primary">datetime</code> attribute, and its text ("1h ago") is not a
          valid datetime string, so the element carries no machine-readable date and gives assistive tech
          nothing the plain text would not. Treat it as styling, not semantics.
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
      code={`import { NotificationCenter } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/notification-center/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
