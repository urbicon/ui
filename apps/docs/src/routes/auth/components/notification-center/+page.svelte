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
      <Note title="Unread rows say so">
        <p>
          The unread dot is <code class="text-text-primary">aria-hidden="true"</code> — it is
          decoration — and the localized "Unread" sits beside it as visually hidden text inside the
          row's button, ahead of the title. A reader tabbing the list hears "Unread, Deploy
          finished" where a sighted user sees the dot. The
          <code class="text-text-primary">data-unread</code>
          attribute stays for CSS, and the hidden word survives
          <code class="text-text-primary">unstyled</code>: it is the state, not a default look. A
          custom <code class="text-text-primary">item</code> snippet replaces the whole row, so the marker
          is yours to render there.
        </p>
      </Note>
      <Note title="The delete button names its notification">
        <p>
          It renders a <code class="text-text-primary">×</code> glyph, so the name comes from an
          <code class="text-text-primary">aria-label</code>: the localized "Delete" with the
          notification's title appended — "Delete — Deploy finished". Ten notifications are ten
          distinguishable buttons rather than ten identical ones, and the name still begins with the
          visible word, so voice control ("click Delete") keeps working.
        </p>
      </Note>
      <Note title="The list is announced, and the timestamp is machine-readable">
        <p>
          Items sit in a <code class="text-text-primary">&lt;ul&gt;</code>, so the count is
          announced before the contents. The relative age renders in a
          <code class="text-text-primary">&lt;time&gt;</code> element whose
          <code class="text-text-primary">datetime</code> attribute carries the ISO instant behind the
          rounded label, so "1h ago" has an exact time attached to it. A record whose timestamp does not
          parse drops the attribute rather than the row.
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
