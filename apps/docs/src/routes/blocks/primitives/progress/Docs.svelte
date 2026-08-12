<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Progress } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  const totalMb = 18.6;
  let uploadedMb = $state(0);
  let uploading = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  function simulateUpload() {
    if (uploading) return;
    uploadedMb = 0;
    uploading = true;
    timer = setInterval(() => {
      uploadedMb = Math.min(totalMb, Math.round((uploadedMb + 1.4) * 10) / 10);
      if (uploadedMb >= totalMb) {
        uploadedMb = totalMb;
        uploading = false;
        clearInterval(timer);
      }
    }, 220);
  }

  $effect(() => () => clearInterval(timer));

  const uploadButtonLabel = $derived(
    uploading ? 'Uploading…' : uploadedMb >= totalMb ? 'Upload again' : 'Start upload'
  );
</script>

<!-- ─── Purpose ─── -->

<Section marker id="purpose" title="Purpose">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    A progress indicator reports how far a task has advanced. Give it a
    <code class="text-text-primary">value</code> for <strong>determinate</strong> progress. The
    scale runs from 0 to <code class="text-text-primary">max</code>, which defaults to 100, so a
    percentage works on its own and passing <code class="text-text-primary">max</code> counts in
    bytes, steps or any other unit. Omit <code class="text-text-primary">value</code> for a task that
    is running but whose duration you cannot predict.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold">Indicator</th>
          <th class="py-2 font-semibold">Reach for it when</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top"
            >Progress <span class="text-text-tertiary">(determinate)</span></td
          >
          <td class="py-3 align-top"
            >You can measure how far along a task is: bytes uploaded, steps done, a percentage.</td
          >
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"
            >Progress <span class="text-text-tertiary">(indeterminate)</span></td
          >
          <td class="py-3 align-top"
            >A task is running in place but its duration is unknown, and a labelled bar fits the
            layout.</td
          >
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/spinner')} class="text-primary hover:underline"
              >Spinner</a
            >
          </td>
          <td class="py-3 align-top"
            >The wait is short and unmeasured, and a bar would overstate the precision.</td
          >
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/skeleton')} class="text-primary hover:underline"
              >Skeleton</a
            >
          </td>
          <td class="py-3 align-top"
            >Content itself is loading and you can hint at its shape in place.</td
          >
        </tr>
      </tbody>
    </table>
  </div>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="File upload"
      description="On a linear bar, `label` and `showValue` render their own header row above the track, so a file name and a byte count need no markup of your own. `striped animated` reads as an active transfer, and it settles to a solid `success` bar on completion."
      isolate
      previewClass="flex w-full justify-center"
    >
      <div
        class="border-border-subtle bg-surface-elevated w-full max-w-md space-y-3 rounded-2xl border p-5"
      >
        <Progress
          value={uploadedMb}
          max={totalMb}
          label="project-assets.zip"
          showValue
          formatValue={(v, m) => `${v.toFixed(1)} MB / ${m} MB`}
          intent={uploadedMb >= totalMb ? 'success' : 'primary'}
          size="sm"
          striped={uploading}
          animated={uploading}
        />
        <Button variant="outlined" size="sm" onclick={simulateUpload} disabled={uploading}>
          {uploadButtonLabel}
        </Button>
      </div>
    </CodeExample>

    <CodeExample
      title="Indeterminate"
      description="Omit `value` when a task is running but its duration is unknown. The bar loops until the work resolves. Always pass a `label` so the announcement is meaningful."
      isolate
      previewClass="flex w-full justify-center"
    >
      <div class="border-border-subtle bg-surface-elevated w-full max-w-md rounded-2xl border p-5">
        <Progress label="Processing payment…" intent="primary" size="sm" />
        <p class="text-text-tertiary mt-3 text-xs">Please keep this window open.</p>
      </div>
    </CodeExample>

    <CodeExample
      title="Custom value format"
      description="Turn on `showValue` to print the percentage. `formatValue` replaces it with other units, like step counters or storage limits."
      isolate
      previewClass="flex flex-col gap-4 max-w-md w-full mx-auto"
    >
      <Progress
        value={3}
        max={5}
        label="Onboarding"
        showValue
        formatValue={(v, m) => `${v} of ${m} steps`}
      />
      <Progress
        value={750}
        max={1000}
        intent="warning"
        label="Storage"
        showValue
        formatValue={(v) => `${v} MB`}
      />
    </CodeExample>

    <CodeExample
      title="Circular metrics"
      description="`shape=circular` renders a ring with the value in its centre, and `size` sets the diameter. A ring draws no visible label, so `label` names it for screen readers while the caption below it is your own markup."
      isolate
      previewClass="flex justify-center"
    >
      <div class="flex gap-8">
        <div class="flex flex-col items-center gap-2">
          <Progress
            value={92}
            shape="circular"
            intent="success"
            label="Uptime"
            showValue
            size="lg"
          />
          <span class="text-text-secondary text-xs font-medium">Uptime</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Progress value={67} shape="circular" intent="warning" label="CPU" showValue size="lg" />
          <span class="text-text-secondary text-xs font-medium">CPU</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Progress
            value={34}
            shape="circular"
            intent="primary"
            label="Memory"
            showValue
            size="lg"
          />
          <span class="text-text-secondary text-xs font-medium">Memory</span>
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Pill meter"
      description="`class` reaches the root wrapper, so a track restyle goes through `slotClasses`. Track and fill take their height from `size`, which means an override has to reach both or the fill sits short of the track."
      isolate
      previewClass="flex flex-col gap-4 max-w-md w-full mx-auto"
    >
      <Progress
        value={72}
        intent="primary"
        label="Storage used"
        showValue
        slotClasses={{
          track: 'h-3 rounded-full bg-primary/10',
          fill: 'h-3 rounded-full'
        }}
      />
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
    <Note title="ARIA progressbar">
      <p>
        Renders with <code class="text-text-primary">role="progressbar"</code> and
        <code class="text-text-primary">aria-valuemin</code> /
        <code class="text-text-primary">aria-valuemax</code>. In determinate mode it adds
        <code class="text-text-primary">aria-valuenow</code>. In indeterminate mode
        <code class="text-text-primary">aria-valuenow</code> is omitted to signal that progress is unknown.
      </p>
    </Note>
    <Note title="Label">
      <p>
        The <code class="text-text-primary">label</code> prop becomes the
        <code class="text-text-primary">aria-label</code> on the progressbar. On a linear bar it
        also renders as visible text above the track. A ring draws no label, so give it a caption of
        your own next to the <code class="text-text-primary">label</code>. Leave the prop off and
        the announcement falls back to the translated word for progress, which names no task, so an
        indeterminate bar in particular needs one.
      </p>
    </Note>
    <Note title="Reduced motion">
      <p>
        Under <code class="text-text-primary">prefers-reduced-motion</code> the striped and indeterminate
        linear animations stop, and the width transition collapses to an instant update.
      </p>
    </Note>
  </NoteList>
</Section>
