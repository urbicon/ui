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
  description="Lists a user's registered passkeys and lets them add, rename or remove one."
/>

<DocsPageLayout
  title="PasskeyManager"
  description="Lists a user's registered passkeys (WebAuthn credentials) and lets them register a new one, rename one in place, or delete one."
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
      description="The live preview runs against a mocked demo API (injected via the fetcher prop): renaming and deleting passkeys work, and registering explains that it needs a real backend. The snippet shows the production setup."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Every row button says which passkey it acts on">
        <p>
          The visible text is just "Rename" or "Delete", but each button carries
          <code class="text-text-primary">aria-label</code> with the passkey's name appended. A reader
          tabbing the list hears "Delete — MacBook Pro" rather than four identical buttons, and because
          the accessible name still begins with the visible word, voice control ("click Delete") keeps
          working.
        </p>
      </Note>
      <Note title="Renaming keeps the keyboard where it was">
        <p>
          "Rename" swaps the row's name for a labelled text field and moves focus into it with the
          current name selected, so typing replaces it. Enter or "Save" commits;
          <kbd class="text-text-primary">Escape</kbd> or "Cancel" restores the stored name. Escape does
          not bubble, so the panel can sit inside a dialog without the rename form and the dialog closing
          together. Focus returns to that row's "Rename" button either way — it is never dropped to the
          top of the document — and a refused rename keeps the field open with the draft so it can be
          corrected in place.
        </p>
      </Note>
      <Note title="Errors announce in place">
        <p>
          WebAuthn failures (a cancelled prompt, an unsupported authenticator, a rejected
          registration) land in the always-mounted
          <code class="text-text-primary">aria-live="polite"</code> region above the list, so the outcome
          of a flow that ran inside the browser's own credential UI is announced back on the page. A completed
          rename reports there too: the row's own text changes without a word otherwise.
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
          Windows Hello or a security key. That dialog's accessibility belongs to the operating
          system, not this component; what comes back from it is announced through the live region.
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
