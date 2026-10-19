<script lang="ts">
  import SeoMeta from '#lib/SeoMeta.svelte';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { A2UIView } from '@urbicon-ui/blocks';
  import PrevNextNav from '#lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';
  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta
  title="A2UIView Component"
  description="Renders an A2UI payload (a UI an agent describes as JSON) into live, interactive Urbicon components. Only components from a catalog you allow are rendered; anything outside it is reported, not shown."
/>

<DocsPageLayout
  title="A2UIView"
  description="Renders an A2UI payload (a UI an agent describes as JSON) into live, interactive Urbicon components. Only components from a catalog you allow are rendered; anything outside it is reported, not shown."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { A2UIView, a2uiSystemPrompt } from '@urbicon-ui/blocks';
import type { A2uiActionEvent, A2uiValidationIssue } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('blocks/components/a2-ui-view/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
