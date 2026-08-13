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
  title="ForgotPasswordPage - Auth"
  description="A form that requests a password-reset email."
/>

<DocsPageLayout
  title="ForgotPasswordPage"
  description="A form that requests a password-reset email."
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
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Both outcomes are announced">
        <p>
          The error region below the heading is always mounted and
          <code class="text-text-primary">aria-live="polite"</code>, so a server or network failure
          is announced without moving focus. On success the form is replaced by an
          <code class="text-text-primary">Alert</code> with
          <code class="text-text-primary">role="alert"</code>, so the outcome reaches the reader on
          either path and focus stays where the user left it. The success screen appears whether or
          not the address has an account, so the page never reveals which emails are registered.
        </p>
      </Note>
      <Note title="A single labelled field">
        <p>
          The one input is <code class="text-text-primary">type="email"</code>,
          <code class="text-text-primary">required</code>, and
          <code class="text-text-primary">autoComplete="email"</code>. The
          <code class="text-text-primary">Input</code> primitive renders a real
          <code class="text-text-primary">&lt;label for&gt;</code> tied to the field id, so clicking the
          label focuses the field and the reader announces the two together.
        </p>
      </Note>
      <Note title="Submit reports its own busy state">
        <p>
          While the request is in flight the button is both
          <code class="text-text-primary">disabled</code> and
          <code class="text-text-primary">aria-busy</code>
          (blocks' Button sets the latter from <code class="text-text-primary">loading</code>). A
          user who hears nothing after pressing Enter can still query the button and learn that the
          request is running.
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
      code={`import { ForgotPasswordPage } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/forgot-password-page/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
