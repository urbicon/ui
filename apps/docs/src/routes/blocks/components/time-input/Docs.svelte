<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { DatePicker, Kbd, TimeInput } from '@urbicon-ui/blocks';

  let startTime = $state('09:30');
  let meetingTime = $state('14:15');
  let preciseTime = $state('13:45:30');
  let officeTime = $state('09:00');
  let errorTime = $state<string | null>(null);

  let apptDate = $state('2026-08-15');
  let apptTime = $state('14:30');
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Display format vs. bound value"
      description="format=&quot;12h&quot; adds an AM/PM segment and withSeconds adds a seconds segment, but both change only what the field shows. The bound value stays a 24-hour string, or null when the field is empty: 14:15 displays as 02:15 PM and still binds as 14:15."
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
      <div class="flex flex-wrap items-start gap-6">
        <div>
          <TimeInput label="Start" bind:value={startTime} />
          <p class="text-text-secondary mt-2 text-sm">Value: <code>{startTime ?? '—'}</code></p>
        </div>
        <div>
          <TimeInput label="Meeting" format="12h" bind:value={meetingTime} />
          <p class="text-text-secondary mt-2 text-sm">
            Value (24h): <code>{meetingTime ?? '—'}</code>
          </p>
        </div>
        <div>
          <TimeInput label="Duration" withSeconds bind:value={preciseTime} />
          <p class="text-text-secondary mt-2 text-sm">Value: <code>{preciseTime ?? '—'}</code></p>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Range bounds"
      description="Values below min or above max clamp back into range when the field loses focus."
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
      title="Error state"
      description="Pass error to colour the field danger, override the helper, and mark the segments aria-invalid; the message is announced via role=&quot;alert&quot;."
      code={`<script>
  let errorTime = $state(null);
<\/script>
<TimeInput label="Time" error="Please pick a time" bind:value={errorTime} />`}
      language="svelte"
    >
      <TimeInput label="Time" error="Please pick a time" bind:value={errorTime} />
      <p class="text-text-secondary mt-2 text-sm">Value: <code>{errorTime ?? '—'}</code></p>
    </CodeExample>
  </div>
</Section>

<Section marker id="form-family" title="Date + Time">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      <code>TimeInput</code> is the form family's time field: <code>Calendar</code>,
      <code>DatePicker</code> and <code>DateRangePicker</code> are for dates, <code>TimeInput</code>
      for the time of day. It edits only the time, so for a full timestamp pair it with a
      <code>DatePicker</code> as two separate fields. Each keeps its own value (an ISO date from the
      picker, an <code>HH:MM</code> string from the time field), which you combine at the boundary.
    </p>
  </div>

  <CodeExample
    title="Date and time side by side"
    description="A DatePicker for the day and a TimeInput for the time, kept as two separate values."
    code={`<script>
  import { DatePicker, TimeInput } from '@urbicon-ui/blocks';

  let apptDate = $state('2026-08-15');
  let apptTime = $state('14:30');
<\/script>

<div class="flex flex-wrap items-end gap-3">
  <DatePicker label="Date" bind:value={apptDate} />
  <TimeInput label="Time" bind:value={apptTime} />
</div>`}
    language="svelte"
  >
    <div class="flex flex-wrap items-end gap-3">
      <DatePicker label="Date" bind:value={apptDate} />
      <TimeInput label="Time" bind:value={apptTime} />
    </div>
    <p class="text-text-secondary mt-2 text-sm">
      Date: <code>{apptDate ?? '—'}</code> · Time: <code>{apptTime ?? '—'}</code>
    </p>
  </CodeExample>
</Section>

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      For a reusable look, register a named <code>preset</code> on
      <code>&lt;BlocksProvider&gt;</code>; for individual parts, use <code>slotClasses</code>. The
      slots are <code>wrapper</code>, <code>label</code>, <code>field</code>, <code>icon</code>,
      <code>segment</code>, <code>separator</code>, <code>meridiem</code>, and
      <code>message</code>. For a full ground-up restyle, set <code>unstyled</code> to drop every default
      class and rebuild from the slots.
    </p>
    <p>
      <code>{'showIcon={false}'}</code> hides the leading clock icon, and <code>fullWidth</code>
      stretches the field to fill its container instead of hugging its content.
    </p>
  </div>
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
        <strong>Arrow Up / Down</strong> steps the focused segment (with wrap);
        <strong>Arrow Left / Right</strong> moves between segments; typing digits auto-advances to the
        next segment.
      </p>
    </Note>
    <Note title="The AM/PM segment">
      <p>
        The AM/PM segment toggles by click, Arrow keys, or the <Kbd keys="A" /> / <Kbd keys="P" /> keys.
      </p>
    </Note>
    <Note title="Clamping">
      <p>
        Out-of-range values clamp to <code>min</code> / <code>max</code> when the field loses focus.
      </p>
    </Note>
    <Note title="Errors are announced">
      <p>
        The error message is announced via <code>role="alert"</code>.
      </p>
    </Note>
  </NoteList>
</Section>
