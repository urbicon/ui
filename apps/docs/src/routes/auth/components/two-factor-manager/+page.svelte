<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section
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
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="TwoFactorManager - Auth"
  description="Self-service TOTP two-factor setup, backup codes, and disable with password re-auth."
/>

<DocsPageLayout
  title="TwoFactorManager"
  description="Self-service two-factor (TOTP) management: enrol with an authenticator app, show one-time backup codes, and disable with a password re-auth. The core stays zero-dependency, so QR rendering is delegated to the `qr` snippet — without it the otpauth URI + Base32 secret are shown for manual entry."
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
      description="The live preview runs against a mocked demo API (injected via the fetcher prop) — setup returns a demo secret + URI and any 6-digit code reveals demo backup codes (no real verification). The `qr` snippet is omitted here, so the zero-dep manual-entry fallback is shown. The snippet shows the production setup."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker="02" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="The error region outlives the step it came from">
        <p>
          The <code class="text-text-primary">aria-live="polite"</code> region sits directly under the
          heading, above the idle/setup/backup branch — not inside it. An error raised while confirming
          a code is therefore still announced after the view changes, which a region nested in the branch
          would have destroyed before the reader got to it.
        </p>
      </Note>
      <Note title="The secret and the backup codes are real elements">
        <p>
          The TOTP secret renders in a <code class="text-text-primary">&lt;code&gt;</code> element
          and the backup codes in a <code class="text-text-primary">&lt;ul&gt;</code> of
          <code class="text-text-primary">&lt;li&gt;</code>. A reader announces the list with its
          item count and can step through the codes one at a time — the same content as a styled
          grid of divs would be an unnavigable run of characters.
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
      <Note title="Step changes are neither focused nor announced">
        <p>
          Moving from idle to setup to backup codes replaces the content in place, and nothing marks
          it: focus is not moved, and the live region above carries only errors — a successful step
          change clears the error first, so the region is empty exactly when the view swaps. A
          screen-reader user is left on a page whose content silently became something else. Move
          focus to the new step yourself if this flow matters to you. The QR code is a
          consumer-supplied snippet, so its alternative text is yours to provide; the secret is
          always available as text next to it for anyone who cannot scan.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section marker="03" id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="04" id="installation" title="Installation">
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
