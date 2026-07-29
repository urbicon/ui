<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { Stepper, StepperStep } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'vertical', title: 'Vertical Stepper', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      orientation: 'horizontal',
      variant: 'default',
      size: 'md',
      clickable: false,
      linear: false,
      disabled: false
    };

    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false) return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'boolean') return value ? key : '';
        if (typeof value === 'string') return `${key}="${value}"`;
        return `${key}={${JSON.stringify(value)}}`;
      })
      .filter(Boolean);

    const propsStr = props.length > 0 ? ` ${props.join(' ')}` : '';

    return `<Stepper activeStep={1}${propsStr}>
  <StepperStep label="Account" description="Create your account" />
  <StepperStep label="Profile" description="Set up your profile" />
  <StepperStep label="Review" description="Review and submit" />
</Stepper>`;
  }
</script>

<SeoMeta
  title="Stepper Component"
  description="Multi-step progress indicator with horizontal/vertical layout, clickable navigation, and per-step state overrides."
/>

<DocsPageLayout
  title="Stepper"
  description="Multi-step progress indicator with horizontal/vertical layout, clickable navigation, and per-step state overrides."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
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
      code={`import { Stepper, StepperStep } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/stepper/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
