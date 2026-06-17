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
  import { Tab, TabItem, TabPanel } from '@urbicon-ui/blocks';
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
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'mint', title: 'Micro-Interactions', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];

  function tabCodeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      variant: 'line',
      size: 'md',
      orientation: 'horizontal',
      fullWidth: false,
      disabled: false,
      defaultValue: 'account'
    };

    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (key === 'defaultValue') return false;
        if (value === null || value === undefined) return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false || value === 'none') return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'boolean') return value ? key : '';
        if (typeof value === 'string') return `${key}="${value}"`;
        return `${key}={${JSON.stringify(value)}}`;
      })
      .filter(Boolean);

    const propsStr = props.length > 0 ? `\n  ${props.join('\n  ')}\n  ` : ' ';

    return `<Tab${propsStr}defaultValue="${vals.defaultValue || 'account'}">
  {#snippet tabs()}
    <TabItem value="account">Account</TabItem>
    <TabItem value="billing">Billing</TabItem>
    <TabItem value="team">Team</TabItem>
  {/snippet}
  {#snippet panels()}
    <TabPanel value="account">Manage your account settings</TabPanel>
    <TabPanel value="billing">Update billing information</TabPanel>
    <TabPanel value="team">Collaborate with your team</TabPanel>
  {/snippet}
</Tab>`;
  }
</script>

<SeoMeta
  title="Tab Component"
  description="Tabbed navigation for organizing content into switchable panels."
/>

<DocsPageLayout
  title="Tab"
  description="Tabbed navigation for organizing content into switchable panels. Supports four visual variants, vertical orientation, icons, badges, and full keyboard navigation."
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
      componentName="Tab"
      {propDocs}
      {variantKeys}
      codeGenerator={tabCodeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'line', value: 'line' },
            { label: 'pills', value: 'pills' },
            { label: 'enclosed', value: 'enclosed' },
            { label: 'solid', value: 'solid' }
          ],
          defaultValue: 'line'
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
          key: 'orientation',
          label: 'Orientation',
          items: [
            { label: 'horizontal', value: 'horizontal' },
            { label: 'vertical', value: 'vertical' }
          ],
          defaultValue: 'horizontal'
        },
        { type: 'checkbox', key: 'fullWidth', label: 'Full Width', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false },
        {
          type: 'dropdown',
          key: 'mint',
          label: 'Mint',
          items: [
            { label: 'none', value: 'none' },
            { label: 'scale', value: 'scale' },
            { label: 'ripple', value: 'ripple' },
            { label: 'glow', value: 'glow' }
          ],
          defaultValue: 'none'
        }
      ]}
      values={{
        variant: 'line',
        size: 'md',
        orientation: 'horizontal',
        fullWidth: false,
        disabled: false,
        mint: 'none',
        defaultValue: 'account'
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="w-full max-w-lg">
          <Tab
            variant={values.variant}
            size={values.size}
            orientation={values.orientation}
            fullWidth={values.fullWidth}
            disabled={values.disabled}
            mint={values.mint}
            defaultValue="account"
          >
            {#snippet tabs()}
              <TabItem value="account">Account</TabItem>
              <TabItem value="billing">Billing</TabItem>
              <TabItem value="team">Team</TabItem>
            {/snippet}
            {#snippet panels()}
              <TabPanel value="account">
                <div class="py-2">
                  <p class="text-text-primary font-medium">Account Settings</p>
                  <p class="text-text-secondary mt-1 text-sm">
                    Manage your profile, email preferences, and security options.
                  </p>
                </div>
              </TabPanel>
              <TabPanel value="billing">
                <div class="py-2">
                  <p class="text-text-primary font-medium">Billing & Plans</p>
                  <p class="text-text-secondary mt-1 text-sm">
                    View invoices, update payment methods, and manage your subscription.
                  </p>
                </div>
              </TabPanel>
              <TabPanel value="team">
                <div class="py-2">
                  <p class="text-text-primary font-medium">Team Members</p>
                  <p class="text-text-secondary mt-1 text-sm">
                    Invite colleagues, assign roles, and manage permissions.
                  </p>
                </div>
              </TabPanel>
            {/snippet}
          </Tab>
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
      code={`import { Tab, TabItem, TabPanel } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/tab/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
