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
  description="A registration form gated by an invitation token, with a live password-requirements checklist."
/>

<DocsPageLayout
  title="RegisterPage"
  description="A registration form gated by an invitation token, with a live password-requirements checklist, posting to your register endpoint. Localizable through AuthLocale; restyle with snippet overrides or slotClasses."
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
      <Note title="The requirements list has a name">
        <p>
          The password checklist is a real <code class="text-text-primary">&lt;ul&gt;</code>
          carrying
          <code class="text-text-primary">aria-label</code>, and the password field points at it
          with <code class="text-text-primary">aria-describedby</code>. The list is in the DOM from
          the first paint, not from the first keystroke — a description attached to an
          already-focused field is not reliably re-announced, so rules that appeared only after
          typing would never be read at all.
        </p>
      </Note>
      <Note title="A refused password says which rule">
        <p>
          The submit button is never disabled for an unmet rule. Submitting a password that misses
          one produces an error naming the rules it misses, so the reason is reachable even with
          <code class="text-text-primary">showRequirements</code> set to
          <code class="text-text-primary">false</code>. The server's refusal carries the same rules
          as machine values plus the policy it measured against, so the message is localized and the
          form re-gates on the real policy rather than repeating the refusal.
        </p>
      </Note>
      <Note title="Pass/fail is text, not colour">
        <p>
          Each requirement is prefixed with a literal <code class="text-text-primary">✓</code> or
          <code class="text-text-primary">✗</code> character, not an icon and not a colour swap
          alone, so the state survives a monochrome display. The glyph carries
          <code class="text-text-primary">role="img"</code> with a translated accessible name
          (&ldquo;Met&rdquo; / &ldquo;Not met&rdquo;), because a bare check mark is announced in the
          reader&rsquo;s language rather than the page&rsquo;s. The
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
          while focus is on the field that has it. Server-side failures go to the page-level live
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

  <Section marker id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker id="installation" title="Installation">
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
