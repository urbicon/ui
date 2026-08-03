<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, RadioGroup, RadioItem } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let selectedPlan = $state('pro');
  let selectedTheme = $state('system');
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="With descriptions"
      description="Pair each option with secondary text — the most common pattern for plan pickers, settings, and preferences."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <RadioGroup label="Plan">
        <RadioItem value="free" label="Free" description="Up to 3 projects, 1 GB storage" />
        <RadioItem value="pro" label="Pro" description="Unlimited projects, 100 GB storage" />
        <RadioItem
          value="enterprise"
          label="Enterprise"
          description="Custom limits, dedicated support"
        />
      </RadioGroup>
    </CodeExample>

    <CodeExample
      title="Per-item disabled"
      description="Disable individual options while the rest of the group stays interactive. Keyboard navigation skips disabled items."
      isolate
      previewClass="flex flex-col gap-6"
    >
      <RadioGroup label="Shipping speed" value="standard">
        <RadioItem value="standard" label="Standard (3-5 days)" />
        <RadioItem value="express" label="Express (1-2 days)" disabled />
        <RadioItem value="overnight" label="Overnight" />
      </RadioGroup>
    </CodeExample>

    <CodeExample
      title="Helper & error"
      description="Group-level helper and error text follow the same form-field contract as Input — `error` overrides `helper` when both are set."
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

    <CodeExample
      title="Pricing Plan Selector"
      description="RadioGroup in a realistic settings context with bound value."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-4 rounded-2xl border p-5">
        <RadioGroup label="Choose your plan" bind:value={selectedPlan} intent="success">
          <RadioItem
            value="free"
            label="Free"
            description="3 projects, 1 GB storage, community support"
          />
          <RadioItem
            value="pro"
            label="Pro — $12/mo"
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
      title="Theme Selector"
      description="Horizontal layout for compact inline choices."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-5">
        <RadioGroup
          label="Appearance"
          orientation="horizontal"
          bind:value={selectedTheme}
          intent="neutral"
        >
          <RadioItem value="light" label="Light" />
          <RadioItem value="dark" label="Dark" />
          <RadioItem value="system" label="System" />
        </RadioGroup>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Card Options via slotClasses"
      description="RadioGroup styles the group shell (root, group, label, message); each RadioItem owns its item, indicator, dot, label, and description slots. Here every option becomes a bordered card that highlights while selected — the has-[:checked] variant reads the native input inside the item."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <RadioGroup label="Region" value="eu" slotClasses={{ group: 'gap-2' }}>
        <RadioItem
          value="eu"
          label="EU (Frankfurt)"
          description="GDPR-friendly, lowest latency in Europe"
          slotClasses={{
            item: 'w-full rounded-xl border border-border-subtle p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5'
          }}
        />
        <RadioItem
          value="us"
          label="US (Virginia)"
          description="Closest to North American users"
          slotClasses={{
            item: 'w-full rounded-xl border border-border-subtle p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5'
          }}
        />
      </RadioGroup>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      <code class="text-text-primary">unstyled</code> (per item) drops the indicator and label
      styling while the native radio semantics, roving tabindex, and arrow-key navigation keep
      working. When the card treatment above is your app's standard option style, register it once
      as a <code class="text-text-primary">BlocksProvider</code> preset (<code
        class="text-text-primary">presets.RadioGroup</code
      >
      /
      <code class="text-text-primary">presets.RadioItem</code>) instead of repeating
      <code class="text-text-primary">slotClasses</code> — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Native Semantics">
      <p>
        Built on native <code class="text-text-primary">&lt;input type="radio"&gt;</code>
        elements inside a <code class="text-text-primary">role="radiogroup"</code> container for
        correct form behavior and assistive technology support. The group label is linked via
        <code class="text-text-primary">aria-labelledby</code>, and error/helper text via
        <code class="text-text-primary">aria-describedby</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" />
        into the group focuses the selected (or first) item.
        <Kbd keys="Arrow" />
        keys move between options and select automatically. Vertical groups use
        <Kbd keys="Up/Down" />, horizontal groups use
        <Kbd keys="Left/Right" />. Navigation wraps around at both ends.
      </p>
    </Note>
    <Note title="Focus Management">
      <p>
        Uses roving tabindex: only the selected item (or the first item when nothing is selected) is
        in the tab order. Disabled items are skipped during arrow key navigation. Focus rings use <code
          class="text-text-primary">focus-visible:</code
        >
        via the
        <code class="text-text-primary">peer</code> pattern for keyboard-only visibility.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        All Mint effects and transitions respect
        <code class="text-text-primary">prefers-reduced-motion</code>. The dot transition is purely
        visual and does not affect interaction.
      </p>
    </Note>
  </NoteList>
</Section>
