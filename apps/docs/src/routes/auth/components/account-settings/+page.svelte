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
  title="AccountSettings - Auth"
  description="Self-service panel to change name, email and password, and delete the account."
/>

<DocsPageLayout
  title="AccountSettings"
  description="Self-service account panel to change name, email and password, and delete the account. Every change except the profile rename asks for the current password first."
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
      description="The live preview runs against a mocked demo API (injected via the fetcher prop): the profile rename succeeds, and deleting explains that it needs a real backend. The snippet shows the production setup, where `user` comes from your auth store or `locals.user`."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="One live region per block">
        <p>
          Profile, email and password each have a separate
          <code class="text-text-primary">aria-live="polite"</code> region inside their own
          <code class="text-text-primary">&lt;form&gt;</code>, and account deletion has a fourth in
          its section. With three save buttons on one page, one region per form is what lets a
          reader tell which save just succeeded.
        </p>
      </Note>
      <Note title="The danger zone is a named landmark">
        <p>
          Account deletion sits in a <code class="text-text-primary">&lt;section&gt;</code> with
          <code class="text-text-primary">aria-labelledby</code> pointing at its own heading, so it
          is reachable and distinguishable from the three ordinary save forms above it. The delete
          button stays
          <code class="text-text-primary">disabled</code> until the password is typed, so enabling it
          takes a deliberate entry.
        </p>
      </Note>
      <Note title="The confirm step is a modal dialog">
        <p>
          Deletion routes through blocks' <code class="text-text-primary">ConfirmDialog</code>,
          which renders
          <code class="text-text-primary">aria-modal="true"</code>, takes its accessible name from
          the dialog title, keeps <Kbd keys="Tab" /> within the dialog, and moves focus back to the trigger
          on close.
        </p>
      </Note>
      <Note title="Autofill hints, and focus stays put">
        <p>
          Every password field is <code class="text-text-primary"
            >autoComplete="current-password"</code
          >
          except the new one (<code class="text-text-primary">new-password</code>), and the name and
          email fields are hinted too. After a save, focus stays on the button and that form's live
          region announces the result.
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
      code={`import { AccountSettings } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/account-settings/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
