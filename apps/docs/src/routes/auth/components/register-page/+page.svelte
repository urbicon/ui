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
  title="RegisterPage - Auth"
  description="Pre-built registration page with invitation-gated signup."
/>

<DocsPageLayout
  title="RegisterPage"
  description="Pre-built registration page with invitation-gated signup. Uses blocks primitives, fully localizable and customizable."
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
      <Note title="The requirements list has a name">
        <p>
          The password checklist is a real <code class="text-text-primary">&lt;ul&gt;</code>
          carrying
          <code class="text-text-primary">aria-label</code>, so a reader announces it as a named
          list with a known item count instead of four orphaned lines under a text field. It is also
          the only explanation for why the submit button is disabled — but it renders only once the
          password field has content, and not at all when
          <code class="text-text-primary">showRequirements</code> is
          <code class="text-text-primary">false</code>. In both of those states the button is
          disabled with no reachable reason at all, so supply your own explanation if you turn the
          checklist off.
        </p>
      </Note>
      <Note title="Pass/fail is text, not colour">
        <p>
          Each requirement is prefixed with a literal <code class="text-text-primary">✓</code> or
          <code class="text-text-primary">✗</code> character, not an icon and not a colour swap
          alone, so the state survives both a screen reader and a monochrome display. The
          <code class="text-text-primary">data-met</code> attribute mirrors it for CSS only. Note the
          list is not itself a live region: it updates as you type but is not announced on every keystroke,
          which would make the field unusable with speech output.
        </p>
      </Note>
      <Note title="Mismatch is bound to the field">
        <p>
          A confirm-password mismatch is passed to the field as the
          <code class="text-text-primary">error</code> prop, so
          <code class="text-text-primary">Input</code>
          sets
          <code class="text-text-primary">aria-invalid</code> and links the message through
          <code class="text-text-primary">aria-describedby</code>. The reader hears the problem
          while focus is on the field that has it — server-side failures go to the page-level live
          region instead.
        </p>
      </Note>
      <Note title="Autofill hints">
        <p>
          <code class="text-text-primary">autoComplete</code> is set on all four fields —
          <code class="text-text-primary">name</code>, <code class="text-text-primary">email</code>,
          and
          <code class="text-text-primary">new-password</code> on both password fields, which is the signal
          a password manager needs to offer a generated password rather than the saved one.
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
      code={`import { RegisterPage } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/register-page/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
