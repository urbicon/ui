<script lang="ts">
  // Test-only bind harness for Calendar. `bind:` needs a real owner `$state`,
  // which a directly mounted component can't provide — this harness supplies
  // it and exposes the bound selection through an instance export so the test
  // reads what actually arrived at the consumer side of the binding. Lives
  // under __fixtures__/ so it is excluded from the published package
  // (package.json `files`) and never collected as a test.
  import Calendar from '../Calendar.svelte';
  import type { CalendarSelection } from '../calendar.types';
  import type { CalendarProps } from '../index';

  let {
    initial = undefined,
    ...calendarProps
  }: Omit<CalendarProps, 'value'> & { initial?: CalendarSelection } = $props();

  // The type-correct empty selection is `undefined` — exactly the initial the
  // old `value !== undefined` controlled-detection never wrote back to.
  // Seed-once by design: the binding owns the value after mount.
  // svelte-ignore state_referenced_locally
  let selection = $state<CalendarSelection | undefined>(initial);

  export function getSelection(): CalendarSelection | undefined {
    return selection;
  }
</script>

<Calendar bind:value={selection} {...calendarProps} />
