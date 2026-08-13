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
  title="VerifyEmailPage - Auth"
  description="A page that verifies the email token from the URL on mount and shows the result."
/>

<DocsPageLayout
  title="VerifyEmailPage"
  description="A page that verifies the email token from the URL on mount and shows the result. It has no loginUrl of its own; render the onward link through the links snippet."
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
      description="The live preview mocks a successful verification via the fetcher prop (the static docs site has no auth backend). The snippet shows the production setup."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="One region for a process the user never started">
        <p>
          Verification fires on mount from the token in the URL, so the user takes no action and has
          nothing to watch. All three states (spinner, success, failure) render inside a single
          <code class="text-text-primary">aria-live="polite"</code> wrapper, so the outcome is announced
          when it arrives. It keeps to this one region instead of the shell's shared error region, which
          would put two live regions on the page competing to report the same event.
        </p>
      </Note>
      <Note title="The spinner has words next to it">
        <p>
          The loading state renders the localized "verifying" text inside the live region alongside
          the spinner. A spinner alone conveys nothing to a screen reader; the text is what actually
          gets announced.
        </p>
      </Note>
      <Note title="Focus stays where it was">
        <p>
          Nothing on this page moves focus when the result arrives. The live region carries the
          announcement instead. A user who tabs away mid-verification is not returned to the result.
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
      code={`import { VerifyEmailPage } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/verify-email-page/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
