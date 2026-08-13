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
  title="TwoFactorManager - Auth"
  description="Self-service TOTP two-factor setup, backup codes, and disable with password re-auth."
/>

<DocsPageLayout
  title="TwoFactorManager"
  description="Self-service two-factor (TOTP) management: enrol with an authenticator app, show one-time backup codes, and disable with a password re-auth. Pass a `qr` snippet to render the setup QR code; the package ships no QR encoder, so without one the otpauth URI and Base32 secret are shown as text to type in."
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
      description="The live preview runs against a mocked demo API (injected via the fetcher prop): setup returns a demo secret and URI, and any 6-digit code reveals demo backup codes (nothing is verified). No `qr` snippet is passed here, so the page falls back to manual entry. The code below shows the production setup."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="The error region outlives the step it came from">
        <p>
          The <code class="text-text-primary">aria-live="polite"</code> region sits directly under the
          heading, above the idle/setup/backup branch rather than inside it. An error raised while confirming
          a code is therefore still announced after the view changes; a region nested in the branch would
          unmount with the step before the reader heard it.
        </p>
      </Note>
      <Note title="The secret and the backup codes are text elements">
        <p>
          The TOTP secret renders in a <code class="text-text-primary">&lt;code&gt;</code> element
          and the backup codes in a <code class="text-text-primary">&lt;ul&gt;</code> of
          <code class="text-text-primary">&lt;li&gt;</code>. A screen reader announces the list with
          its item count and steps through the codes one at a time, where the same content in a grid
          of styled divs would be an unnavigable run of characters.
        </p>
      </Note>
      <Note title="Autofill hints on both entry paths">
        <p>
          Disabling 2FA re-authenticates with an
          <code class="text-text-primary">autoComplete="current-password"</code> field; the setup
          code uses
          <code class="text-text-primary">inputmode="numeric"</code> with
          <code class="text-text-primary">autoComplete="one-time-code"</code>, which brings up the
          numeric keypad and lets the OS offer the code directly.
        </p>
      </Note>
      <Note title="Advancing a step does not move focus">
        <p>
          Moving from idle to setup to backup codes swaps the content in place without moving focus,
          and the live region above carries only errors; on a successful step it is cleared first,
          so it is empty exactly when the view changes. A screen-reader user gets no cue that the
          step advanced, so move focus to the new step yourself if this flow matters to you. The QR
          code is your snippet, so its alternative text is yours to provide; the secret sits next to
          it as text for anyone who cannot scan.
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
      code={`import { TwoFactorManager } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/two-factor-manager/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
