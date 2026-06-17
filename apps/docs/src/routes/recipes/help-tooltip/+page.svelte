<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Tooltip, Button, Card, Badge, Input, Slider, InfoCircleIcon } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  const glossary: Record<string, { term: string; text: string }> = {
    'heizkv-7': {
      term: 'HeizKV § 7',
      text: 'The German Heating Costs Ordinance requires that at least 50% and at most 70% of heating costs are billed by consumption. The rest is allocated by living area.'
    },
    jaz: {
      term: 'Jahresarbeitszahl (JAZ)',
      text: 'Seasonal performance factor — the ratio of heat energy produced to electrical energy consumed. A JAZ of 3.5 means 1 kWh of electricity yields 3.5 kWh of heat. Averaged over the whole year.'
    },
    wmz: {
      term: 'Wärmemengenzähler (WMZ)',
      text: 'Heat meter — measures the heat energy delivered, in kWh. Mandatory in multi-unit buildings for heating and hot water, so consumption can be billed to each apartment by actual use.'
    },
    legionella: {
      term: 'Legionella protection',
      text: 'With central hot-water systems, the storage temperature must be ≥ 60 °C to prevent legionella growth. German Drinking Water Ordinance (TrinkwV § 14).'
    }
  };

  let temperature = $state(60);
  let consumptionShare = $state(70);
</script>

<SeoMeta
  title="Help Tooltip Recipe"
  description="Glossary tooltip trigger for domain terms — Tooltip + Button + InfoCircleIcon."
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
        <div>
          <label class="text-text-primary mb-2 flex items-center gap-1 text-sm font-medium">
            Consumption share
            <Tooltip label={glossary['heizkv-7'].text} placement="top" intent="neutral" size="md">
              <Button
                size="2xs"
                variant="ghost"
                intent="neutral"
                aria-label="Explanation: {glossary['heizkv-7'].term}"
              >
                <InfoCircleIcon class="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </label>
          <Slider
            min={0}
            max={100}
            step={5}
            bind:value={consumptionShare}
            formatValue={(v) => `${v} %`}
          />
        </div>

        <div>
          <label class="text-text-primary mb-2 flex items-center gap-1 text-sm font-medium">
            Storage temperature
            <Tooltip label={glossary.legionella.text} placement="top" intent="warning" size="md">
              <Button
                size="2xs"
                variant="ghost"
                intent="neutral"
                aria-label="Explanation: {glossary.legionella.term}"
              >
                <InfoCircleIcon class="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </label>
          <Input
            type="number"
            bind:value={temperature}
            placeholder="°C"
            helper="Recommended: ≥ 60 °C"
          />
        </div>

        <div>
          <p class="text-text-primary text-sm">
            System efficiency is reported via the
            <Tooltip label={glossary.jaz.text} placement="top" intent="neutral" size="md">
              <span
                class="text-primary border-primary/40 inline-flex cursor-help items-baseline gap-0.5 border-b border-dotted"
              >
                Jahresarbeitszahl
                <InfoCircleIcon class="h-3 w-3" />
              </span>
            </Tooltip>
            — values of 3.0 or higher are considered energy-efficient.
          </p>
        </div>

        <div>
          <h4 class="text-text-primary mb-3 text-sm font-semibold">Table header</h4>
          <table class="text-text-primary w-full text-left text-sm">
            <thead class="border-border-subtle border-b">
              <tr>
                <th class="py-2 pr-4 font-medium">Apartment</th>
                <th class="py-2 pr-4 font-medium">
                  <span class="inline-flex items-center gap-1">
                    WMZ reading
                    <Tooltip label={glossary.wmz.text} placement="top" intent="neutral" size="md">
                      <Button
                        size="2xs"
                        variant="ghost"
                        intent="neutral"
                        aria-label="Explanation: {glossary.wmz.term}"
                      >
                        <InfoCircleIcon class="h-3 w-3" />
                      </Button>
                    </Tooltip>
                  </span>
                </th>
                <th class="py-2 font-medium tabular-nums">Consumption</th>
              </tr>
            </thead>
            <tbody class="divide-border-subtle divide-y">
              <tr>
                <td class="py-2 pr-4">Unit 1</td>
                <td class="py-2 pr-4 tabular-nums">12,420 kWh</td>
                <td class="py-2 tabular-nums">8,150 kWh</td>
              </tr>
              <tr>
                <td class="py-2 pr-4">Unit 2</td>
                <td class="py-2 pr-4 tabular-nums">9,880 kWh</td>
                <td class="py-2 tabular-nums">6,230 kWh</td>
              </tr>
            </tbody>
          </table>
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
    <div class="space-y-6">
      <CodeExample
        title="HelpTooltip.svelte (Wrapper)"
        preview={false}
        language="svelte"
        code={`<script lang="ts">
  import { Tooltip, Button, InfoCircleIcon } from '@urbicon-ui/blocks';

  interface Props {
    /** Definition text shown in the tooltip. */
    text: string;
    /** Aria-label term — what is being explained here? */
    term: string;
    /** Optional: warning, danger for legally or safety-relevant hints. */
    intent?: 'neutral' | 'warning' | 'danger';
  }

  const { text, term, intent = 'neutral' }: Props = $props();
</scr` +
          `ipt>

<Tooltip label={text} placement="top" {intent} size="md">
  <Button
    size="2xs"
    variant="ghost"
    intent="neutral"
    aria-label="Explanation: {term}"
  >
    <InfoCircleIcon class="h-3.5 w-3.5" />
  </Button>
</Tooltip>`}
      />

      <CodeExample
        title="lib/glossary.ts (central map)"
        preview={false}
        language="typescript"
        code={`export const glossary = {
  'heizkv-7': {
    term: 'HeizKV § 7',
    text: 'The German Heating Costs Ordinance requires that at least 50% and at most 70% of heating costs are billed by consumption.'
  },
  jaz: {
    term: 'Jahresarbeitszahl (JAZ)',
    text: 'Seasonal performance factor — the ratio of heat energy produced to electrical energy consumed.'
  },
  wmz: {
    term: 'Wärmemengenzähler (WMZ)',
    text: 'Heat meter — measures the heat energy delivered, in kWh.'
  }
} as const;

export type GlossaryKey = keyof typeof glossary;`}
      />

      <CodeExample
        title="Usage in a form label"
        preview={false}
        language="svelte"
        code={`<label class="flex items-center gap-1 text-sm font-medium">
  Consumption share
  <HelpTooltip
    term={glossary['heizkv-7'].term}
    text={glossary['heizkv-7'].text}
  />
</label>`}
      />
    </div>
  </Section>

  <Section id="best-practices" title="Best Practices">
    <Card variant="outlined">
      <div class="divide-border-subtle divide-y">
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Keep the glossary central</h4>
          <p class="text-text-secondary mt-1 text-sm">
            A <code class="text-text-primary">glossary.ts</code> map with term + text as the single source
            of truth. With i18n: one map per locale. That keeps the wording consistent across form labels,
            tables, and tooltips.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Don't forget the aria-label</h4>
          <p class="text-text-secondary mt-1 text-sm">
            The trigger is an icon-only button — screen readers need the term in the
            <code class="text-text-primary">aria-label</code> ("Explanation: HeizKV § 7"). Otherwise the
            user only hears "button" with no context.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Intent for risk hints</h4>
          <p class="text-text-secondary mt-1 text-sm">
            For legally or safety-relevant explanations (<code class="text-text-primary"
              >intent="warning"</code
            >
            for mandatory values,
            <code class="text-text-primary">intent="danger"</code> for consequences). Default
            <code class="text-text-primary">neutral</code> for purely informational tips.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Inline variant for running text</h4>
          <p class="text-text-secondary mt-1 text-sm">
            Instead of a separate icon button, the term itself can act as the tooltip trigger: a
            subtle <code class="text-text-primary">border-bottom dotted</code>
            signals "hover for more". Saves space, avoids icon sprawl in running text.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">
            Don't misuse it for mandatory documentation
          </h4>
          <p class="text-text-secondary mt-1 text-sm">
            Tooltips are not suited to compliance texts or legal notices — those must be permanently
            visible. HelpTooltip is only for supporting explanations the user could also do without.
          </p>
        </div>
      </div>
    </Card>
  </Section>
</div>
