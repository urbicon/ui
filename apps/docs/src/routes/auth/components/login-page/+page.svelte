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
  import Playground from './Playground.svelte';
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
  title="LoginPage - Auth"
  description="Pre-built login page using blocks primitives. Fully localizable and customizable."
/>

<DocsPageLayout
  title="LoginPage"
  description="Pre-built login page using blocks primitives (Card, Input, Button, Alert). Fully localizable via AuthLocale, customizable via snippet overrides and slotClasses."
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
    <Playground />
    <div class="mt-6">
      <CodeExample title="Basic" code={basicCode} language="svelte" preview={false} />
    </div>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Errors announce without stealing focus">
        <p>
          The shared error region below the heading is always in the DOM as
          <code class="text-text-primary">&lt;div aria-live="polite"&gt;</code>, empty until
          something fails — a screen reader only announces changes inside a live region that already
          exists, so a region created together with its first error stays silent. A failed sign-in
          therefore reaches the reader while the caret stays in the password field.
        </p>
      </Note>
      <Note title="Autofill hints on every field">
        <p>
          Email carries <code class="text-text-primary">type="email"</code> with
          <code class="text-text-primary">autoComplete="email"</code>, password
          <code class="text-text-primary">autoComplete="current-password"</code>, and the two-factor
          step
          <code class="text-text-primary">inputmode="numeric"</code> with
          <code class="text-text-primary">autoComplete="one-time-code"</code>. That is what lets a
          password manager fill the form and iOS/Android offer the code from the SMS or
          authenticator — for users who cannot type a 30-character password by hand this is the
          difference between usable and not.
        </p>
      </Note>
      <Note title="Keyboard">
        <p>
          Everything is native: <Kbd keys="Tab" /> through the fields,
          <Kbd keys="Enter" /> submits the form. The passkey button is a real
          <code class="text-text-primary">&lt;button&gt;</code> and is
          <code class="text-text-primary">disabled</code>
          while either request is in flight, so a double <Kbd keys="Enter" /> cannot fire two logins.
          Labels,
          <code class="text-text-primary">aria-invalid</code> and
          <code class="text-text-primary">aria-describedby</code>
          come from the
          <code class="text-text-primary">Input</code> primitive rather than being wired here.
        </p>
      </Note>
      <Note title="Focus is not moved between the two steps">
        <p>
          When the password succeeds but the account has 2FA, the form is replaced by the code field
          and the heading changes — but nothing moves focus there. A keyboard or screen-reader user
          hears the new heading only if they navigate back to it. Pair the component with your own
          focus call if the two-step path is your primary flow.
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
      code={`import { LoginPage } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/login-page/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
