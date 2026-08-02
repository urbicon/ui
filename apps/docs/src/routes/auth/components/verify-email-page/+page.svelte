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
  title="VerifyEmailPage - Auth"
  description="Auto-verifying email confirmation page. Sends token on mount, shows result."
/>

<DocsPageLayout
  title="VerifyEmailPage"
  description="Auto-verifying email confirmation page. Sends token on mount, shows result."
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
      description="The live preview mocks a successful verification via the fetcher prop (the static docs site has no auth backend). The snippet shows the production setup."
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
