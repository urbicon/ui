<script lang="ts">
  // Test harness for CalendarWeekdayHeader. The component reads everything from
  // getCalendarContext(), so we stand up a minimal Calendar context and inject an
  // explicit `weekdays` array — the one input that drives the keyed {#each}.
  //
  // Why a harness and not a real <Calendar>: the live header renders
  // controller.weekdayNames, which is the 'short' format (Mo, Di, Mi …) — unique in
  // every locale. The each_key_duplicate crash is only reachable when `weekdays`
  // carries duplicates, as the *narrow* names do (de-DE: M, D, M, D, F, S, S). We
  // feed those duplicates directly to prove the position-keyed each no longer throws.
  //
  // Only the fields CalendarWeekdayHeader + createSlotHelper read are populated
  // (weekdays, showWeekNumbers, slotClasses, unstyled). unstyled:true short-circuits
  // the styles lookup in createSlotHelper, so the remaining context fields stay unused
  // and the cast is safe.
  import { setCalendarContext, type CalendarContext } from '../calendar.context';
  import CalendarWeekdayHeader from '../CalendarWeekdayHeader.svelte';

  let { weekdays, showWeekNumbers = false }: { weekdays: string[]; showWeekNumbers?: boolean } =
    $props();

  // Getters (not a plain snapshot) so the context tracks the props, matching the real
  // Calendar context's getter style and keeping svelte's reactivity guard quiet.
  setCalendarContext({
    get weekdays() {
      return weekdays;
    },
    get showWeekNumbers() {
      return showWeekNumbers;
    },
    slotClasses: {},
    unstyled: true
  } as unknown as CalendarContext);
</script>

<CalendarWeekdayHeader />
