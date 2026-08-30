<script lang="ts">
  // One provider-wrapped composition per branch the cascade sweep cannot
  // reach: an orientation it does not mount, a call form it does not build,
  // or an instance prop it never passes. Each `case` is named by the sibling
  // test that reads it — see provider-cascade-branches.svelte.test.ts for what
  // each one is asked.
  import Calendar from '$lib/components/Calendar/Calendar.svelte';
  import CalendarHeader from '$lib/components/Calendar/CalendarHeader.svelte';
  import LocaleSwitcher from '$lib/components/LocaleSwitcher/LocaleSwitcher.svelte';
  import Card from '$lib/primitives/Card/Card.svelte';
  import Menu from '$lib/primitives/Menu/Menu.svelte';
  import MenuSection from '$lib/primitives/Menu/MenuSection.svelte';
  import Stepper from '$lib/primitives/Stepper/Stepper.svelte';
  import StepperStep from '$lib/primitives/Stepper/StepperStep.svelte';
  import Tab from '$lib/primitives/Tab/Tab.svelte';
  import TabItem from '$lib/primitives/Tab/TabItem.svelte';
  import TabPanel from '$lib/primitives/Tab/TabPanel.svelte';
  import BlocksProvider from '../BlocksProvider.svelte';
  import type { ComponentDefaults, PresetMap } from '../blocks-context';

  let {
    composition,
    orientation = 'horizontal',
    unstyled = false,
    defaults = {},
    presets = {},
    partUnstyled = undefined,
    partPreset = undefined
  }: {
    composition: 'tab' | 'stepper' | 'menu' | 'calendar' | 'localeSwitcher';
    orientation?: 'horizontal' | 'vertical';
    unstyled?: boolean;
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
    /** Instance-level `unstyled` on the compound part under measurement. */
    partUnstyled?: boolean | undefined;
    /** Instance-level `preset` on the compound part under measurement. */
    partPreset?: string | undefined;
  } = $props();
</script>

<BlocksProvider {unstyled} {defaults} {presets}>
  {#if composition === 'tab'}
    <Tab value="a" {orientation}>
      {#snippet tabs()}
        <TabItem value="a">A</TabItem>
      {/snippet}
      {#snippet panels()}
        <TabPanel value="a" transition={false}>content</TabPanel>
      {/snippet}
    </Tab>
  {:else if composition === 'stepper'}
    <Stepper {orientation}>
      <StepperStep label="One" />
      <StepperStep label="Two" />
    </Stepper>
  {:else if composition === 'menu'}
    <!-- The two call forms of the same `section` slot, side by side: the
         declarative <MenuSection> child and the array-shaped section header. -->
    <Menu open placeholder="declarative">
      <MenuSection label="Group" />
    </Menu>
    <Menu open placeholder="array" items={[{ type: 'section', label: 'Group' }, 'one']} />
  {:else if composition === 'calendar'}
    <Calendar>
      {#snippet header()}
        <CalendarHeader unstyled={partUnstyled} />
      {/snippet}
    </Calendar>
    <Card data-control unstyled={false}>control</Card>
  {:else if composition === 'localeSwitcher'}
    <LocaleSwitcher preset={partPreset} />
  {/if}
</BlocksProvider>
