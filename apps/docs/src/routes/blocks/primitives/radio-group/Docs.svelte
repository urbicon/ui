<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { RadioGroup, RadioItem } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['variant', 'size', 'tier', 'intent', 'orientation', 'disabled', 'required'],
        defaults: { variant: 'outlined', size: 'md', tier: 'commit', intent: 'primary' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'RadioGroup Component', showToc: true }
  };

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
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
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

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Native Semantics</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Built on native <code class="text-text-primary">&lt;input type="radio"&gt;</code>
          elements inside a <code class="text-text-primary">role="radiogroup"</code> container for
          correct form behavior and assistive technology support. The group label is linked via
          <code class="text-text-primary">aria-labelledby</code>, and error/helper text via
          <code class="text-text-primary">aria-describedby</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          into the group focuses the selected (or first) item.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Arrow</kbd
          >
          keys move between options and select automatically. Vertical groups use
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Up/Down</kbd
          >, horizontal groups use
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Left/Right</kbd
          >. Navigation wraps around at both ends.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Focus Management</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Uses roving tabindex: only the selected item (or the first item when nothing is selected)
          is in the tab order. Disabled items are skipped during arrow key navigation. Focus rings
          use <code class="text-text-primary">focus-visible:</code> via the
          <code class="text-text-primary">peer</code> pattern for keyboard-only visibility.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          All Mint effects and transitions respect
          <code class="text-text-primary">prefers-reduced-motion</code>. The dot transition is
          purely visual and does not affect interaction.
        </p>
      </div>
    </div>
  </div>
</Section>
