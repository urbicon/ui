<!--
  Eine Fallblatt-Zelle: bekommt einen Wert und blättert selbst dorthin.

  Autonom mit Absicht. Die Zelle weiß nicht, wo sie steht — deshalb ist ihr
  egal, ob die Tabelle sie verschiebt, neu erzeugt oder stehen lässt, und
  deshalb lässt sich die echte `Table` darunter verwenden. Der gemeinsame Takt
  liegt im Scheduler; hier ist nur die Reaktion auf den eigenen Wert.

  Barrierefreiheit: Der Text steht einmal am Container, die Zeichenfelder sind
  `aria-hidden`. Ohne das buchstabiert ein Screenreader "S-a-n-k-e-y".
-->
<script lang="ts">
  import { rollCell } from './flap-scheduler';

  interface Props {
    /** Der anzuzeigende Text. Ändert er sich, blättert die Zelle dorthin. */
    value: string;
    /** Feste Feldzahl — die Breite darf nicht am Inhalt hängen. */
    width: number;
    /** Zahlen stehen rechts, damit die Ziffern untereinander fluchten. */
    align?: 'left' | 'right';
  }

  let { value, width, align = 'left' }: Props = $props();

  let host = $state<HTMLElement>();

  const padded = $derived(align === 'right' ? value.padStart(width) : value.padEnd(width));

  $effect(() => {
    // `padded` lesen, damit der Effect daran hängt.
    const target = padded;
    if (!host) return;
    rollCell(host, [...host.children] as HTMLElement[], target);
  });
</script>

<span class="flap-cell" class:num={align === 'right'} bind:this={host} aria-label={value}>
  {#each { length: width } as _, k (k)}
    <span class="ch blank" aria-hidden="true" data-ch=" ">&nbsp;</span>
  {/each}
</span>

<style>
  .flap-cell {
    display: inline-flex;
    gap: 1px;
  }
  .flap-cell.num {
    justify-content: flex-end;
  }

  /* Ein Zeichen = ein Flap. Obere Hälfte fängt Licht, in der Mitte die Kante,
     darunter die abgewandte Fläche — drei Werte statt eines Kastens. Die Kante
     ist bewusst schwach: Bei stärkerem Kontrast verbinden sich die Kanten aller
     Zellen zu einem Band quer durch die Zeile, und die Zeile zerfällt optisch
     in zwei Streifen. */
  .ch {
    width: 1ch;
    display: grid;
    place-items: center;
    font-family: var(--flap-font);
    font-stretch: var(--flap-stretch);
    font-size: var(--flap-size);
    line-height: 1;
    height: 20px;
    background: linear-gradient(
      to bottom,
      var(--flap-hi) 0%,
      var(--flap-hi) calc(50% - 0.5px),
      var(--seam) 50%,
      var(--flap) calc(50% + 0.5px),
      var(--flap) 100%
    );
    border-radius: 1.5px;
    overflow: hidden;
    color: var(--bone);
  }
  /* Leerstellen bleiben Blätter — ein Board hat auch dort eine Klappe, wo
     nichts steht. Nur unbeschriftet. */
  .ch.blank {
    opacity: 0.55;
  }
  /* `:global(.rolling)`, weil die Klasse nur zur Laufzeit vom Scheduler gesetzt
     wird und im Markup nicht vorkommt — Svelte würde die Regel sonst als
     ungenutzt entfernen. Das `.ch` davor hält das Scoping. */
  .ch:global(.rolling) {
    color: #cfcabb;
    will-change: transform;
  }
</style>
