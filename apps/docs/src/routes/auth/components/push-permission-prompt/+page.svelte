<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section
  } from '@urbicon-ui/docs';
  import { asset, resolve } from '$app/paths';
  import { buildRelatedLinks } from '$lib/component-links';
  import { componentData } from './api';
  import BasicExample from './examples/Basic.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'usage', title: 'Usage' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="PushPermissionPrompt - Auth"
  description="Dismissible prompt asking the user to enable push notifications."
/>

<DocsPageLayout
  title="PushPermissionPrompt"
  description="Dismissible prompt asking the user to enable push notifications. Handles VAPID subscription and server-side registration."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Auth', href: resolve('/auth') },
    { label: 'Components', href: resolve('/auth') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section marker="01" id="usage" title="Usage" intent="primary">
    <CodeExample title="Basic" code={basicCode} language="svelte">
      <BasicExample />
    </CodeExample>
  </Section>

  <Section marker="02" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="It never interrupts">
        <p>
          The prompt is an ordinary card in the flow, not a modal. It does not trap focus, does not
          steal it on mount, and both actions are real buttons — so it can be read, acted on, or
          ignored entirely at the point the user reaches it, rather than seizing the page the moment
          it appears.
        </p>
      </Note>
      <Note title="Failures are announced, dismissals are not">
        <p>
          The <code class="text-text-primary">aria-live="polite"</code> region inside the card is always
          mounted while the prompt is visible, so a rejected VAPID key, a conflicting endpoint or a rate
          limit is announced in place and the prompt stays open to retry. A denied browser permission
          is not an error and closes the prompt instead.
        </p>
      </Note>
      <Note title="Focus is dropped when the card closes">
        <p>
          Enabling or dismissing unmounts the whole card. If focus was on either button it falls
          back to <code class="text-text-primary">&lt;body&gt;</code> — the component does not
          restore it to a sensible neighbour. Where the prompt sits mid-page, move focus yourself in
          <code class="text-text-primary">onDismissed</code> /
          <code class="text-text-primary">onSubscribed</code>.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section marker="03" id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="04" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { PushPermissionPrompt } from '@urbicon-ui/auth';`}
      language="typescript"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/auth/components/push-permission-prompt/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
