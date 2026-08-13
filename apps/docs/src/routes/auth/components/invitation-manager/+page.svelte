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
  import BasicDemo from './examples/BasicDemo.svelte';
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
  title="InvitationManager - Auth"
  description="Lists sent invitations and lets an admin send new ones or delete unused ones."
/>

<DocsPageLayout
  title="InvitationManager"
  description="Lists sent invitations with their status and lets an admin invite someone new or delete an unused invitation."
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
    <CodeExample
      title="Basic"
      description="The live preview runs against a mocked demo API (injected via the fetcher prop): sending and deleting invitations works on demo data. The snippet shows the production setup."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Every delete button names its invitation">
        <p>
          Each row's button carries an
          <code class="text-text-primary">aria-label</code> that appends the invitee's email to the visible
          "Delete", so a reader can tell the rows apart without first navigating into them.
        </p>
      </Note>
      <Note title="The email field omits autofill on purpose">
        <p>
          The invite field carries no <code class="text-text-primary">autoComplete</code> hint. You are
          typing someone else's address, so offering the signed-in user's own email would be wrong every
          time.
        </p>
      </Note>
      <Note title="Status is text inside a badge">
        <p>
          Pending and registered invitations differ by the localized word in the
          <code class="text-text-primary">Badge</code>, not by colour alone. The role
          <code class="text-text-primary">Select</code> and the send-email
          <code class="text-text-primary">Checkbox</code>
          get their labels through their <code class="text-text-primary">label</code> props, so the whole
          form is navigable by label.
        </p>
      </Note>
      <Note title="One error region for the form and the list">
        <p>
          Sending and deleting share the always-mounted
          <code class="text-text-primary">aria-live="polite"</code> region below the heading, so a failure
          from either path is announced without focus leaving where the user was working.
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
      code={`import { InvitationManager } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/invitation-manager/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
