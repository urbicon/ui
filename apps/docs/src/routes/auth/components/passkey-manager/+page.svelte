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
  title="PasskeyManager - Auth"
  description="Admin panel for managing passkeys (WebAuthn credentials)."
/>

<DocsPageLayout
  title="PasskeyManager"
  description="Admin panel for managing passkeys (WebAuthn credentials). Allows registering new passkeys and deleting existing ones."
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
    <CodeExample
      title="Basic"
      description="The live preview runs against a mocked demo API (injected via the fetcher prop) — deleting passkeys works, registering explains that it needs a real backend. The snippet shows the production setup."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker="02" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Every delete button says what it deletes">
        <p>
          The visible text is just "Delete", but each button carries
          <code class="text-text-primary">aria-label</code> with the passkey's name appended. A reader
          tabbing the list hears "Delete — MacBook Pro" rather than four identical buttons, and because
          the accessible name still begins with the visible word, voice control ("click Delete") keeps
          working.
        </p>
      </Note>
      <Note title="Errors announce in place">
        <p>
          WebAuthn failures — a cancelled prompt, an unsupported authenticator, a rejected
          registration — land in the always-mounted
          <code class="text-text-primary">aria-live="polite"</code> region above the list, so the outcome
          of a flow that happened inside the browser's own credential UI is reported back in the page.
        </p>
      </Note>
      <Note title="The list is a list">
        <p>
          Registered passkeys render as <code class="text-text-primary">&lt;ul&gt;</code> /
          <code class="text-text-primary">&lt;li&gt;</code> with the name and the creation/last-used
          dates as text. The "Add passkey" button is <code class="text-text-primary">disabled</code>
          with
          <code class="text-text-primary">aria-busy</code> while registration runs.
        </p>
      </Note>
      <Note title="The credential prompt is the browser’s">
        <p>
          Once registration starts, the platform takes over with its own dialog for Touch ID,
          Windows Hello or a security key. Its accessibility is the operating system's, not this
          component's — the component's job is to report what came back, which it does through the
          live region.
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
      code={`import { PasskeyManager } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/passkey-manager/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
