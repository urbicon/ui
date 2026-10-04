<!--
  Die Wortmarke der Doku-Chrome — dieselbe Signatur wie auf der Landing:
  „urbicon" voll, „ui" als Gattung zurückgenommen, dahinter die fünf
  Kanal-Striche in Kachel-Reihenfolge. Text und Farben kommen aus denselben
  Registern wie Namens-Kachel, Kopfleiste und Social-Bild ($lib/landing/wordmark,
  TILE_CHANNEL), damit die Marke nicht in einer zweiten Schreibweise driftet.
  Schriftgrad und Farbe erbt sie vom Ort, an dem sie steht.
-->
<script lang="ts">
  import { CHANNELS, TILE_CHANNEL } from '$lib/landing/channels';
  import { BRAND, BRAND_SUFFIX } from '$lib/landing/wordmark';

  const TICKS = Object.values(TILE_CHANNEL).map((name) => CHANNELS[name].solid);
</script>

<span class="wordmark"
  >{BRAND} <span class="suffix">{BRAND_SUFFIX}</span><span class="ticks" aria-hidden="true"
    >{#each TICKS as color (color)}<span class="tick" style:background={color}></span>{/each}</span
  ></span
>

<style>
  .wordmark {
    font-weight: 800;
    letter-spacing: -0.03em;
    white-space: nowrap;
  }
  .suffix {
    opacity: 0.5;
  }
  /* Ein leerer inline-block sitzt mit seiner Unterkante auf der Grundlinie —
     die Striche stehen damit bündig unter dem Namen. */
  .tick {
    display: inline-block;
    width: 0.42em;
    height: 0.09em;
    margin-left: 0.06em;
    vertical-align: baseline;
  }
</style>
