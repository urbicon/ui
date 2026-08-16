<script lang="ts">
  import { InfoCircleIcon, Input, Slider, Tooltip } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';
  // The two files the page shows are real siblings: the demo imports them and
  // the code panels render their source (?raw), so neither can drift. Real is
  // also what Vite's dependency scanner needs — it resolves the
  // `.svelte`-suffixed import it regex-finds inside the recipeCode literal,
  // and a path with no file behind it fails the whole scan with ENOENT.
  import HelpTooltip from './HelpTooltip.svelte';
  import { glossary } from './glossary';
  import helpTooltipCode from './HelpTooltip.svelte?raw';
  import glossaryCode from './glossary.ts?raw';

  let consumptionShare = $state(70);
  let temperature = $state(60);

  const recipeCode = `<\script lang="ts">
  import { InfoCircleIcon, Input, Slider, Tooltip } from '@urbicon-ui/blocks';
  // Both live beside this page; move them to $lib once more pages need them.
  import HelpTooltip from './HelpTooltip.svelte';
  import { glossary } from './glossary';

  let consumptionShare = $state(70);
  let temperature = $state(60);
<\/script>

<!-- Lay the blocks out in your page's own column; the width cap is the demo's. -->
<div class="w-full max-w-xl space-y-6">
  <div>
    <!-- The label row is hand-built so the trigger can sit in it. The span
         hands its text to the slider via aria-labelledby; without that the
         thumb announces itself as a bare "Slider". -->
    <div class="mb-2 flex items-center gap-1">
      <span id="consumption-share-label" class="text-text-primary text-sm font-medium">
        Consumption share
      </span>
      <HelpTooltip term={glossary['heizkv-7'].term} text={glossary['heizkv-7'].text} />
      <span class="text-text-tertiary ml-auto text-sm tabular-nums">{consumptionShare} %</span>
    </div>
    <Slider
      min={0}
      max={100}
      step={5}
      bind:value={consumptionShare}
      aria-labelledby="consumption-share-label"
    />
  </div>

  <div>
    <div class="mb-2 flex items-center gap-1">
      <label for="storage-temperature" class="text-text-primary text-sm font-medium">
        Storage temperature
      </label>
      <HelpTooltip
        term={glossary.legionella.term}
        text={glossary.legionella.text}
        intent="warning"
      />
    </div>
    <Input
      id="storage-temperature"
      type="number"
      bind:value={temperature}
      placeholder="°C"
      helper="Recommended: ≥ 60 °C"
    />
  </div>

  <!-- In running text the term itself is the trigger. It needs the tabindex to
       open on keyboard focus, which the Button gives the icon triggers for free. -->
  <p class="text-text-primary text-sm">
    System efficiency is reported via the
    <Tooltip label={glossary.jaz.text}>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <span
        tabindex="0"
        class="text-primary border-primary/40 inline-flex cursor-help items-baseline gap-0.5 border-b border-dotted"
      >
        Jahresarbeitszahl
        <InfoCircleIcon class="h-3 w-3" />
      </span>
    </Tooltip> and values of 3.0 or higher count as energy-efficient.
  </p>

  <table class="text-text-primary w-full text-left text-sm">
    <caption class="text-text-primary pb-3 text-left text-sm font-semibold">
      Meter readings
    </caption>
    <thead class="border-border-hairline border-b">
      <tr>
        <th class="py-2 pr-4 font-medium">Apartment</th>
        <th class="py-2 pr-4 font-medium">
          <span class="inline-flex items-center gap-1">
            WMZ reading
            <HelpTooltip term={glossary.wmz.term} text={glossary.wmz.text} />
          </span>
        </th>
        <th class="py-2 font-medium">Consumption</th>
      </tr>
    </thead>
    <tbody class="divide-border-hairline divide-y">
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
</div>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <!-- Stacked CodeExamples carry no margin of their own; the wrapper spaces
         them (same as clickable-card and page-header). -->
    <div class="space-y-10">
      <CodeExample
        title="HeatingPage.svelte"
        description="Hover an info icon, or Tab onto it, and the definition opens; `Escape` closes it. The dotted term inside the sentence is the fourth trigger."
        code={recipeCode}
        language="svelte"
        headingLevel={2}
      >
        <div class="w-full max-w-xl space-y-6">
          <div>
            <div class="mb-2 flex items-center gap-1">
              <span id="consumption-share-label" class="text-text-primary text-sm font-medium">
                Consumption share
              </span>
              <HelpTooltip term={glossary['heizkv-7'].term} text={glossary['heizkv-7'].text} />
              <span class="text-text-tertiary ml-auto text-sm tabular-nums"
                >{consumptionShare} %</span
              >
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              bind:value={consumptionShare}
              aria-labelledby="consumption-share-label"
            />
          </div>

          <div>
            <div class="mb-2 flex items-center gap-1">
              <label for="storage-temperature" class="text-text-primary text-sm font-medium">
                Storage temperature
              </label>
              <HelpTooltip
                term={glossary.legionella.term}
                text={glossary.legionella.text}
                intent="warning"
              />
            </div>
            <Input
              id="storage-temperature"
              type="number"
              bind:value={temperature}
              placeholder="°C"
              helper="Recommended: ≥ 60 °C"
            />
          </div>

          <p class="text-text-primary text-sm">
            System efficiency is reported via the
            <Tooltip label={glossary.jaz.text}>
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <span
                tabindex="0"
                class="text-primary border-primary/40 inline-flex cursor-help items-baseline gap-0.5 border-b border-dotted"
              >
                Jahresarbeitszahl
                <InfoCircleIcon class="h-3 w-3" />
              </span>
            </Tooltip> and values of 3.0 or higher count as energy-efficient.
          </p>

          <table class="text-text-primary w-full text-left text-sm">
            <caption class="text-text-primary pb-3 text-left text-sm font-semibold">
              Meter readings
            </caption>
            <thead class="border-border-hairline border-b">
              <tr>
                <th class="py-2 pr-4 font-medium">Apartment</th>
                <th class="py-2 pr-4 font-medium">
                  <span class="inline-flex items-center gap-1">
                    WMZ reading
                    <HelpTooltip term={glossary.wmz.term} text={glossary.wmz.text} />
                  </span>
                </th>
                <th class="py-2 font-medium">Consumption</th>
              </tr>
            </thead>
            <tbody class="divide-border-hairline divide-y">
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
      </CodeExample>

      <CodeExample
        title="HelpTooltip.svelte"
        description="The shared trigger: a ghost icon `Button` whose `aria-label` names the term, wrapped in the `Tooltip` that carries the definition."
        code={helpTooltipCode}
        language="svelte"
        headingLevel={2}
        preview={false}
      />

      <CodeExample
        title="glossary.ts"
        description="The map every trigger reads from; `as const`, so the keys stay checkable."
        code={glossaryCode}
        language="typescript"
        headingLevel={2}
        preview={false}
      />
    </div>
  </Section>

  <Section id="decisions" title="Three decisions">
    <NoteList>
      <Note title="Why the trigger is a Button">
        <p>
          The tooltip opens on keyboard focus as well as hover, but only when the trigger can take
          focus, and the icon alone says nothing to a screen reader. A
          <code class="text-text-primary">Button</code> settles both: it is focusable by nature, and
          its <code class="text-text-primary">aria-label</code> names the term ("Explanation: HeizKV
          § 7"), which is why <code class="text-text-primary">term</code> is required alongside
          <code class="text-text-primary">text</code>. The inline span in the sentence pays for
          skipping it with the <code class="text-text-primary">tabindex="0"</code> and the ignore comment
          above it.
        </p>
      </Note>
      <Note title="One glossary, one wording">
        <p>
          The same term shows up in a label, a table header and a sentence; a single
          <code class="text-text-primary">glossary.ts</code> keeps the three explanations identical.
          The <code class="text-text-primary">as const</code> map also makes a lookup on a removed key
          a type error at the trigger that used it, instead of an empty tooltip. With i18n the map is
          what you localise: one map per locale, same keys.
        </p>
      </Note>
      <Note title="A tooltip is optional reading">
        <p>
          The pattern fits explanations a reader can do without; anything binding belongs on the
          page itself. The demo keeps that split: the tooltip explains why the 60 °C floor exists,
          the floor itself stays visible in the field's
          <code class="text-text-primary">helper</code>.
          <code class="text-text-primary">intent="warning"</code> tints the panel for such hints, it does
          not make them visible.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
