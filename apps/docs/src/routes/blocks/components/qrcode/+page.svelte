<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { QRCode } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'auth-2fa', title: '2FA & auth', order: 3 },
    { id: 'encoding', title: 'Encoding & errors', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];
</script>

<SeoMeta
  title="QRCode Component"
  description="Render any text or URL as a scannable QR code — SVG output, zero runtime dependency."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="QRCode"
  description="Renders any text or URL as a scannable QR code. SVG output from a from-scratch ISO/IEC 18004 encoder — no runtime dependency. Completes the auth package's zero-dependency 2FA story."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      showHeader={false}
      {propDocs}
      {variantKeys}
      componentName="QRCode"
      controls={[
        { type: 'text', key: 'value', label: 'Value', defaultValue: 'https://ui.urbicon.de' },
        {
          type: 'dropdown',
          key: 'errorCorrection',
          label: 'Error correction',
          items: [
            { label: 'L', value: 'L' },
            { label: 'M', value: 'M' },
            { label: 'Q', value: 'Q' },
            { label: 'H', value: 'H' }
          ],
          defaultValue: 'M'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: '120', value: 120 },
            { label: '160', value: 160 },
            { label: '200', value: 200 },
            { label: '240', value: 240 }
          ],
          defaultValue: 160
        },
        {
          type: 'dropdown',
          key: 'frame',
          label: 'Frame',
          items: [
            { label: 'none', value: 'none' },
            { label: 'card', value: 'card' }
          ],
          defaultValue: 'card'
        }
      ]}
      values={{
        value: 'https://ui.urbicon.de',
        errorCorrection: 'M',
        size: 160,
        frame: 'card'
      }}
    >
      {#snippet children(values)}
        <!-- `value` is spread from the playground state, but restated explicitly so
             its required-prop type is satisfied (the spread is an index signature). -->
        <QRCode {...values} value={typeof values.value === 'string' ? values.value : ''} />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="05"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="06" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { QRCode } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/qrcode/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
