<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { DatePicker, Kbd, TimeInput } from '@urbicon-ui/blocks';

  let startTime = $state('09:30');
  let meetingTime = $state('14:15');
  let preciseTime = $state('13:45:30');
  let officeTime = $state('09:00');
  let smTime = $state('08:15');
  let mdTime = $state('12:30');
  let lgTime = $state('17:45');
  let errorTime = $state<string | null>(null);

  let apptDate = $state('2026-08-15');
  let apptTime = $state('14:30');
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="24-hour — the default"
      description="The bound value is a canonical 24-hour HH:MM string, or null when the field is empty."
      code={`<script>
  let startTime = $state('09:30');
<\/script>
<TimeInput label="Start" bind:value={startTime} />`}
      language="svelte"
    >
      <TimeInput label="Start" bind:value={startTime} />
      <p class="text-text-secondary mt-2 text-sm">Value: <code>{startTime ?? '—'}</code></p>
    </CodeExample>

    <CodeExample
      title="12-hour display"
      description="format=&quot;12h&quot; adds an AM/PM segment for display only — the bound value stays a canonical 24-hour string (14:15 shows as 02:15 PM but binds as 14:15)."
      code={`<script>
  let meetingTime = $state('14:15');
<\/script>
<TimeInput label="Meeting" format="12h" bind:value={meetingTime} />`}
      language="svelte"
    >
      <TimeInput label="Meeting" format="12h" bind:value={meetingTime} />
      <p class="text-text-secondary mt-2 text-sm">Value (24h): <code>{meetingTime ?? '—'}</code></p>
    </CodeExample>

    <CodeExample
      title="With seconds"
      description="withSeconds appends a seconds segment; the value widens to HH:MM:SS."
      code={`<script>
  let preciseTime = $state('13:45:30');
<\/script>
<TimeInput label="Duration" withSeconds bind:value={preciseTime} />`}
      language="svelte"
    >
      <TimeInput label="Duration" withSeconds bind:value={preciseTime} />
      <p class="text-text-secondary mt-2 text-sm">Value: <code>{preciseTime ?? '—'}</code></p>
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
      title="Sizes"
      description="Three field heights via the size prop — sm, md (default), lg."
      code={`<TimeInput label="Small" size="sm" bind:value={time} />
<TimeInput label="Medium" size="md" bind:value={time} />
<TimeInput label="Large" size="lg" bind:value={time} />`}
      language="svelte"
    >
      <div class="flex flex-col gap-4">
        <TimeInput label="Small" size="sm" bind:value={smTime} />
        <TimeInput label="Medium" size="md" bind:value={mdTime} />
        <TimeInput label="Large" size="lg" bind:value={lgTime} />
      </div>
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

<Section marker="02" id="form-family" title="Date + Time">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      <code>TimeInput</code> closes the last gap in the form family: <code>Calendar</code>,
      <code>DatePicker</code> and <code>DateRangePicker</code> cover dates; <code>TimeInput</code>
      covers the time of day. It edits a time in isolation, so pair it with a
      <code>DatePicker</code> as two separate fields when you need a full timestamp — each keeps its
      own canonical value (an ISO date from the picker, an <code>HH:MM</code> string from the time field),
      which you combine at the boundary.
    </p>
  </div>

  <CodeExample
    title="Date and time side by side"
    description="A DatePicker for the day and a TimeInput for the time — two independent fields, two independent values."
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

<Section marker="03" id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      Reach for named <code>preset</code>s registered on <code>&lt;BlocksProvider&gt;</code> for a
      reusable look, or <code>slotClasses</code> to retouch individual parts — the slots are
      <code>wrapper</code>, <code>label</code>, <code>field</code>, <code>icon</code>,
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

<Section marker="04" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Group semantics">
      <p>
        The field is a <code>role="group"</code> named by its <code>label</code> (or
        <code>aria-label</code>).
      </p>
    </Note>
    <Note title="Per-segment naming">
      <p>
        Each segment — hour, minute, and (when present) second — carries its own
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
