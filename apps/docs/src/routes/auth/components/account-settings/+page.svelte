<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
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
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="AccountSettings - Auth"
  description="Self-service panel to change name, email and password, and delete the account."
/>

<DocsPageLayout
  title="AccountSettings"
  description="Self-service account panel: change name, email and password, and delete the account. Each section talks to the account handlers; mutations except the profile rename are password re-auth gated."
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
      description="The live preview runs against a mocked demo API (injected via the fetcher prop) — the profile rename succeeds, deleting explains that it needs a real backend. The snippet shows the production setup, where `user` comes from your auth store or `locals.user`."
      code={basicCode}
      language="svelte"
    >
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section marker="02" id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="03" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { AccountSettings } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/account-settings/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
