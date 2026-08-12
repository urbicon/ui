<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Kbd, Select } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let country = $state<string | null>(null);
  let tags = $state<string[]>([]);
  let currencyError = $state('');
  let submitted = $state<string | null>(null);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const picked = new FormData(event.currentTarget as HTMLFormElement).get('currency');
    currencyError = picked ? '' : 'Pick a currency before saving';
    submitted = picked ? String(picked) : null;
  }
</script>

<!-- ─── Purpose ─── -->

<Section marker id="purpose" title="Purpose">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Select shows the chosen value and hides the full list until the user opens it.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold">Reach for</th>
          <th class="py-2 font-semibold">When</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top">
            <code class="text-text-primary">Select</code>
            <span class="text-text-tertiary">(this)</span>
          </td>
          <td class="py-3 align-top">
            One choice from a moderate list, where a closed control keeps the form compact.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a
              href={resolve('/blocks/primitives/radio-group')}
              class="text-primary hover:underline"
            >
              RadioGroup
            </a>
          </td>
          <td class="py-3 align-top">
            A short set of two to five options, all worth showing at once.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/combobox')} class="text-primary hover:underline">
              Combobox
            </a>
          </td>
          <td class="py-3 align-top">A long list the user needs to filter by typing.</td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/menu')} class="text-primary hover:underline">
              Menu
            </a>
          </td>
          <td class="py-3 align-top">Firing actions or commands, not binding a form value.</td>
        </tr>
      </tbody>
    </table>
  </div>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Bound value"
      description="`bind:value` holds the `value` of the picked option and is `null` until something is picked, so `country` is a `$state<string | null>(null)` in the parent. `clearable` swaps the chevron for a reset control once there is something to reset."
      isolate
      previewClass="flex flex-col gap-3 max-w-xs"
    >
      <Select
        label="Country"
        bind:value={country}
        clearable
        placeholder="Choose a country"
        options={[
          { label: 'Germany', value: 'de' },
          { label: 'France', value: 'fr' },
          { label: 'Spain', value: 'es' },
          { label: 'Italy', value: 'it' },
          { label: 'United Kingdom', value: 'uk' }
        ]}
      />
      <p class="text-text-tertiary text-xs">
        Selected: <code class="text-text-primary">{country ?? 'null'}</code>
      </p>
    </CodeExample>

    <CodeExample
      title="Grouped options"
      description="`groups` takes the place of `options` and puts each list under a section label. The arrow keys walk the options and pass over the headers. An option with `disabled: true` stays visible, and the arrows pass over it too."
      isolate
      previewClass="flex flex-col gap-3 max-w-xs"
    >
      <Select
        label="Timezone"
        placeholder="Select timezone"
        groups={[
          {
            label: 'Americas',
            options: [
              { label: 'New York (EST)', value: 'est' },
              { label: 'Chicago (CST)', value: 'cst' },
              { label: 'Los Angeles (PST)', value: 'pst', disabled: true }
            ]
          },
          {
            label: 'Europe',
            options: [
              { label: 'London (GMT)', value: 'gmt' },
              { label: 'Berlin (CET)', value: 'cet' },
              { label: 'Moscow (MSK)', value: 'msk' }
            ]
          }
        ]}
      />
    </CodeExample>

    <CodeExample
      title="Several at once"
      description="`multiple` binds `value` to an array. Every row gains a checkbox, the trigger lists the picked labels, and the listbox stays open so the user can tick a few in one go."
      isolate
      previewClass="flex flex-col gap-3 max-w-xs"
    >
      <Select
        label="Tags"
        multiple
        bind:value={tags}
        placeholder="Select tags"
        options={[
          { label: 'Bug', value: 'bug' },
          { label: 'Documentation', value: 'docs' },
          { label: 'Enhancement', value: 'enhancement' },
          { label: 'Good first issue', value: 'good-first-issue' }
        ]}
      />
      <p class="text-text-tertiary text-xs">
        Picked: <code class="text-text-primary">{tags.join(', ') || 'none'}</code>
      </p>
    </CodeExample>

    <CodeExample
      title="In a form"
      description="`name` renders a hidden input carrying the selected value, so a plain form submits the choice without any JavaScript. `required` adds the asterisk to the label and nothing else: the hidden input carries no native constraint, so check the value on submit and hand the message back as `error`, which takes the place of the helper text and switches the field to its danger styling."
      isolate
      previewClass="flex flex-col gap-3 max-w-xs"
    >
      <form class="flex flex-col gap-3" onsubmit={handleSubmit}>
        <Select
          label="Currency"
          name="currency"
          required
          helper="Used for every invoice on this account"
          error={currencyError}
          placeholder="Select..."
          options={[
            { label: 'Euro (EUR)', value: 'eur' },
            { label: 'US Dollar (USD)', value: 'usd' },
            { label: 'British Pound (GBP)', value: 'gbp' }
          ]}
        />
        <Button type="submit" size="sm" class="self-start">Save</Button>
      </form>
      <p class="text-text-tertiary text-xs">
        Submitted: <code class="text-text-primary">{submitted ?? 'nothing yet'}</code>
      </p>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Primary-tinted filter"
      description="`class` lands on the wrapper around the whole field, so a trigger restyle goes through `slotClasses` instead, and the open list is a second slot of its own. Whatever you pass is merged into the tv() defaults, which is why the radius tier, the focus ring and the keyboard behaviour survive it."
      isolate
      previewClass="flex flex-col gap-3 max-w-xs"
    >
      <Select
        label="Sort by"
        value="popular"
        options={[
          { label: 'Most popular', value: 'popular' },
          { label: 'Newest first', value: 'newest' },
          { label: 'Price: low to high', value: 'price-asc' },
          { label: 'Price: high to low', value: 'price-desc' }
        ]}
        slotClasses={{
          trigger: 'bg-primary-subtle border-primary text-primary hover:border-primary',
          chevron: 'text-primary',
          listbox: 'border-primary'
        }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      If every Select in the app should share this treatment, set it once as a
      <code class="text-text-primary">defaults</code> entry for
      <code class="text-text-primary">Select</code> on a
      <code class="text-text-primary">BlocksProvider</code>. A
      <code class="text-text-primary">preset</code> is the opt-in variant of the same thing: it
      reaches only the controls that name it through their
      <code class="text-text-primary">preset</code> prop.
    </p>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA roles">
      <p>
        The trigger is a <code class="text-text-primary">role="combobox"</code> with
        <code class="text-text-primary">aria-expanded</code> and
        <code class="text-text-primary">aria-controls</code> pointing at the panel, a
        <code class="text-text-primary">role="listbox"</code> of
        <code class="text-text-primary">role="option"</code> rows carrying
        <code class="text-text-primary">aria-selected</code>. Focus stays on the trigger the whole
        time and the highlighted row travels with
        <code class="text-text-primary">aria-activedescendant</code>. A
        <code class="text-text-primary">label</code> is linked through
        <code class="text-text-primary">aria-labelledby</code>, and where there is none the trigger
        falls back to the <code class="text-text-primary">aria-label</code> you pass it. Helper and
        error text reach the trigger through
        <code class="text-text-primary">aria-describedby</code>, and an
        <code class="text-text-primary">error</code> sets
        <code class="text-text-primary">aria-invalid</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Enter" />, <Kbd keys="Space" /> and both arrow keys open the listbox.
        <Kbd keys="↑" /> / <Kbd keys="↓" /> move through the selectable options, wrapping at the ends
        and passing over disabled rows. <Kbd keys="Home" /> / <Kbd keys="End" /> highlight the first and
        last of them, and <Kbd keys="Enter" /> / <Kbd keys="Space" /> select whatever is highlighted.
        Focus stays on the trigger while the list is open, so <Kbd keys="Escape" /> only closes it.
        <Kbd keys="Tab" /> closes it and moves on to the next tab stop, which is the clear control whenever
        <code class="text-text-primary">clearable</code> has something to clear.
      </p>
    </Note>
  </NoteList>
</Section>
