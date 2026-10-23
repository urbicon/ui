<script lang="ts">
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { asset, resolve } from '$app/paths';
  import { componentData } from './api';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';

  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta
  title="PromptInput Component"
  description="An auto-growing textarea for chat input: a send button that becomes a stop button while streaming, Enter-to-send, and opt-in attachments."
/>

<DocsPageLayout
  title="PromptInput"
  description="An auto-growing textarea for chat input, with a send button that becomes a stop button while a response streams. Enter sends, Shift+Enter inserts a newline, and opt-in attachments accept the paperclip picker, paste, and drag-and-drop."
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
      code={`import { PromptInput } from '@urbicon-ui/blocks';
import type { PromptInputProps, FileIntakeEntry, FileIntakeRejection } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('blocks/components/prompt-input/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
