<script lang="ts">
  import { CodeExample, CodePanel, Section } from '@urbicon-ui/docs';

  // The panel needs real code to show anything, and the page's playground
  // already has a sample worth reusing — passing it down keeps the two demos
  // showing the same snippet instead of drifting apart.
  let { SAMPLE }: { SAMPLE: string } = $props();

  const ONE_LINER = `bun add @urbicon-ui/blocks`;
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Line numbers below the threshold"
      description="`auto` leaves the gutter off for short snippets — a single line gains nothing from a number in front of it."
      isolate
    >
      <div class="w-full">
        <CodePanel code={ONE_LINER} language="bash" label="Install" />
      </div>
    </CodeExample>

    <CodeExample
      title="Forced on"
      description="Pass `lineNumbers` explicitly to override the threshold in either direction."
      isolate
    >
      <div class="w-full">
        <CodePanel code={ONE_LINER} language="bash" label="Install" lineNumbers={true} />
      </div>
    </CodeExample>

    <CodeExample
      title="Collapsed by default"
      description="Without `expanded`/`onToggle` the panel owns its state; the toolbar toggle opens it."
      isolate
    >
      <div class="w-full">
        <CodePanel code={SAMPLE} language="svelte" label="Counter button" />
      </div>
    </CodeExample>
  </div>
</Section>
