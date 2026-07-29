<!--
  Tab-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Tab, TabItem, TabPanel } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

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

  const controls = deriveControls(componentData, {
    pick: ['variant', 'size', 'tier', 'orientation', 'fullWidth', 'disabled', 'mint'],
    overrides: {
      mint: {
        type: 'dropdown',
        label: 'Mint',
        items: [
          { label: 'none', value: 'none' },
          { label: 'scale', value: 'scale' },
          { label: 'ripple', value: 'ripple' },
          { label: 'glow', value: 'glow' }
        ],
        defaultValue: 'none'
      },
      fullWidth: { label: 'Full Width' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Tab"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeGenerator={tabCodeGenerator}
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
