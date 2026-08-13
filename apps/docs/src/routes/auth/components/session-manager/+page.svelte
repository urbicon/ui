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
  description="Lists the user's active sessions, one row per signed-in device with a device label, last-active time and a 'this device' badge, and lets them sign out one session or all other devices. Requires refresh-token rotation on the server."
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
      description="The live preview runs against a mocked demo API (injected via the fetcher prop): signing a session out updates the list. The snippet shows the production setup. Needs `config.refreshToken` rotation on the server; without it the list renders an unavailable message instead."
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
      <Note title="The current device is marked with a word">
        <p>
          The current session carries a <code class="text-text-primary">Badge</code> with localized text,
          not colour alone, so the session you are sitting at stays distinguishable from the ones you
          might revoke for a reader who cannot rely on colour.
        </p>
      </Note>
      <Note title="Only the row you acted on goes busy">
        <p>
          During a revoke, only that row's button carries <code class="text-text-primary"
            >loading</code
          >
          and
          <code class="text-text-primary">disabled</code>, so the rest of the list stays operable
          and blocks' Button exposes
          <code class="text-text-primary">aria-busy</code> on the row that is actually working.
        </p>
      </Note>
      <Note title="The sign-out buttons share one accessible name">
        <p>
          Each row's sign-out button takes its accessible name from the localized "Sign out" with no
          per-row <code class="text-text-primary">aria-label</code>, so several sessions produce
          several identically named buttons and a screen-reader user tells them apart through list
          navigation rather than the button name.
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
