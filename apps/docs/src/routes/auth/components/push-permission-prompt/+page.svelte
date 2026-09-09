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
  import { Kbd } from '@urbicon-ui/blocks';
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
          The <code class="text-text-primary">role="alert"</code> region inside the card is always mounted
          while the prompt is visible, so a rejected VAPID key, a conflicting endpoint or a rate limit
          is announced in place and the prompt stays open to retry. A denied browser permission is not
          an error and closes the prompt instead.
        </p>
      </Note>
      <Note title="Focus is handed on when the card closes">
        <p>
          Enabling or dismissing unmounts the whole card, so the button that was pressed goes with
          it and the next <Kbd keys="Tab" /> would otherwise start over at the top of the page. The prompt
          moves focus to the element that held it when the prompt appeared; if that element is gone, to
          the next tab stop after the card; failing that, to the one before it. Controls that are disabled
          or not rendered are skipped, and nothing outside the card is modified on the way — no page heading
          is made focusable to catch the ring. A page whose only controls were inside the card keeps none,
          so focus lands where the browser puts it.
        </p>
        <p>
          Your callback runs first. <code class="text-text-primary">onDismissed</code>,
          <code class="text-text-primary">onSubscribed</code> and
          <code class="text-text-primary">onUnavailable</code> are called before the prompt looks for
          a landing spot, and it only moves focus that is still on its own two buttons — so a callback
          that places focus itself wins, and so does a user who clicked elsewhere while the request ran.
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
