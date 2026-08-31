<script lang="ts">
  // One provider-wrapped composition per branch the cascade sweep cannot
  // reach: an orientation it does not mount, a call form it does not build,
  // or an instance prop it never passes. Each `case` is named by the sibling
  // test that reads it — see provider-cascade-branches.svelte.test.ts for what
  // each one is asked.
  import Calendar from '$lib/components/Calendar/Calendar.svelte';
  import CalendarHeader from '$lib/components/Calendar/CalendarHeader.svelte';
  import DatePicker from '$lib/components/DatePicker/DatePicker.svelte';
  import DateRangePicker from '$lib/components/DatePicker/DateRangePicker.svelte';
  import NumberInput from '$lib/components/NumberInput/NumberInput.svelte';
  import Button from '$lib/primitives/Button/Button.svelte';
  import Card from '$lib/primitives/Card/Card.svelte';
  import Menu from '$lib/primitives/Menu/Menu.svelte';
  import MenuItem from '$lib/primitives/Menu/MenuItem.svelte';
  import MenuSection from '$lib/primitives/Menu/MenuSection.svelte';
  import Stepper from '$lib/primitives/Stepper/Stepper.svelte';
  import StepperStep from '$lib/primitives/Stepper/StepperStep.svelte';
  import Tab from '$lib/primitives/Tab/Tab.svelte';
  import TabItem from '$lib/primitives/Tab/TabItem.svelte';
  import TabPanel from '$lib/primitives/Tab/TabPanel.svelte';
  import BlocksProvider from '../BlocksProvider.svelte';
  import type { ComponentDefaults } from '../blocks-context';

  let {
    composition,
    orientation = 'horizontal',
    unstyled = false,
    defaults = {},
    partUnstyled = undefined
  }: {
    composition:
      'tab' | 'stepper' | 'menu' | 'calendar' | 'datePicker' | 'dateRangePicker' | 'numberInput';
    orientation?: 'horizontal' | 'vertical';
    unstyled?: boolean;
    defaults?: Record<string, ComponentDefaults>;
    /** Instance-level `unstyled` on the compound part under measurement. */
    partUnstyled?: boolean | undefined;
  } = $props();

  // Fixed so nothing here depends on today's date.
  const FIXED_DAY = new Date(2026, 0, 15);
</script>

<BlocksProvider {unstyled} {defaults}>
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
         declarative <MenuSection> child and the array-shaped section header.
         Since #361 both render through MenuSection, so the provider reaching
         one is the provider reaching the other — the pair is kept as the
         control that says so, not as two separate code paths. -->
    <Menu open placeholder="declarative">
      <MenuSection label="Group">
        <MenuItem label="one" />
      </MenuSection>
    </Menu>
    <Menu open placeholder="array" items={[{ type: 'section', label: 'Group' }, 'one']} />
  {:else if composition === 'calendar'}
    <Calendar>
      {#snippet header()}
        <!-- `display: contents` so the header's own outermost element stays
             findable by selector rather than by position in Calendar's tree. -->
        <span data-header-scope style="display: contents">
          <CalendarHeader unstyled={partUnstyled} />
        </span>
      {/snippet}
    </Calendar>
    <Card data-control unstyled={false}>control</Card>
  {:else}
    <!-- The embedded controls: both pickers need a value before their clear
         button renders at all, and `<Button>` is the control that says whether
         the provider reached this render. -->
    {#if composition === 'datePicker'}
      <DatePicker value={FIXED_DAY} unstyled={partUnstyled} />
    {:else if composition === 'dateRangePicker'}
      <DateRangePicker value={{ start: FIXED_DAY, end: FIXED_DAY }} unstyled={partUnstyled} />
    {:else if composition === 'numberInput'}
      <NumberInput value={3} unstyled={partUnstyled} />
    {/if}
    <Button data-control unstyled={partUnstyled}>control</Button>
  {/if}
</BlocksProvider>
