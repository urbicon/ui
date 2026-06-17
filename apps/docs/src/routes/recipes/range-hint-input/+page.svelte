<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Input, Card, Badge } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  type Status = 'neutral' | 'success' | 'warning' | 'danger';

  interface RangeHintConfig {
    label: string;
    expectedRange: [number, number];
    tolerancePercent?: number;
    helpOnDanger?: string;
    formatRange?: (n: number) => string;
  }

  const meterConfig: RangeHintConfig = {
    label: 'Heating meter reading',
    expectedRange: [12000, 13500],
    tolerancePercent: 15,
    helpOnDanger: 'Typo or meter replaced?',
    formatRange: (n) => n.toLocaleString('en-US') + ' kWh'
  };
  let meterValue = $state<number | null>(null);

  const budgetConfig: RangeHintConfig = {
    label: 'Planned expense (€)',
    expectedRange: [800, 1200],
    tolerancePercent: 10,
    helpOnDanger: 'Are you sure? The trend was €800–1,200.',
    formatRange: (n) => '€' + n.toLocaleString('en-US')
  };
  let budgetValue = $state<number | null>(null);

  const timeConfig: RangeHintConfig = {
    label: 'Hours on the project this week',
    expectedRange: [7, 9],
    tolerancePercent: 25,
    formatRange: (n) => `${n} h`
  };
  let timeValue = $state<number | null>(null);

  function classifyStatus(value: number | null, config: RangeHintConfig): Status {
    if (value === null || value === undefined || Number.isNaN(value)) return 'neutral';
    const [min, max] = config.expectedRange;
    if (value >= min && value <= max) return 'success';
    const tolerance = ((max - min) * (config.tolerancePercent ?? 15)) / 100;
    if (value >= min - tolerance && value <= max + tolerance) return 'warning';
    return 'danger';
  }

  function formatHelper(value: number | null, config: RangeHintConfig, status: Status): string {
    const fmt = config.formatRange ?? ((n: number) => `${n}`);
    const [min, max] = config.expectedRange;
    if (status === 'success') return `Plausible. Expected: ${fmt(min)}–${fmt(max)}.`;
    if (status === 'warning') return `Slightly outside. Expected: ${fmt(min)}–${fmt(max)}.`;
    if (status === 'danger') {
      const help = config.helpOnDanger ? ` ${config.helpOnDanger}` : '';
      return `Unusual. Expected: ${fmt(min)}–${fmt(max)}.${help}`;
    }
    return `Expected: ${fmt(min)}–${fmt(max)}.`;
  }

  const meterStatus = $derived(classifyStatus(meterValue, meterConfig));
  const meterHelper = $derived(formatHelper(meterValue, meterConfig, meterStatus));
  const budgetStatus = $derived(classifyStatus(budgetValue, budgetConfig));
  const budgetHelper = $derived(formatHelper(budgetValue, budgetConfig, budgetStatus));
  const timeStatus = $derived(classifyStatus(timeValue, timeConfig));
  const timeHelper = $derived(formatHelper(timeValue, timeConfig, timeStatus));

  function intentFor(s: Status): 'default' | 'success' | 'warning' | 'danger' {
    if (s === 'success') return 'success';
    if (s === 'warning') return 'warning';
    if (s === 'danger') return 'danger';
    return 'default';
  }

  function messageTypeFor(s: Status): 'helper' | 'error' {
    return s === 'danger' ? 'error' : 'helper';
  }
</script>

<SeoMeta
  title="Range Hint Input Recipe"
  description="Input with a plausibility range in the helper text that reacts to the value."
/>

<div class="mx-auto max-w-5xl px-6 py-12">
  <header class="mb-10">
    <a
      href={resolve('/recipes')}
      class="text-text-tertiary hover:text-text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
    >
      ← Back to Recipes
    </a>
    <h1 class="text-text-primary mb-3 text-4xl font-bold">{recipeMeta.title}</h1>
    <p class="text-text-secondary text-lg">{recipeMeta.description}</p>
  </header>

  <div class="mb-8 flex flex-wrap gap-2">
    {#each usedComponents as comp (comp)}
      <Badge variant="soft" intent="primary">{comp}</Badge>
    {/each}
  </div>

  <Section id="preview" title="Live Preview">
    <Card variant="outlined">
      <div class="space-y-6 p-6">
        <Input
          type="number"
          label={meterConfig.label}
          bind:value={meterValue}
          intent={intentFor(meterStatus)}
          helper={meterHelper}
          messageType={messageTypeFor(meterStatus)}
          placeholder="e.g. 12750"
        />
        <Input
          type="number"
          label={budgetConfig.label}
          bind:value={budgetValue}
          intent={intentFor(budgetStatus)}
          helper={budgetHelper}
          messageType={messageTypeFor(budgetStatus)}
          placeholder="e.g. 950"
        />
        <Input
          type="number"
          label={timeConfig.label}
          bind:value={timeValue}
          intent={intentFor(timeStatus)}
          helper={timeHelper}
          messageType={messageTypeFor(timeStatus)}
          placeholder="e.g. 8"
        />

        <div class="border-border-subtle bg-surface-subtle rounded-md border p-3 text-xs">
          <p class="text-text-secondary mb-1 font-medium">Try the three zones:</p>
          <ul class="text-text-tertiary list-disc space-y-0.5 pl-4">
            <li>
              <strong class="text-success">Plausible:</strong> e.g. 12500 (within 12000–13500)
            </li>
            <li>
              <strong class="text-warning">Slightly off:</strong> e.g. 11800 (within the 15% tolerance)
            </li>
            <li>
              <strong class="text-danger">Unusual:</strong> e.g. 99 (far outside)
            </li>
          </ul>
        </div>
      </div>
    </Card>
  </Section>

  <Section id="features" title="Features">
    <Card variant="outlined">
      <ul class="divide-border-subtle divide-y">
        {#each features as feature (feature)}
          <li class="text-text-secondary px-4 py-3 text-sm">{feature}</li>
        {/each}
      </ul>
    </Card>
  </Section>

  <Section id="code" title="Code">
    <CodeExample
      title="RangeHintInput.svelte"
      preview={false}
      language="svelte"
      code={`<script lang="ts">
  import { Input } from '@urbicon-ui/blocks';

  let { value = $bindable(), expectedRange, label, tolerancePercent = 15, helpOnDanger }: {
    value: number | null;
    expectedRange: [number, number];
    label: string;
    tolerancePercent?: number;
    helpOnDanger?: string;
  } = $props();

  type Status = 'neutral' | 'success' | 'warning' | 'danger';

  const status = $derived.by<Status>(() => {
    if (value === null || value === undefined) return 'neutral';
    const [min, max] = expectedRange;
    if (value >= min && value <= max) return 'success';
    const tolerance = (max - min) * (tolerancePercent / 100);
    if (value >= min - tolerance && value <= max + tolerance) return 'warning';
    return 'danger';
  });

  const message = $derived.by(() => {
    const [min, max] = expectedRange;
    const fmt = (n: number) => n.toLocaleString('en-US');
    if (status === 'success')  return \`Plausible. Expected: \${fmt(min)}–\${fmt(max)}.\`;
    if (status === 'warning')  return \`Slightly outside. Expected: \${fmt(min)}–\${fmt(max)}.\`;
    if (status === 'danger')   return \`Unusual. Expected: \${fmt(min)}–\${fmt(max)}.\${helpOnDanger ? ' ' + helpOnDanger : ''}\`;
    return \`Expected: \${fmt(min)}–\${fmt(max)}.\`;
  });

  const intentMap = { neutral: 'default', success: 'success', warning: 'warning', danger: 'danger' } as const;
</scr` +
        `ipt>

<Input
  {label}
  type="number"
  bind:value
  intent={intentMap[status]}
  helper={message}
  messageType={status === 'danger' ? 'error' : 'helper'}
/>`}
    />
  </Section>

  <Section id="best-practices" title="Best Practices">
    <Card variant="outlined">
      <div class="divide-border-subtle divide-y">
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">expectedRange from real data</h4>
          <p class="text-text-secondary mt-1 text-sm">
            Last year's value ± 15%, or a trend extrapolation from the last 3 periods. Hardcoded
            ranges feel arbitrary — derived ranges signal to the user that the app understands them.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Tolerance factor per domain</h4>
          <p class="text-text-secondary mt-1 text-sm">
            15% is a sensible default. Stricter for required fields (5%), wider for estimates (30%).
            Never 0% — otherwise there is no "slightly off".
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Status never blocks</h4>
          <p class="text-text-secondary mt-1 text-sm">
            The input stays validation-free — the user can deliberately enter values outside the
            range (meter replacement, special case, settlement value). For hard constraints, set an
            <code class="text-text-primary">error</code> prop instead.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Explain the why on danger</h4>
          <p class="text-text-secondary mt-1 text-sm">
            For values far outside the range, offer an additional contextual hint — "Typo? Meter
            replaced? Special tariff?". That raises the correction rate without blocking the user.
          </p>
        </div>
      </div>
    </Card>
  </Section>
</div>
