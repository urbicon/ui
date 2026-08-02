<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { FileUpload, type FileUploadFile } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'customization', title: 'Customization' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
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
    <Playground />
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
</DocsPageLayout>
