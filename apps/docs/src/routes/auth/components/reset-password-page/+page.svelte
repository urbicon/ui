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
  title="ResetPasswordPage - Auth"
  description="Pre-built reset-password page with password confirmation."
/>

<DocsPageLayout
  title="ResetPasswordPage"
  description="Pre-built reset-password page with password confirmation."
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
    <CodeExample title="Basic" code={basicCode} language="svelte">
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker="02" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Both failures land in the same place">
        <p>
          The mismatch check runs in the browser before anything is sent, and it writes to the same
          page-level <code class="text-text-primary">aria-live="polite"</code> region as the server's
          invalid-token error. One region means a reader learns every way this page can fail from one
          spot, instead of having to hunt for which of two messages appeared.
        </p>
      </Note>
      <Note title="The mismatch is not tied to either field">
        <p>
          Unlike RegisterPage — which passes the mismatch to the field as
          <code class="text-text-primary">error</code> and gets
          <code class="text-text-primary">aria-invalid</code>
          — this page reports it only as page-level text. The reader hears
          <em>that</em> the passwords differ, not <em>which</em> field to fix. With exactly two fields
          that is recoverable, but it is a real difference between the two pages.
        </p>
      </Note>
      <Note title="Autofill hints">
        <p>
          Both fields are <code class="text-text-primary">autoComplete="new-password"</code>, so a
          password manager offers to generate and then store the new secret rather than refilling
          the old one.
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
      code={`import { ResetPasswordPage } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/reset-password-page/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
