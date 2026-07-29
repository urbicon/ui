<!--
  InvitationManager-Playground — reglerlos.

  Die Auth-Familie hat keine Varianten, sondern API-Pfade und Callbacks; es gibt
  also nichts zu drehen. Der Configurator trägt hier trotzdem, weil sein zweiter
  Teil fehlte: das Code-Panel. Ohne ihn zeigte der Landing-Hero für diese Zeile
  nur die Import-Zeile — ein fertiges Panel, und kein Hinweis, wie man es aufruft.

  Bühne und Schnipsel sind bewusst zwei Fassungen desselben Beispiels: Die
  Vorschau läuft gegen eine gemockte Demo-API (`BasicDemo`), der abgedruckte
  Quelltext ist die Produktionsfassung (`Basic.svelte`) — dieselbe Trennung, die
  die Doku-Seite schon beschreibt. `codeGenerator` druckt sie wörtlich, statt sie
  aus Regler-Werten zu erzeugen, die es hier nicht gibt.

  Konsument ist vorerst nur der Landing-Hero: Die Doku-Seite zeigt dasselbe
  Beispielpaar weiterhin über ihr `CodeExample`. Beide greifen auf dieselben
  zwei Dateien zu, es gibt also nichts, was auseinanderlaufen könnte — die
  Seite auf diesen Playground umzustellen wäre eine Konsolidierung, keine
  Korrektur. Signatur: `$lib/playground-host.ts`.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { PlaygroundConfigurator } from '@urbicon-ui/docs';
  import BasicDemo from './examples/BasicDemo.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();
</script>

<PlaygroundConfigurator
  componentName="InvitationManager"
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  codeGenerator={() => basicCode}
>
  {#snippet children()}
    <div class="mx-auto w-full max-w-2xl">
      <BasicDemo />
    </div>
  {/snippet}
</PlaygroundConfigurator>
