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
  import { Slider } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  // Live demo state — two separate slots so `bind:value` keeps a stable
  // shape (number vs tuple) when the range toggle flips. Svelte's
  // `bind:value` does not accept ternary expressions, so we render two
  // sibling sliders in the snippet and pick one based on `range`.
  let singleValue = $state(65);
  let rangeValue = $state<[number, number]>([20, 80]);

  const demoMarks = [
    { value: 0, label: '0' },
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 75, label: '75' },
    { value: 100, label: '100' }
  ];

  // The playground exposes `showMarks` as a boolean knob for ergonomics,
  // but the real prop is `marks={[…]}`. Rewrite the generated snippet so
  // copy-paste yields actual API calls, not playground state names.
  // We filter against the Slider component defaults (NOT the playground
  // defaults — `showValue=true` is a playground convenience, the
  // component itself defaults to `false`).
  const componentDefaults: Record<string, unknown> = {
    variant: 'default',
    intent: 'primary',
    size: 'md',
    step: 1,
    range: false,
    showValue: false,
    disabled: false
  };

  function formatProp(key: string, value: unknown): string {
    if (typeof value === 'boolean') return value ? key : `${key}={false}`;
    if (typeof value === 'string') return `${key}="${value}"`;
    return `${key}={${JSON.stringify(value)}}`;
  }

  function generateSliderCode(values: Record<string, unknown>): string {
    const props: string[] = [];

    for (const [key, value] of Object.entries(values)) {
      if (key === 'showMarks') continue; // handled separately
      if (key in componentDefaults && componentDefaults[key] === value) continue;
      if (value === null || value === undefined) continue;
      props.push(formatProp(key, value));
    }

    if (values.showMarks === true) {
      const inline = demoMarks.map((m) => `{ value: ${m.value}, label: '${m.label}' }`).join(', ');
      props.push(`marks={[${inline}]}`);
    }

    props.sort();

    if (!props.length) return `<Slider label="Volume" />`;
    const indent = props.map((p) => `  ${p}`).join('\n');
    return `<Slider\n  label="Volume"\n${indent}\n/>`;
  }

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];
</script>

<SeoMeta
  title="Slider Component"
  description="Numeric slider with single and range modes, step snapping, tick marks, and touch support."
/>

<DocsPageLayout
  title="Slider"
  description="Numeric slider with single and range modes, step snapping, tick marks, and touch support."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Slider"
      codeGenerator={generateSliderCode}
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'default', value: 'default' },
            { label: 'rail', value: 'rail' }
          ],
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'primary', value: 'primary' },
            { label: 'secondary', value: 'secondary' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' },
            { label: 'neutral', value: 'neutral' }
          ],
          defaultValue: 'primary'
        },
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
          key: 'step',
          label: 'Step',
          items: [
            { label: '1', value: 1 },
            { label: '5', value: 5 },
            { label: '10', value: 10 },
            { label: '25', value: 25 }
          ],
          defaultValue: 1
        },
        { type: 'checkbox', key: 'range', label: 'Range mode', defaultValue: false },
        { type: 'checkbox', key: 'showValue', label: 'Show value', defaultValue: true },
        { type: 'checkbox', key: 'showMarks', label: 'Show marks', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        variant: 'default',
        intent: 'primary',
        size: 'md',
        step: 1,
        range: false,
        showValue: true,
        showMarks: false,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="w-full max-w-md">
          {#if values.range}
            <Slider
              label="Volume"
              bind:value={rangeValue}
              variant={values.variant}
              intent={values.intent}
              size={values.size}
              step={values.step}
              showValue={values.showValue}
              marks={values.showMarks ? demoMarks : undefined}
              disabled={values.disabled}
              range
            />
          {:else}
            <Slider
              label="Volume"
              bind:value={singleValue}
              variant={values.variant}
              intent={values.intent}
              size={values.size}
              step={values.step}
              showValue={values.showValue}
              marks={values.showMarks ? demoMarks : undefined}
              disabled={values.disabled}
            />
          {/if}
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
      code={`import { Slider } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/slider/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
