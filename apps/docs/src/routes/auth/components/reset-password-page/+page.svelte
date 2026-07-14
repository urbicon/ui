<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import { componentData } from './api';
  import BasicDemo from './examples/BasicDemo.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  const navigation = [
    { id: 'usage', title: 'Usage', order: 1 },
    { id: 'api', title: 'API Reference', order: 2 },
    { id: 'installation', title: 'Installation', order: 3 }
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
>
  <Section id="usage" intent="primary">
    <CodeExample title="Basic" code={basicCode} language="svelte">
      <BasicDemo />
    </CodeExample>
  </Section>

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section id="installation" title="Installation">
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

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
