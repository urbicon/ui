<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { PromptInput, type FileIntakeEntry } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      busy: false,
      allowAttachments: false,
      disabled: false,
      submitOn: 'enter',
      placeholder: ''
    };

    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (value === null || value === undefined || value === '') return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false) return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'boolean') return value ? key : '';
        return `${key}="${value}"`;
      })
      .filter(Boolean);

    const propsStr = props.length > 0 ? `\n  ${props.join('\n  ')}` : '';

    return `<PromptInput
  bind:value={draft}${propsStr}
  onSubmit={({ text, attachments }) => send(text, attachments)}
/>`;
  }
</script>

<SeoMeta
  title="PromptInput Component"
  description="The chat composer — an auto-growing textarea with a send button that flips to stop while streaming, opt-in attachments, and IME-safe Enter-to-send."
/>

<DocsPageLayout
  title="PromptInput"
  description="The chat composer: an auto-growing textarea with a send button that flips to a stop button while a response streams. Enter sends (Shift+Enter for a newline, IME-safe), and opt-in attachments support the paperclip picker, clipboard paste, and drag-and-drop over the shared file-intake core."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <Section
    marker="03"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="04" id="installation" title="Installation">
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
      href={asset('/blocks/components/prompt-input/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
