<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodePanel,
    DocsLayout as DocsPageLayout,
    InfoCard,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import CustomDocs from './DocsCustom.svelte';
  import { componentData } from './api';
  import { asset, resolve } from '$app/paths';

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'usage', title: 'Usage Notes' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' }
  ];

  const SAMPLE = `<script lang="ts">
  import { Button } from '@urbicon-ui/blocks';

  let count = $state(0);
<\/script>

<Button onclick={() => count++}>
  Clicked {count} times
</Button>`;

  const description =
    'Collapsible code block with syntax highlighting, line numbers and copy-to-clipboard. The shared primitive behind CodeExample and PlaygroundConfigurator.';
</script>

<SeoMeta title="CodePanel Component" {description} />

<DocsPageLayout
  title="CodePanel"
  {description}
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
>
  <Section id="playground" title="Playground">
    <PlaygroundConfigurator
      componentName="CodePanel"
      controls={[
        { type: 'text', key: 'label', label: 'Label', defaultValue: 'Counter button' },
        {
          type: 'dropdown',
          key: 'language',
          label: 'Language',
          items: ['svelte', 'typescript', 'css', 'bash'].map((v) => ({ label: v, value: v })),
          defaultValue: 'svelte'
        },
        {
          type: 'dropdown',
          key: 'lineNumbers',
          label: 'Line numbers',
          items: [
            { label: 'auto', value: 'auto' },
            { label: 'always', value: true },
            { label: 'never', value: false }
          ],
          defaultValue: 'auto'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: ['sm', 'md', 'lg'].map((v) => ({ label: v, value: v })),
          defaultValue: 'md'
        }
      ]}
      values={{ label: 'Counter button', language: 'svelte', lineNumbers: 'auto', size: 'md' }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="w-full">
          <CodePanel
            code={SAMPLE}
            label={values.label}
            language={values.language}
            lineNumbers={values.lineNumbers}
            size={values.size}
          />
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs {SAMPLE} />

  <Section marker="03" id="usage" title="Usage Notes">
    <div class="space-y-6">
      <InfoCard intent="info" title="Reach for CodeExample first">
        <p>
          On a documentation page you almost always want <code>CodeExample</code>, which wraps this
          panel with a title, a description and a live preview. Use <code>CodePanel</code> directly when
          you need a bare code block — inside a custom layout, or where the surrounding card would be
          noise.
        </p>
      </InfoCard>

      <InfoCard intent="neutral" title="Line numbers are generated content">
        <p>
          Numbers render through CSS <code>::before</code>, so they never end up in a selection or
          in the copied text. <code>auto</code> shows them from six lines up: a one-line import
          gains nothing from a <code>1</code> in front of it.
        </p>
      </InfoCard>

      <InfoCard intent="warning" title="Controlled expansion needs both props">
        <p>
          Passing <code>expanded</code> without <code>onToggle</code> freezes the panel — the button still
          renders but has nothing to call. Leave both off to let the panel manage itself.
        </p>
      </InfoCard>
    </div>
  </Section>

  <Section marker="04" id="accessibility" title="Accessibility">
    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <div class="divide-border-subtle divide-y">
        <div class="pb-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            The code region is a <code>role="textbox"</code> with <code>aria-readonly</code> and a
            name composed from <code>label</code>, so a screen reader announces which example it is
            reading. The toggle carries <code>aria-expanded</code>; the copy button announces its
            result through a polite status region rather than only changing its icon.
          </p>
        </div>
        <div class="py-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            The code region is focusable (<code>tabindex="0"</code>) so it can be scrolled without a
            pointer. Toggle and copy are ordinary buttons in the tab order, both with a visible
            focus ring.
          </p>
        </div>
        <div class="pt-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">While highlighting loads</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            Shiki is loaded lazily. The placeholder is an <code>aria-live="polite"</code> region, so the
            swap to highlighted code is announced instead of happening silently.
          </p>
        </div>
      </div>
    </div>
  </Section>

  <Section
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/code-panel/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
