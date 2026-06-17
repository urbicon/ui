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
  import { FileUpload, type FileUploadFile } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  let playgroundFiles = $state<FileUploadFile[]>([]);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      size: 'md',
      intent: 'neutral',
      multiple: false,
      maxFiles: undefined,
      allowDrop: true,
      allowPaste: false,
      disabled: false
    };

    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false) return false;
        if (key === 'maxFiles' && (value === '' || value === 0)) return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'boolean') return value ? key : '';
        if (typeof value === 'string') return `${key}="${value}"`;
        return `${key}={${JSON.stringify(value)}}`;
      })
      .filter(Boolean);

    const propsStr = props.length > 0 ? `\n  ${props.join('\n  ')}\n` : '\n';

    return `<FileUpload${propsStr}  bind:files
  title="Dateien hier ablegen"
  description="Beliebiger Dateityp"
/>`;
  }
</script>

<SeoMeta
  title="FileUpload Component"
  description="Drag-and-drop file upload with validation, image previews, progress tracking, and animated file list. Supports multiple files, paste from clipboard, and custom dropzone designs."
/>

<DocsPageLayout
  title="FileUpload"
  description="Drag-and-drop file upload with validation, image previews, progress tracking, and animated file list. Supports multiple files, paste from clipboard, and custom dropzone designs."
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
      componentName="FileUpload"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'primary', value: 'primary' },
            { label: 'neutral', value: 'neutral' }
          ],
          defaultValue: 'primary'
        },
        { type: 'checkbox', key: 'multiple', label: 'Multiple', defaultValue: false },
        {
          type: 'number',
          key: 'maxFiles',
          label: 'Max Files',
          min: 0,
          max: 20,
          step: 1,
          defaultValue: undefined,
          placeholder: 'Unlimited'
        },
        { type: 'checkbox', key: 'allowDrop', label: 'Allow Drop', defaultValue: true },
        { type: 'checkbox', key: 'allowPaste', label: 'Allow Paste', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        size: 'md',
        intent: 'neutral',
        multiple: false,
        maxFiles: undefined,
        allowDrop: true,
        allowPaste: false,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="mx-auto max-w-md">
          <FileUpload
            bind:files={playgroundFiles}
            size={values.size}
            intent={values.intent}
            multiple={values.multiple}
            maxFiles={values.maxFiles || undefined}
            allowDrop={values.allowDrop}
            allowPaste={values.allowPaste}
            disabled={values.disabled}
            title="Dateien hier ablegen oder klicken"
            description="Beliebiger Dateityp, max. 10 MB"
            maxFileSize={10 * 1024 * 1024}
          />
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { FileUpload, IMAGE_MIME_TYPES, PDF_MIME_TYPE } from '@urbicon-ui/blocks';
import type {
  FileUploadProps,
  FileUploadFile,
  FileRejection,
  FileUploadError,
  FileItemContext
} from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/file-upload/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
