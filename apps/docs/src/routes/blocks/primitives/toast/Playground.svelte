<!--
  Toaster-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Toaster, toaster, Button } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  function intentMethod(intent: string) {
    if (intent === 'primary') return 'info';
    return intent;
  }

  function generateCode(v: Record<string, unknown>) {
    const method = intentMethod(String(v.intent));
    const opts: string[] = [];
    if (v.description) opts.push(`description: '${v.description}'`);
    if (v.duration !== 5000) opts.push(`duration: ${v.duration}`);
    if (!v.dismissible) opts.push('dismissible: false');
    if (!v.showProgress) opts.push('showProgress: false');
    const optsStr = opts.length ? `, { ${opts.join(', ')} }` : '';
    return `toaster.${method}('${v.title}'${optsStr});`;
  }

  const controls = deriveControls(componentData, {
    pick: ['placement', 'intent'],
    overrides: {
      intent: { defaultValue: 'success' }
    },
    extra: [
      {
        type: 'text',
        key: 'title',
        label: 'Title',
        defaultValue: 'Changes saved',
        group: 'Toast Options'
      },
      {
        type: 'text',
        key: 'description',
        label: 'Description',
        defaultValue: 'Your settings have been updated.',
        group: 'Toast Options'
      },
      {
        type: 'slider',
        key: 'duration',
        label: 'Duration (ms)',
        min: 0,
        max: 10000,
        step: 500,
        defaultValue: 5000,
        group: 'Toast Options'
      },
      {
        type: 'checkbox',
        key: 'dismissible',
        label: 'Dismissible',
        defaultValue: true,
        group: 'Toast Options'
      },
      {
        type: 'checkbox',
        key: 'showProgress',
        label: 'Show Progress',
        defaultValue: true,
        group: 'Toast Options'
      }
    ]
  });
</script>

<PlaygroundConfigurator
  componentName="Toaster"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeGenerator={generateCode}
>
  {#snippet children(values)}
    <!--
      Der Playground bringt seinen Host selbst mit. Vorher stand der `<Toaster />`
      auf der Doku-Seite: dort funktionierte der Knopf, im Landing-Hero fiel er
      ins Leere („toaster.add() was called but no <Toaster /> is mounted") — und
      der `placement`-Regler wirkte nirgends, weil die Seite ihren eigenen
      `placement`-Zustand hielt. Am Playground montiert, reist der Host mit ihm
      an jede Einbettung, und der Regler steuert, was er beschriftet.
      `position: fixed` heißt: kein Platz auf der Bühne, keine Latch-Wirkung.
    -->
    <Toaster placement={values.placement} />
    <Button
      intent={values.intent === 'neutral' ? 'neutral' : values.intent}
      variant="filled"
      onclick={() =>
        toaster.add({
          intent: values.intent,
          title: values.title,
          description: values.description,
          duration: values.duration,
          dismissible: values.dismissible,
          showProgress: values.showProgress
        })}
    >
      Show Toast
    </Button>
  {/snippet}
</PlaygroundConfigurator>
