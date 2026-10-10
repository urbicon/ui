<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { DatePicker, Kbd, TimeInput } from '@urbicon-ui/blocks';

  let startTime = $state('09:30');
  let meetingTime = $state('14:15');
  let preciseTime = $state('13:45:30');
  let officeTime = $state('09:00');
  let slotTime = $state('10:15');
  let pickupTime = $state<string | null>();
  let pickupLeft = $state(false);
  const pickupError = $derived(
    pickupLeft && pickupTime === null ? 'Finish the time or clear it' : undefined
  );

  let apptDate = $state('2026-08-15');
  let apptTime = $state('14:30');
  let departureTime = $state('06:45');

  function shown(v: string | null | undefined): string {
    return v === undefined ? 'undefined' : v === null ? 'null' : v;
  }
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Display format vs. bound value"
      previewClass="flex w-full flex-col"
      description="format=&quot;12h&quot; adds an AM/PM segment and withSeconds adds a seconds segment, but both change only what the field shows. The bound value stays a 24-hour string: 14:15 displays as 02:15 PM and still binds as 14:15."
      code={`<script>
  import { TimeInput } from '@urbicon-ui/blocks';
  let startTime = $state('09:30');
  let meetingTime = $state('14:15');
  let preciseTime = $state('13:45:30');
<\/script>
<TimeInput label="Start" bind:value={startTime} />
<TimeInput label="Meeting" format="12h" bind:value={meetingTime} />
<TimeInput label="Duration" withSeconds bind:value={preciseTime} />`}
      language="svelte"
    >
      <div class="flex w-full flex-wrap items-start gap-6">
        <div class="min-w-44 flex-1">
          <TimeInput label="Start" bind:value={startTime} />
          <p class="text-text-secondary mt-2 text-sm">Value: <code>{startTime ?? '—'}</code></p>
        </div>
        <div class="min-w-44 flex-1">
          <TimeInput label="Meeting" format="12h" bind:value={meetingTime} />
          <p class="text-text-secondary mt-2 text-sm">
            Value (24h): <code>{meetingTime ?? '—'}</code>
          </p>
        </div>
        <div class="min-w-44 flex-1">
          <TimeInput label="Duration" withSeconds bind:value={preciseTime} />
          <p class="text-text-secondary mt-2 text-sm">Value: <code>{preciseTime ?? '—'}</code></p>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Empty, half-typed, complete"
      previewClass="flex w-full flex-col"
      description="The value is undefined while every segment is empty, null while the time is half-typed, and a string once it is complete, so an untouched optional field can pass while a half-typed one cannot. This field flags null when focus leaves it. onfocusout also fires on every hop between segments, so compare relatedTarget with the field first; it runs after the min/max clamp, so the value it reads is final."
      code={`<script lang="ts">
  import { TimeInput } from '@urbicon-ui/blocks';
  let pickup = $state<string | null>();
  let left = $state(false);
  const error = $derived(left && pickup === null ? 'Finish the time or clear it' : undefined);
<\/script>
<TimeInput
  label="Pickup"
  {error}
  bind:value={pickup}
  onfocusout={(e) => {
    // Also fires when focus moves from the hour to the minutes.
    left = !e.currentTarget.contains(e.relatedTarget as Node | null);
  }}
/>`}
      language="svelte"
    >
      <TimeInput
        label="Pickup"
        error={pickupError}
        bind:value={pickupTime}
        onfocusout={(e) => {
          pickupLeft = !e.currentTarget.contains(e.relatedTarget as Node | null);
        }}
      />
      <p class="text-text-secondary mt-2 text-sm">Value: <code>{shown(pickupTime)}</code></p>
    </CodeExample>

    <CodeExample
      title="Range bounds"
      previewClass="flex w-full flex-col"
      description="Type 06:00 and click away: values below min or above max clamp back into range on blur, and onValueChange fires with the corrected time. There is no out-of-range state — if 19:30 must be rejected rather than moved, validate before you offer the field."
      code={`<script>
  let officeTime = $state('09:00');
<\/script>
<TimeInput
  label="Appointment"
  min="08:00"
  max="18:00"
  helper="Office hours"
  bind:value={officeTime}
/>`}
      language="svelte"
    >
      <TimeInput
        label="Appointment"
        min="08:00"
        max="18:00"
        helper="Office hours"
        bind:value={officeTime}
      />
      <p class="text-text-secondary mt-2 text-sm">Value: <code>{officeTime ?? '—'}</code></p>
    </CodeExample>

    <CodeExample
      title="A 15-minute raster"
      previewClass="flex w-full flex-col"
      description="step takes seconds, as on input type=&quot;time&quot;, and counts from min, or from midnight without one. The Arrow keys move the minutes 00, 15, 30, 45, and a typed 10:07 becomes 10:00 as soon as its minutes are complete, so the value never holds 10:07. An hourly step (3600) fixes the minutes, and the hour alone completes the time."
      code={`<script>
  let slot = $state('10:15');
<\/script>
<TimeInput label="Slot" step={900} bind:value={slot} />`}
      language="svelte"
    >
      <TimeInput label="Slot" step={900} bind:value={slotTime} />
      <p class="text-text-secondary mt-2 text-sm">Value: <code>{shown(slotTime)}</code></p>
    </CodeExample>
  </div>
</Section>

<Section marker id="form-family" title="Date + Time">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      <code>TimeInput</code> is the form family's time field: <code>Calendar</code>,
      <code>DatePicker</code> and <code>DateRangePicker</code> are for dates, <code>TimeInput</code>
      for the time of day. It edits only the time, so for a full timestamp pair it with a
      <code>DatePicker</code> as two separate fields. Each keeps its own value — an ISO date from
      the picker, an <code>HH:MM</code> string from the time field — and you join them yourself, as
      the example below does. What you get is a local wall-clock time, not a point in time: turning
      <code>2026-08-15T14:30</code> into an instant needs a time zone, and that decision stays with you.
    </p>
  </div>

  <CodeExample
    title="Date and time in one row"
    previewClass="flex w-full flex-col"
    description="Both fields default to full width, so a row needs w-auto on each — without it they stack at every width. flex-wrap then breaks the row when the container gets too narrow for both, which this docs column does at 1024 px."
    code={`<script>
  import { DatePicker, TimeInput } from '@urbicon-ui/blocks';

  let apptDate = $state('2026-08-15');
  let apptTime = $state('14:30');

  // A local wall-clock string. Give it a time zone before it becomes an instant.
  const startsAt = $derived(apptDate && apptTime ? \`\${apptDate}T\${apptTime}\` : null);
<\/script>

<div class="flex flex-wrap items-end gap-3">
  <DatePicker label="Date" class="w-auto" bind:value={apptDate} />
  <TimeInput label="Time" class="w-auto" bind:value={apptTime} />
</div>`}
    language="svelte"
  >
    <div class="flex flex-wrap items-end gap-3">
      <DatePicker label="Date" class="w-auto" bind:value={apptDate} />
      <TimeInput label="Time" class="w-auto" bind:value={apptTime} />
    </div>
    <p class="text-text-secondary mt-2 text-sm">
      Date: <code>{apptDate ?? '—'}</code> · Time: <code>{apptTime ?? '—'}</code> · Joined:
      <code>{apptDate && apptTime ? apptDate + 'T' + apptTime : '—'}</code>
    </p>
  </CodeExample>
</Section>

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      For a reusable look, register a named <code>preset</code> on
      <code>&lt;BlocksProvider&gt;</code>; for individual parts, use <code>slotClasses</code>. The
      slots are <code>wrapper</code> (what <code>class</code> also targets), <code>label</code>,
      <code>field</code>, <code>icon</code> (replace the clock with your own snippet via the
      <code>icon</code> prop), <code>segment</code>, <code>separator</code>,
      <code>meridiem</code>, and <code>message</code>. For a full ground-up restyle, set
      <code>unstyled</code> to drop every default class and rebuild from the slots.
    </p>
    <p>
      <code>{'showIcon={false}'}</code> hides the leading clock icon, and <code>fullWidth</code>
      stretches the field to fill its container instead of hugging its content.
    </p>
  </div>

  <CodeExample
    title="Boarding-pass segments via slotClasses"
    previewClass="flex w-full flex-col"
    description="Each segment gets its own box, so the field reads as three fields rather than one."
    code={`<TimeInput
  label="Departure"
  bind:value={departure}
  slotClasses={{
    field: 'gap-1 border-transparent bg-transparent px-0',
    segment: 'rounded-modify border border-border-default bg-surface-subtle px-2 py-1 font-mono',
    separator: 'text-text-tertiary'
  }}
/>`}
    language="svelte"
  >
    <TimeInput
      label="Departure"
      bind:value={departureTime}
      slotClasses={{
        field: 'gap-1 border-transparent bg-transparent px-0',
        segment:
          'rounded-modify border border-border-default bg-surface-subtle px-2 py-1 font-mono',
        separator: 'text-text-tertiary'
      }}
    />
  </CodeExample>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Group semantics">
      <p>
        The field is a <code>role="group"</code> named by its <code>label</code> (or
        <code>aria-label</code>).
      </p>
    </Note>
    <Note title="Per-segment naming">
      <p>
        Each segment (hour, minute, and, when present, second) carries its own
        <code>aria-label</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <strong>Arrow Up / Down</strong> moves the focused segment by one and wraps inside it — 59
        goes to 00 without carrying the hour. With <code>step</code> it moves to the segment's next
        raster value instead, and a segment the raster fixes is read-only and skipped.
        <strong>Arrow Left / Right</strong> moves between segments; typing digits auto-advances to
        the next. <code>min</code> and <code>max</code> do not limit stepping; they apply on blur.
      </p>
    </Note>
    <Note title="The AM/PM segment">
      <p>
        The AM/PM segment toggles by click, the Arrow keys, <Kbd keys="Enter" /> /
        <Kbd keys="Space" />, or the <Kbd keys="A" /> / <Kbd keys="P" /> keys.
      </p>
    </Note>
    <Note title="Clamping">
      <p>
        Out-of-range values clamp to <code>min</code> / <code>max</code> when the field loses focus.
        With a <code>step</code>, a value above <code>max</code> lands on the last raster point under
        it.
      </p>
    </Note>
    <Note title="Errors are announced">
      <p>
        The error message is announced via <code>role="alert"</code>.
      </p>
    </Note>
  </NoteList>
</Section>
