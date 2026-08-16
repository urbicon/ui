<script lang="ts">
  import { Input } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  // Input's own intent names: a status feeds intent with no mapping layer.
  type RangeStatus = 'default' | 'success' | 'warning' | 'danger';

  // One config per field, two shared functions: a new plausibility field is
  // another config object, not a new component.
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
    helpOnDanger: 'One-off purchase, or a typo?',
    formatRange: (n) => '€' + n.toLocaleString('en-US')
  };
  let budgetValue = $state<number | null>(null);

  const timeConfig: RangeHintConfig = {
    label: 'Hours on the project this week',
    expectedRange: [7, 9],
    tolerancePercent: 25,
    formatRange: (n) => n + ' h'
  };
  let timeValue = $state<number | null>(null);

  function classifyStatus(value: number | null, config: RangeHintConfig): RangeStatus {
    if (value == null || Number.isNaN(value)) return 'default';
    const [min, max] = config.expectedRange;
    if (value >= min && value <= max) return 'success';
    // The buffer scales with the range width, so one percentage means the
    // same "slightly outside" for 7–9 h as for 12,000–13,500 kWh.
    const tolerance = ((max - min) * (config.tolerancePercent ?? 15)) / 100;
    if (value >= min - tolerance && value <= max + tolerance) return 'warning';
    return 'danger';
  }

  function formatHelper(config: RangeHintConfig, status: RangeStatus): string {
    const fmt = config.formatRange ?? ((n: number) => String(n));
    const [min, max] = config.expectedRange;
    const range = `${fmt(min)}–${fmt(max)}`;
    if (status === 'success') return `Plausible. Expected: ${range}.`;
    if (status === 'warning') return `Slightly outside. Expected: ${range}.`;
    if (status === 'danger') {
      const help = config.helpOnDanger ? ' ' + config.helpOnDanger : '';
      return `Unusual. Expected: ${range}.${help}`;
    }
    return `Expected: ${range}.`;
  }

  const meterStatus = $derived(classifyStatus(meterValue, meterConfig));
  const meterHelper = $derived(formatHelper(meterConfig, meterStatus));
  const budgetStatus = $derived(classifyStatus(budgetValue, budgetConfig));
  const budgetHelper = $derived(formatHelper(budgetConfig, budgetStatus));
  const timeStatus = $derived(classifyStatus(timeValue, timeConfig));
  const timeHelper = $derived(formatHelper(timeConfig, timeStatus));

  const recipeCode = `<\script lang="ts">
  import { Input } from '@urbicon-ui/blocks';

  // Input's own intent names: a status feeds intent with no mapping layer.
  type RangeStatus = 'default' | 'success' | 'warning' | 'danger';

  // One config per field, two shared functions: a new plausibility field is
  // another config object, not a new component.
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
    helpOnDanger: 'One-off purchase, or a typo?',
    formatRange: (n) => '€' + n.toLocaleString('en-US')
  };
  let budgetValue = $state<number | null>(null);

  const timeConfig: RangeHintConfig = {
    label: 'Hours on the project this week',
    expectedRange: [7, 9],
    tolerancePercent: 25,
    formatRange: (n) => n + ' h'
  };
  let timeValue = $state<number | null>(null);

  function classifyStatus(value: number | null, config: RangeHintConfig): RangeStatus {
    if (value == null || Number.isNaN(value)) return 'default';
    const [min, max] = config.expectedRange;
    if (value >= min && value <= max) return 'success';
    // The buffer scales with the range width, so one percentage means the
    // same "slightly outside" for 7–9 h as for 12,000–13,500 kWh.
    const tolerance = ((max - min) * (config.tolerancePercent ?? 15)) / 100;
    if (value >= min - tolerance && value <= max + tolerance) return 'warning';
    return 'danger';
  }

  function formatHelper(config: RangeHintConfig, status: RangeStatus): string {
    const fmt = config.formatRange ?? ((n: number) => String(n));
    const [min, max] = config.expectedRange;
    const range = \`\${fmt(min)}–\${fmt(max)}\`;
    if (status === 'success') return \`Plausible. Expected: \${range}.\`;
    if (status === 'warning') return \`Slightly outside. Expected: \${range}.\`;
    if (status === 'danger') {
      const help = config.helpOnDanger ? ' ' + config.helpOnDanger : '';
      return \`Unusual. Expected: \${range}.\${help}\`;
    }
    return \`Expected: \${range}.\`;
  }

  const meterStatus = $derived(classifyStatus(meterValue, meterConfig));
  const meterHelper = $derived(formatHelper(meterConfig, meterStatus));
  const budgetStatus = $derived(classifyStatus(budgetValue, budgetConfig));
  const budgetHelper = $derived(formatHelper(budgetConfig, budgetStatus));
  const timeStatus = $derived(classifyStatus(timeValue, timeConfig));
  const timeHelper = $derived(formatHelper(timeConfig, timeStatus));
<\/script>

<!-- The form column: centre it in your page's own layout. -->
<div class="w-full max-w-md space-y-6">
  <!-- Plausibility, not validation: nothing gates the entry. intent tints
       the field's border; the message stays in the quiet helper voice, and
       the error prop stays free for hard constraints. -->
  <Input
    type="number"
    label={meterConfig.label}
    bind:value={meterValue}
    intent={meterStatus}
    helper={meterHelper}
    placeholder="e.g. 12750"
  />
  <Input
    type="number"
    label={budgetConfig.label}
    bind:value={budgetValue}
    intent={budgetStatus}
    helper={budgetHelper}
    placeholder="e.g. 950"
  />
  <Input
    type="number"
    label={timeConfig.label}
    bind:value={timeValue}
    intent={timeStatus}
    helper={timeHelper}
    placeholder="e.g. 8"
  />
</div>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="ReportPage.svelte"
      description="Try `12500`, `11800` and `99` in the meter field to get all three verdicts: plausible, slightly outside, unusual."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="w-full max-w-md space-y-6">
        <Input
          type="number"
          label={meterConfig.label}
          bind:value={meterValue}
          intent={meterStatus}
          helper={meterHelper}
          placeholder="e.g. 12750"
        />
        <Input
          type="number"
          label={budgetConfig.label}
          bind:value={budgetValue}
          intent={budgetStatus}
          helper={budgetHelper}
          placeholder="e.g. 950"
        />
        <Input
          type="number"
          label={timeConfig.label}
          bind:value={timeValue}
          intent={timeStatus}
          helper={timeHelper}
          placeholder="e.g. 8"
        />
      </div>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="Unusual is not invalid">
        <p>
          A value far outside the range can still be right: a reading after a meter swap or a
          one-off purchase lands there legitimately, so the field keeps accepting it and
          <code class="text-text-primary">helpOnDanger</code> asks the question that separates a
          typo from a real outlier. When a limit is hard, set Input's
          <code class="text-text-primary">error</code> prop instead: it replaces
          <code class="text-text-primary">helper</code> and outranks
          <code class="text-text-primary">intent</code>, so a hard constraint takes the field over
          while it is violated.
        </p>
      </Note>
      <Note title="The range comes from data, the tolerance from the domain">
        <p>
          Derive <code class="text-text-primary">expectedRange</code> from what the app already
          knows (last period's value, a trend over the last three); a hand-picked constant drifts as
          consumption or prices move, and the hint starts flagging normal values.
          <code class="text-text-primary">tolerancePercent</code> is a per-field judgment: tighter
          where entries should be exact, wider for estimates, and never
          <code class="text-text-primary">0</code>, which erases the warning zone and makes every
          miss read as unusual.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
