<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { BlocksProvider, Kbd, RadioGroup, RadioItem } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let selectedPlan = $state('pro');
</script>

<!-- ─── Purpose ─── -->

<Section marker id="purpose" title="Purpose">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Reach for a RadioGroup to pick <strong class="text-text-primary">exactly one</strong> option from
    a small set, with every choice visible at once.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold">Control</th>
          <th class="py-2 font-semibold">Reach for it when</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top">
            <span class="text-text-primary font-medium">RadioGroup</span>
          </td>
          <td class="py-3 align-top">
            One choice from two to about five options, all worth showing at once: a plan, a shipping
            speed, a payment method.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/checkbox')} class="text-primary hover:underline">
              Checkbox
            </a>
          </td>
          <td class="py-3 align-top">
            Independent on/off toggles, or when more than one option can be selected at the same
            time.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a
              href={resolve('/blocks/primitives/segment-group')}
              class="text-primary hover:underline"
            >
              SegmentGroup
            </a>
          </td>
          <td class="py-3 align-top">
            One choice from a few short, mutually exclusive options where a compact toggle row reads
            better than a stacked list.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/select')} class="text-primary hover:underline">
              Select
            </a>
          </td>
          <td class="py-3 align-top">
            One choice from a long list. Showing every option would crowd the layout, so it
            collapses into a dropdown.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Plan picker with descriptions"
      description="Bind the group to a `$state` variable with `bind:value`, then read it back to drive the rest of the form. A plain `value` sets a starting choice without tracking changes, and `name` sets the key the value submits under."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
      code={`<script>
  let selectedPlan = $state('pro');
<\/script>

<RadioGroup label="Choose your plan" name="plan" bind:value={selectedPlan}>
  <RadioItem value="free" label="Free" description="3 projects, 1 GB storage, community support" />
  <RadioItem value="pro" label="Pro · $12/mo" description="Unlimited projects, 100 GB, priority support" />
  <RadioItem value="enterprise" label="Enterprise" description="Custom limits, SLA, dedicated account manager" />
</RadioGroup>`}
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-4 rounded-2xl border p-5">
        <RadioGroup label="Choose your plan" name="plan" bind:value={selectedPlan}>
          <RadioItem
            value="free"
            label="Free"
            description="3 projects, 1 GB storage, community support"
          />
          <RadioItem
            value="pro"
            label="Pro · $12/mo"
            description="Unlimited projects, 100 GB, priority support"
          />
          <RadioItem
            value="enterprise"
            label="Enterprise"
            description="Custom limits, SLA, dedicated account manager"
          />
        </RadioGroup>
        <p class="text-text-tertiary text-xs">
          Selected: <span class="text-text-primary font-medium">{selectedPlan}</span>
        </p>
      </div>
    </CodeExample>

    <CodeExample
      title="Per-item disabled"
      description="Disable individual options while the rest of the group stays interactive. Arrow-key navigation skips the disabled item."
      isolate
      previewClass="flex flex-col gap-6"
    >
      <RadioGroup label="Shipping speed" value="standard">
        <RadioItem value="standard" label="Standard (3–5 days)" />
        <RadioItem value="express" label="Express (1–2 days)" disabled />
        <RadioItem value="overnight" label="Overnight" />
      </RadioGroup>
    </CodeExample>

    <CodeExample
      title="Helper and error"
      description="Set `helper` or `error` on the group. When both are present, `error` replaces `helper` and marks the group `aria-invalid`."
      isolate
      previewClass="flex flex-col gap-6"
    >
      <RadioGroup label="Frequency" helper="You can change this later in settings">
        <RadioItem value="daily" label="Daily" />
        <RadioItem value="weekly" label="Weekly" />
      </RadioGroup>
      <RadioGroup label="Agreement" error="Please select an option to continue">
        <RadioItem value="accept" label="I accept" />
        <RadioItem value="decline" label="I decline" />
      </RadioGroup>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Card options via one provider default"
      description="A single BlocksProvider default turns every option into a bordered card that tints when selected, so you set the look once instead of repeating slotClasses on each RadioItem."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <BlocksProvider
        defaults={{
          RadioItem: {
            slotClasses: {
              item: 'w-full rounded-contain border border-border-subtle p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10'
            }
          }
        }}
      >
        <RadioGroup label="Region" value="eu" slotClasses={{ group: 'gap-2' }}>
          <RadioItem
            value="eu"
            label="EU (Frankfurt)"
            description="GDPR-friendly, lowest latency in Europe"
          />
          <RadioItem
            value="us"
            label="US (Virginia)"
            description="Closest to North American users"
          />
          <RadioItem
            value="apac"
            label="APAC (Singapore)"
            description="Lowest latency across Asia-Pacific"
          />
        </RadioGroup>
      </BlocksProvider>
    </CodeExample>

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
    <Note title="Built-in ARIA">
      <p>
        Every option is a native <code class="text-text-primary">&lt;input type="radio"&gt;</code>
        inside a <code class="text-text-primary">role="radiogroup"</code> container, so a native
        form submits the selected value and assistive technology reads the group without extra
        wiring. Set
        <code class="text-text-primary">name</code> to control the key it submits under. It is
        auto-generated otherwise. The group label links via
        <code class="text-text-primary">aria-labelledby</code> and helper or error text via
        <code class="text-text-primary">aria-describedby</code>. The selected option is marked by a
        filled dot.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" /> enters the group and lands on the selected item, or on the first item when
        nothing is selected yet. <Kbd keys="Tab" /> again leaves the group for the next control.
        <Kbd keys="Arrow" /> keys move between options and select as they go: <Kbd keys="Up/Down" /> for
        vertical groups, <Kbd keys="Left/Right" /> for horizontal ones, wrapping at both ends and skipping
        disabled items. Focus rings use
        <code class="text-text-primary">focus-visible:</code>, so they appear only for keyboard
        navigation.
      </p>
    </Note>
  </NoteList>
</Section>
