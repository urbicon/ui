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
  title="SessionManager - Auth"
  description="Lists the user's active sessions and lets them sign out individual or all other devices."
/>

<DocsPageLayout
  title="SessionManager"
  description="Lists the user's active sessions (refresh-token families) with a device label, last-active time and a 'this device' badge, and lets them sign out one session or all other devices. Requires refresh-token rotation on the server."
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
      description="The live preview runs against a mocked demo API (injected via the fetcher prop) — signing a session out updates the list. The snippet shows the production setup. Needs `config.refreshToken` rotation on the server; without it the component reports itself unavailable."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Sessions are a list">
        <p>
          The devices render as a <code class="text-text-primary">&lt;ul&gt;</code> of
          <code class="text-text-primary">&lt;li&gt;</code>, so a screen reader announces how many
          sessions exist before reading them and the user can jump between them with list
          navigation.
        </p>
      </Note>
      <Note title="The current device is marked with a word, not a colour">
        <p>
          The current session is marked with a <code class="text-text-primary">Badge</code> containing
          localized text. Nothing on this page relies on colour alone to distinguish the session you are
          sitting at from the ones you are about to revoke — which matters because that distinction is
          the difference between signing out a stranger and signing out yourself.
        </p>
      </Note>
      <Note title="Only the row you acted on goes busy">
        <p>
          Revoking one session sets <code class="text-text-primary">loading</code> and
          <code class="text-text-primary">disabled</code> on that row's button alone, so the rest of
          the list stays operable and blocks' Button reports
          <code class="text-text-primary">aria-busy</code> only where something is actually happening.
        </p>
      </Note>
      <Note title="The per-row buttons share one accessible name">
        <p>
          Each row's sign-out button has no <code class="text-text-primary">aria-label</code>, so
          its accessible name is just the localized "Sign out" — five sessions produce five
          identically named buttons, and context has to come from list navigation. PasskeyManager
          and InvitationManager solve the same problem by appending the row's subject to the label;
          this list does not yet.
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
      code={`import { SessionManager } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/session-manager/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
