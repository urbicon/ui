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
  import { Dialog, Button } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  let playgroundOpen = $state(false);

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
  title="Dialog Component"
  description="Overlay dialog with optional structured layout (title/footer/intent), focus trapping, and keyboard management. Built on native <dialog>."
/>

<DocsPageLayout
  title="Dialog"
  description="Overlay dialog with optional structured layout (title/footer/intent), focus trapping, and keyboard management. Built on native <dialog
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  {navigation}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Dialog"
      {propDocs}
      {variantKeys}
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: '' },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' },
            { label: 'full', value: 'full' }
          ],
          defaultValue: 'sm'
        },
        {
          type: 'dropdown',
          key: 'placement',
          label: 'Placement',
          items: [
            { label: 'center', value: 'center' },
            { label: 'top', value: 'top' }
          ],
          defaultValue: 'center'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'neutral', value: 'neutral' },
            { label: 'primary', value: 'primary' },
            { label: 'secondary', value: 'secondary' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' }
          ],
          defaultValue: 'neutral'
        },
        {
          type: 'checkbox',
          key: 'hideCloseButton',
          label: 'Hide Close Button',
          defaultValue: false
        },
        {
          type: 'checkbox',
          key: 'closeOnBackdropClick',
          label: 'Close on Backdrop',
          defaultValue: true
        },
        {
          type: 'checkbox',
          key: 'closeOnEscape',
          label: 'Close on Escape',
          defaultValue: true
        }
      ]}
      values={{
        title: '',
        size: 'sm',
        placement: 'center',
        intent: 'neutral',
        hideCloseButton: false,
        closeOnBackdropClick: true,
        closeOnEscape: true
      }}
      codeGenerator={(values) => {
        const props = ['bind:open'];
        if (values.title) props.push(`title="${values.title}"`);
        if (values.size !== 'sm') props.push(`size="${values.size}"`);
        if (values.placement !== 'center') props.push(`placement="${values.placement}"`);
        if (values.intent !== 'neutral') props.push(`intent="${values.intent}"`);
        if (values.hideCloseButton) props.push('hideCloseButton');
        if (values.closeOnBackdropClick === false) props.push('closeOnBackdropClick={false}');
        if (values.closeOnEscape === false) props.push('closeOnEscape={false}');
        const hasTitle = !!values.title;
        if (hasTitle) {
          return `<Dialog\n  ${props.join('\n  ')}\n>\n  <p>Your content here.</p>\n  {#snippet footer()}\n    <Button variant="ghost" onclick={() => open = false}>Cancel</Button>\n    <Button onclick={() => open = false}>Confirm</Button>\n  {/snippet}\n</Dialog>`;
        }
        return `<Dialog\n  ${props.join('\n  ')}\n>\n  <p>Your content here — any layout you want.</p>\n  <div class="flex justify-end gap-2 mt-4">\n    <Button variant="ghost" onclick={() => open = false}>Cancel</Button>\n    <Button onclick={() => open = false}>Confirm</Button>\n  </div>\n</Dialog>`;
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Button onclick={() => (playgroundOpen = true)} intent="primary">Open Dialog</Button>
        <Dialog
          bind:open={playgroundOpen}
          title={values.title || undefined}
          size={values.size}
          placement={values.placement}
          intent={values.intent}
          hideCloseButton={values.hideCloseButton}
          closeOnBackdropClick={values.closeOnBackdropClick}
          closeOnEscape={values.closeOnEscape}
        >
          <p class="text-text-secondary text-sm">
            {#if values.title}
              This is the dialog body. Structured layout with header, body, and footer.
            {:else}
              This is a content-agnostic overlay. Adjust the controls to see how size, placement,
              and dismissal behavior change.
            {/if}
          </p>
          {#if values.title}
            {#snippet footer()}
              <div class="flex justify-end gap-2">
                <Button variant="ghost" onclick={() => (playgroundOpen = false)}>Cancel</Button>
                <Button onclick={() => (playgroundOpen = false)}>Confirm</Button>
              </div>
            {/snippet}
          {:else}
            <div class="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onclick={() => (playgroundOpen = false)}>Cancel</Button>
              <Button onclick={() => (playgroundOpen = false)}>Confirm</Button>
            </div>
          {/if}
        </Dialog>
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
      code={`import { Dialog } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/dialog/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
