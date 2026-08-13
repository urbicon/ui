<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section,
    TypesReference
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
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="PushPermissionPrompt - Auth"
  description="Dismissible prompt asking the user to enable push notifications."
/>

<DocsPageLayout
  title="PushPermissionPrompt"
  description="A dismissible prompt that asks the user to enable push notifications, then registers the VAPID subscription with your server."
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
  <Section marker id="usage" title="Usage" intent="primary">
    <CodeExample title="Basic" code={basicCode} language="svelte">
      <BasicExample />
    </CodeExample>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="It never interrupts">
        <p>
          The prompt is an ordinary card in the flow, not a modal: it keeps focus where it was on
          mount, and both actions are buttons, so a user can read it, act on it, or ignore it when
          they reach it.
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
          back to <code class="text-text-primary">&lt;body&gt;</code>; the component does not move
          it to a sensible neighbour. Where the prompt sits mid-page, move focus yourself in
          <code class="text-text-primary">onDismissed</code> /
          <code class="text-text-primary">onSubscribed</code>.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section marker id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker id="installation" title="Installation">
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
