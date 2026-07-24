<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { PromptInput, type FileIntakeEntry } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  let draft = $state('');
  let attachments = $state<FileIntakeEntry[]>([]);
  let log = $state<{ id: string; text: string }[]>([]);

  function record(payload: { text: string; attachments: FileIntakeEntry[] }) {
    const files = payload.attachments.map((a) => a.file.name);
    const suffix = files.length ? ` + [${files.join(', ')}]` : '';
    log = [
      { id: crypto.randomUUID(), text: `${payload.text || '(no text)'}${suffix}` },
      ...log
    ].slice(0, 5);
  }

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 4 },
    { id: 'installation', title: 'Installation', order: 5 }
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
    <PlaygroundConfigurator
      componentName="PromptInput"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'submitOn',
          label: 'Submit on',
          items: [
            { label: 'enter', value: 'enter' },
            { label: 'mod-enter', value: 'mod-enter' }
          ],
          defaultValue: 'enter'
        },
        { type: 'checkbox', key: 'busy', label: 'Busy', defaultValue: false },
        {
          type: 'checkbox',
          key: 'allowAttachments',
          label: 'Allow attachments',
          defaultValue: false
        },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false },
        {
          type: 'text',
          key: 'placeholder',
          label: 'Placeholder',
          defaultValue: 'Type a message…'
        }
      ]}
      values={{
        submitOn: 'enter',
        busy: false,
        allowAttachments: false,
        disabled: false,
        placeholder: 'Type a message…'
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="mx-auto w-full max-w-xl space-y-4">
          <PromptInput
            bind:value={draft}
            bind:attachments
            submitOn={values.submitOn as 'enter' | 'mod-enter'}
            busy={values.busy as boolean}
            allowAttachments={values.allowAttachments as boolean}
            disabled={values.disabled as boolean}
            accept="image/*"
            placeholder={(values.placeholder as string) || undefined}
            onSubmit={record}
          />
          {#if log.length > 0}
            <div class="border-border-subtle rounded-xl border p-3">
              <p class="text-text-tertiary mb-2 text-xs font-semibold tracking-wide uppercase">
                onSubmit payloads
              </p>
              <ul class="space-y-1">
                {#each log as entry (entry.id)}
                  <li class="text-text-secondary font-mono text-xs">{entry.text}</li>
                {/each}
              </ul>
            </div>
          {:else}
            <p class="text-text-tertiary text-center text-xs">
              Submitted messages appear here. With <em>Busy</em> on, the send button becomes a stop button
              and Enter no longer submits.
            </p>
          {/if}
        </div>
      {/snippet}
    </PlaygroundConfigurator>
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
