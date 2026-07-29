<!--
  Rückfallebene des Hero-Inventars.

  Jede der 97 Katalogzeilen hat inzwischen ein geteiltes Beispiel neben ihrer
  `api.ts` — der Hero lädt es lazy. Übrig bleibt hier, was gar keine Komponente
  ist: die Roadmap-Zeile (`Artifacts`, noch nicht ausgeliefert). Für sie zeigt
  der Hero die Achsen, die die Zeile aufspannt, statt einer erfundenen Vorschau.

  Vorher standen an dieser Stelle 51 handgeschriebene Specimen. Sie sind
  weggefallen, als die Playgrounds der Doku-Seiten herauslösbar wurden: Ein
  zweites, eigenständig gepflegtes Beispiel pro Komponente ist genau die
  Dublette, die auf einer Seite über Nicht-Driften nichts zu suchen hat.
-->
<script lang="ts">
  import type { HeroRow } from './hero';

  let { row }: { row: HeroRow } = $props();
</script>

<div class="fallback">
  <dl class="axes">
    {#each row.axes as axis (axis.name)}
      <div>
        <dt>{axis.name}</dt>
        <dd>{axis.count}</dd>
      </div>
    {/each}
  </dl>
  <!--
    Zwei Fälle, die der eine Satz vorher vermischt hat. Eine ausgelieferte
    Komponente ohne Beispiel wäre ein Fehler ("noch nicht verdrahtet"); eine
    Roadmap-Zeile hat keinen, weil es die Sache noch nicht gibt. Für sie war die
    alte Fassung eine Entwickler-Notiz an der Stelle, an der ein Besucher eine
    Auskunft erwartet — direkt unter dem größten Versprechen der Liste.
  -->
  <p class="none">
    {#if row.status === 'in progress'}
      On the roadmap, not in the package — this row has no preview because there is nothing to
      install yet.
    {:else if row.axes.length > 0}
      Variant axes — no live preview wired up in this prototype yet.
    {:else}
      No live preview wired up in this prototype yet.
    {/if}
  </p>
</div>

<style>
  .fallback {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .axes {
    display: flex;
    flex-wrap: wrap;
    gap: 0 2.5rem;
    margin: 0;
  }
  .axes div {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .axes dt {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-quaternary);
  }
  .axes dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-size: 1.5rem;
    font-weight: 300;
    color: var(--color-text-secondary);
  }
  .none {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-quaternary);
  }
</style>
