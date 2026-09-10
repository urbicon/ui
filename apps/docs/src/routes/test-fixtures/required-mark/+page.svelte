<script lang="ts">
  // Playwright fixture for e2e/required-mark.spec.ts: the nine fields that draw
  // the required marker, each required and labelled "Email", plus the three
  // shapes a consumer reaches for. The marker's glyph is the slot's `::after`,
  // so its whole visible existence is one stylesheet rule that jsdom cannot
  // see — the spec asks the browser whether it paints, and whether the glyph
  // stays out of the accessible name. Not part of the docs nav.
  import {
    Checkbox,
    Combobox,
    FormField,
    Input,
    PinInput,
    RadioGroup,
    RadioItem,
    Select,
    Textarea,
    TimeInput
  } from '@urbicon-ui/blocks';

  const options = [
    { label: 'Berlin', value: 'berlin' },
    { label: 'Lisbon', value: 'lisbon' }
  ];
</script>

<div class="bg-surface-base min-h-screen space-y-6 p-6" data-testid="required-mark-fixtures">
  <h1 class="text-text-primary text-xl font-bold">Required marker fixtures</h1>

  <div class="max-w-md" data-probe="input">
    <Input required label="Email" />
  </div>

  <div class="max-w-md" data-probe="textarea">
    <Textarea required label="Email" />
  </div>

  <div class="max-w-md" data-probe="select">
    <Select required label="Email" {options} />
  </div>

  <div class="max-w-md" data-probe="combobox">
    <Combobox required label="Email" {options} />
  </div>

  <div class="max-w-md" data-probe="radio-group">
    <RadioGroup required label="Email">
      <RadioItem value="berlin" label="Berlin" />
      <RadioItem value="lisbon" label="Lisbon" />
    </RadioGroup>
  </div>

  <div class="max-w-md" data-probe="checkbox">
    <Checkbox required label="Email" />
  </div>

  <div class="max-w-md" data-probe="pin-input">
    <PinInput required label="Email" />
  </div>

  <div class="max-w-md" data-probe="time-input">
    <TimeInput required label="Email" />
  </div>

  <div class="max-w-md" data-probe="form-field">
    <FormField required label="Email">
      {#snippet children({ id })}
        <input {id} class="border-border-default block rounded border px-2 py-1" />
      {/snippet}
    </FormField>
  </div>

  <!-- Under `unstyled` the span renders empty; the consumer's content class is the marker. -->
  <div class="max-w-md" data-probe="input-unstyled">
    <Input unstyled required label="Email" slotClasses={{ requiredMark: "after:content-['*']" }} />
  </div>

  <!-- A wording instead of a glyph is the same shape. -->
  <div class="max-w-md" data-probe="input-wording">
    <Input required label="Email" slotClasses={{ requiredMark: "after:content-['(required)']" }} />
  </div>

  <!-- Control: the same generated content on a span that is NOT aria-hidden. -->
  <div class="max-w-md" data-probe="control-exposed">
    <label for="control-exposed" class="text-text-secondary block text-sm font-medium">
      Email<span class="ml-1 after:content-['*']"></span>
    </label>
    <input id="control-exposed" class="border-border-default block rounded border px-2 py-1" />
  </div>
</div>
