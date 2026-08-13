<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    CustomBars,
    FreeNights,
    HotelOccupancy,
    SameEventsTwoSurfaces,
    SlotStyling
  } from './examples';

  import customBarsCode from './examples/CustomBars.svelte?raw';
  import freeNightsCode from './examples/FreeNights.svelte?raw';
  import hotelOccupancyCode from './examples/HotelOccupancy.svelte?raw';
  import sameEventsCode from './examples/SameEventsTwoSurfaces.svelte?raw';
  import slotStylingCode from './examples/SlotStyling.svelte?raw';
</script>

<!-- ─── Examples ─── -->
<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Hotel occupancy"
      description="Rooms are the lanes, nights are the columns. `getRange` is inclusive, so a booking stored as check-in and check-out converts by subtracting one day from check-out. Firn 02 shows the payoff: two stays meeting on the same morning sit side by side instead of stacking into two rows. `groups` adds the house headings, `categories` colours the bars and their legend, and `onItemClick` fires for a bar from a click or the keyboard."
      code={hotelOccupancyCode}
    >
      <HotelOccupancy />
    </CodeExample>

    <CodeExample
      title="A free night is where you add one"
      description="`onCellClick` fires only for a cell no bar covers, the hook for an “add booking” affordance. The `cell` snippet renders it; a day inside an existing stay reports `onItemClick` instead, from either input."
      code={freeNightsCode}
    >
      <FreeNights />
    </CodeExample>

    <CodeExample
      title="The same rows on two surfaces"
      description="Moving between the date surfaces is an accessor question, not a conversion one. Both views below read the *same* `CalendarEvent[]`: the timeline finds each lane with `getResourceId` and the nights with `getRange`, and both legends read the same `categories` — `DateCategory` is one type across Calendar, Planner and ResourceTimeline. Reach for a converted copy only when the two views need genuinely different data, not to satisfy a type."
      code={sameEventsCode}
    >
      <SameEventsTwoSurfaces />
    </CodeExample>

    <CodeExample
      title="Bars you render yourself"
      description="The `span` snippet gets your item with its own type, plus the layout geometry for the bar. `isStart` and `isEnd` are false where a stay runs past the window, which the leading and trailing ellipses read from. `getLabel` still supplies the bar's accessible name."
      code={customBarsCode}
    >
      <CustomBars />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker id="customization" title="Customization">
  <div class="space-y-10">
    <CodeExample
      title="slotClasses"
      description="Every slot takes classes of its own; here the `ghost` variant drops the grid lines and turns the bars into pills. Density is separate: `size` sets `--rt-lane-w`, `--rt-day-w` and `--rt-bar-h` on the `track` slot, so a `slotClasses.track` of `[--rt-day-w:4rem]` re-tunes the geometry without a new template."
      code={slotStylingCode}
    >
      <SlotStyling />
    </CodeExample>

    <CodeExample
      title="Load only the visible window"
      description="`onNavigate` fires after every step with the reference date and the window that is now on screen. Fetch there and swap `items`; `resources` stay put."
      code={`<script lang="ts">
  import { ResourceTimeline } from '@urbicon-ui/blocks';
  import { toIso } from '@urbicon-ui/blocks/date';

  let { data } = $props();
  let bookings = $state(data.bookings);

  async function load(range: { start: Date; end: Date }) {
    const query = new URLSearchParams({ from: toIso(range.start), to: toIso(range.end) });
    bookings = await fetch(\`/api/bookings?\${query}\`).then((r) => r.json());
  }
<\/script>

<ResourceTimeline
  view="days"
  days={14}
  resources={data.rooms}
  items={bookings}
  getResourceId={(b) => b.roomId}
  getRange={(b) => ({ start: b.firstNight, end: b.lastNight })}
  onNavigate={(_date, range) => load(range)}
/>`}
      language="svelte"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="The ARIA grid pattern">
      <p>
        The day track is a <code>role="grid"</code>: one <code>row</code> per resource, the lane
        label as its <code>rowheader</code>, one <code>gridcell</code> per day carrying
        <code>aria-colindex</code>, and a <code>columnheader</code> per column in the header row. A
        roving <code>tabindex</code> keeps the whole grid to a single tab stop.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="ArrowLeft" />/<Kbd keys="ArrowRight" /> move one day inside the lane,
        <Kbd keys="ArrowUp" />/<Kbd keys="ArrowDown" /> move one lane at the same day. An arrow at the
        window edge stays put rather than paging.
        <Kbd keys="Home" />/<Kbd keys="End" /> jump to the first and last column of the lane, with
        <Kbd keys="Ctrl" /> to the first and last cell of the grid, and
        <Kbd keys="PageUp" />/<Kbd keys="PageDown" /> step the window.
        <Kbd keys="Enter" />/<Kbd keys="Space" /> activate.
      </p>
    </Note>
    <Note title="Bars are reachable from the cells they cover">
      <p>
        A bar is a button anchored in its first visible day and overhangs the rest, so activating
        any cell it covers reports that item rather than the free-cell hook. Where two bars stack on
        one day, repeated activation walks them from the top row and wraps.
        <code>getLabel</code> is the bar's accessible name; without it a bar announces as “Occupied”.
      </p>
    </Note>
    <Note title="Today stays announced">
      <p>
        Today's column header and cells carry <code>aria-current="date"</code> whether or not
        <code>highlightToday</code> tints them, so turning the tint off keeps the semantic marker.
        The localized window title is mirrored into an
        <code>aria-live="polite"</code> region, so navigating is announced.
      </p>
    </Note>
    <Note title="Motion and scrolling">
      <p>
        Navigation swaps the window with no transition, and there is no swipe gesture.
        <code>overflow-x</code> sits on the day track, never on the root, so a window wider than the viewport
        scrolls the grid instead of the page.
      </p>
    </Note>
  </NoteList>
</Section>
