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
  import { A2UIView, A2UI_CATALOG_ID } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'concept', title: 'How it works', order: 2 },
    { id: 'examples', title: 'Examples', order: 3 },
    { id: 'integration', title: 'Integration', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];

  // Two clean catalog-conformant payloads for the playground. Both are what an
  // agent would emit as JSONL — a `createSurface` header, one `updateComponents`
  // tree of catalog components, and an `updateDataModel` seed. The consumer just
  // hands the accumulated array to A2UIView.
  const SCENARIOS: Record<string, unknown[]> = {
    signin: [
      { version: 'v0.9.1', createSurface: { surfaceId: 'pg', catalogId: A2UI_CATALOG_ID } },
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId: 'pg',
          components: [
            { id: 'root', component: 'Card', child: 'col' },
            { id: 'col', component: 'Column', children: ['title', 'email', 'password', 'submit'] },
            { id: 'title', component: 'Text', text: 'Welcome back', variant: 'h4' },
            { id: 'email', component: 'TextField', label: 'Email', value: { path: '/email' } },
            {
              id: 'password',
              component: 'TextField',
              label: 'Password',
              variant: 'obscured',
              value: { path: '/password' }
            },
            { id: 'submit-label', component: 'Text', text: 'Sign in' },
            {
              id: 'submit',
              component: 'Button',
              child: 'submit-label',
              action: { event: { name: 'signin', context: { email: { path: '/email' } } } }
            }
          ]
        }
      },
      {
        version: 'v0.9.1',
        updateDataModel: { surfaceId: 'pg', value: { email: '', password: '' } }
      }
    ],
    survey: [
      { version: 'v0.9.1', createSurface: { surfaceId: 'pg', catalogId: A2UI_CATALOG_ID } },
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId: 'pg',
          components: [
            { id: 'root', component: 'Card', child: 'col' },
            { id: 'col', component: 'Column', children: ['q', 'rating', 'contact', 'submit'] },
            { id: 'q', component: 'Text', text: 'How was your experience?', variant: 'h4' },
            {
              id: 'rating',
              component: 'Slider',
              label: 'Rating',
              value: { path: '/rating' },
              max: 10
            },
            {
              id: 'contact',
              component: 'CheckBox',
              label: 'You may contact me',
              value: { path: '/contact' }
            },
            { id: 'submit-label', component: 'Text', text: 'Submit' },
            {
              id: 'submit',
              component: 'Button',
              child: 'submit-label',
              action: { event: { name: 'submit_survey', context: { rating: { path: '/rating' } } } }
            }
          ]
        }
      },
      {
        version: 'v0.9.1',
        updateDataModel: { surfaceId: 'pg', value: { rating: 5, contact: false } }
      }
    ]
  };

  function codeGenerator(vals: Record<string, unknown>): string {
    const streaming = vals.streaming === true;
    return `<!-- Wire A2UIView in as the 'a2ui' part renderer of a ChatMessage. -->
<ChatMessageList {messages} partRenderers={{ a2ui: a2uiPart }} />

{#snippet a2uiPart(part)}
  <A2UIView
    payload={part.payload}
    streaming={${streaming}}
    {urlPolicy}
    onAction={(event) => sendUserTurn(\`[ui-action] \${JSON.stringify(event)}\`)}
    onValidationError={(issues) => reportToAgent(issues)}
  />
{/snippet}`;
  }
</script>

<SeoMeta
  title="A2UIView Component"
  description="Renders a trusted-catalog A2UI (Agent-to-UI, v0.9.1 basic subset) payload into live, interactive Urbicon components — whitelist-only and fail-loud."
/>

<DocsPageLayout
  title="A2UIView"
  description="Renders a trusted-catalog A2UI (Agent-to-UI, v0.9.1 basic subset) payload into live, interactive Urbicon components — whitelist-only and fail-loud."
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
      componentName="A2UIView"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'scenario',
          label: 'Scenario',
          items: [
            { label: 'Sign-in form', value: 'signin' },
            { label: 'Feedback survey', value: 'survey' }
          ],
          defaultValue: 'signin'
        },
        { type: 'boolean', key: 'streaming', label: 'Streaming' }
      ]}
      values={{ scenario: 'signin', streaming: false }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="mx-auto max-w-sm">
          {#key values.scenario}
            <A2UIView
              payload={SCENARIOS[(values.scenario as string) ?? 'signin'] ?? SCENARIOS.signin}
              streaming={values.streaming === true}
            />
          {/key}
        </div>
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
      code={`import { A2UIView, a2uiSystemPrompt } from '@urbicon-ui/blocks';
import type { A2uiActionEvent, A2uiValidationIssue } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/a2-ui-view/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
