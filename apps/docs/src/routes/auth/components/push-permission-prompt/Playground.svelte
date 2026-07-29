<!--
  PushPermissionPrompt-Playground — reglerlos.

  Die Auth-Familie hat keine Varianten, sondern API-Pfade und Callbacks; es gibt
  also nichts zu drehen. Der Configurator trägt hier trotzdem, weil sein zweiter
  Teil fehlte: das Code-Panel. Ohne ihn zeigte der Landing-Hero für diese Zeile
  nur die Import-Zeile — ein fertiges Panel, und kein Hinweis, wie man es aufruft.

  Bühne und Schnipsel sind dieselbe Datei: `Basic.svelte` läuft ohne Backend,
  also gibt es hier keine gemockte Zweitfassung. `codeGenerator` druckt sie
  wörtlich, statt einen Schnipsel aus Regler-Werten zu erzeugen, die es hier
  nicht gibt.

  Konsument ist vorerst nur der Landing-Hero: Die Doku-Seite zeigt dasselbe
  Beispielpaar weiterhin über ihr `CodeExample`. Beide greifen auf dieselben
  zwei Dateien zu, es gibt also nichts, was auseinanderlaufen könnte — die
  Seite auf diesen Playground umzustellen wäre eine Konsolidierung, keine
  Korrektur. Signatur: `$lib/playground-host.ts`.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { PlaygroundConfigurator } from '@urbicon-ui/docs';
  import Basic from './examples/Basic.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();
</script>

<PlaygroundConfigurator
  componentName="PushPermissionPrompt"
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  codeGenerator={() => basicCode}
>
  {#snippet children()}
    <div class="mx-auto w-full max-w-xl">
      <Basic />
    </div>
  {/snippet}
</PlaygroundConfigurator>
