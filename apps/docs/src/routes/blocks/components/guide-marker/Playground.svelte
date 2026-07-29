<!--
  GuideMarker teilt sich das Beispiel mit der Guide-Familie.

  Die neun Guide-Oberflächen sind ein System, kein Baukasten einzeln nutzbarer
  Teile — deshalb hat die Doku für alle eine Seite (`/blocks/components/guide`)
  und dieses Verzeichnis nur die generierte `api.ts` für Katalog und llm.txt.
  Die Datei hier ist der Zeiger, über den der Landing-Hero (der jede
  `Playground.svelte` per Glob einsammelt) beim Klick auf GuideMarker dasselbe
  Beispiel findet, das die Doku-Seite zeigt — statt einer erfundenen Vorschau
  oder gar keiner.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import GuidePlayground from '../guide/Playground.svelte';

  let props: PlaygroundHostProps = $props();
</script>

<GuidePlayground {...props} />
