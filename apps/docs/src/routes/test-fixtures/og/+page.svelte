<!--
  Die Vorlage für `static/og.png` — das Social-Bild in seinen festen 1200 × 630.

  Es ist die Namens-Kachel der Landing, quergelegt: dieselben Wörter (aus
  `$lib/landing/wordmark`), dieselbe Signatur (aus `TILE_CHANNEL`, in der
  Reihenfolge der Kacheln), dieselbe Ink-Fläche. Eigenes Layout, weil das
  Format ein anderes ist — die Kachel steht hochkant in einem Raster, das Bild
  liegt quer und allein.

  Warum eine Fixture-Route und kein handgeschriebenes HTML daneben: so rendert
  das Bild mit den echten Schriften und den echten Kanalfarben der Seite. Die
  vorige og.png war von Hand gebaut und stand am Ende auf einem Anspruch, den
  die Landing seit Monaten nicht mehr erhob.

  Aufgenommen wird die `.card` als Element-Screenshot:
      bun run shots
-->
<script lang="ts">
  import { CHANNELS, TILE_CHANNEL } from '$lib/landing/channels';
  import {
    BRAND,
    BRAND_SUFFIX,
    CLAIM_LEAD,
    CLAIM_POINT,
    EYEBROW,
    PROOF
  } from '$lib/landing/wordmark';
  import { SITE_URL } from '$lib/seo';

  const TICKS = Object.values(TILE_CHANNEL).map((name) => CHANNELS[name].solid);
  const HOST = SITE_URL.replace(/^https?:\/\//, '');
</script>

<div class="card" data-og-card>
  <p class="eyebrow">{EYEBROW}</p>

  <div class="mid">
    <p class="brand">
      {BRAND} <span class="brand-suffix">{BRAND_SUFFIX}</span><span class="ticks"
        >{#each TICKS as solid, i (i)}<span class="tick" style:background={solid}
          ></span>{/each}</span
      >
    </p>
    <p class="claim">{CLAIM_LEAD} <strong>{CLAIM_POINT}</strong></p>
  </div>

  <p class="foot">
    <span>{PROOF}</span>
    <span class="host">{HOST}</span>
  </p>
</div>

<style>
  /* Feste Pixelmaße statt der `clamp()`-Skala der Kachel: ein Social-Bild hat
     genau eine Größe, und in ihr sollen die Proportionen sitzen.

     `fixed` in der Ecke, weil Playwright den Element-Screenshot aus dem
     Fensterbild schneidet: was über der Karte liegt, liegt mit im Bild. Die
     Doku-Chrome ist hier abgeschaltet (`isLanding` im Root-Layout), der
     globale Skip-Link bleibt — er startet unsichtbar oben links, also genau
     dort, wo die Karte anfängt. */
  .card {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 999;
    width: 1200px;
    height: 630px;
    box-sizing: border-box;
    padding: 72px;
    display: flex;
    flex-direction: column;
    background: #141414;
    color: #f4f4f2;
    font-family: 'Schibsted Grotesk Variable', system-ui, sans-serif;
  }
  .eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 19px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    opacity: 0.6;
  }
  .mid {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .brand {
    font-size: 92px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  .brand-suffix {
    opacity: 0.5;
  }
  .ticks {
    white-space: nowrap;
  }
  .tick {
    display: inline-block;
    width: 0.42em;
    height: 0.09em;
    margin-left: 0.06em;
    /* Wie auf der Kachel: ein leerer inline-block sitzt mit seiner Unterkante
       auf der Baseline — dort bündeln sich Signatur und Name. */
    vertical-align: baseline;
  }
  .claim {
    margin-top: 18px;
    font-size: 76px;
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.025em;
    color: #8f8f88;
  }
  .claim strong {
    font-weight: inherit;
    color: #f4f4f2;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 21px;
    opacity: 0.65;
  }
  .host {
    opacity: 0.8;
  }
</style>
