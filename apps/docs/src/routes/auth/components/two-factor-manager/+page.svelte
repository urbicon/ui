<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { asset, resolve } from '$app/paths';
  import { componentData } from './api';
  import BasicDemo from './examples/BasicDemo.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  const navigation = [
    { id: 'usage', title: 'Usage' },
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
>
  <Section id="usage" intent="primary">
    <CodeExample
      title="Basic"
      description="The live preview runs against a mocked demo API (injected via the fetcher prop) — setup returns a demo secret + URI and any 6-digit code reveals demo backup codes (no real verification). The `qr` snippet is omitted here, so the zero-dep manual-entry fallback is shown. The snippet shows the production setup."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section id="installation" title="Installation">
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
