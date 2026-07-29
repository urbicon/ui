<!--
  Guide-Playground — aus dem Live-Beispiel der Doku-Seite herausgelöst, damit
  ihn zwei Seiten zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Regler kommen aus `guide-panel/api.ts`, nicht aus der eigenen: Die Guide-
  Familie hat neun Oberflächen, aber nur eine davon ist im Beispiel sichtbar
  steuerbar — das Panel. Der Rest (Marker, Mention, Provider) ist Verdrahtung,
  keine Stellschraube.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import {
    GuideArticle,
    GuideController,
    GuideMarker,
    GuideMention,
    GuidePanel,
    GuideProvider,
    GuideRef
  } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData as panelData } from '../guide-panel/api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(panelData?.props ?? []);

  // Ein Controller trägt das ganze Beispiel — einmal erzeugt, über den Kontext
  // geteilt. `dev: false` hält die Konsole ruhig; das Beispiel merkt sich
  // nichts ("seen"-Status bleibt ungespeichert).
  const demoGuide = new GuideController({ dev: false });

  const controls = deriveControls(panelData, {
    pick: ['title', 'placement', 'size', 'searchable'],
    overrides: {
      // Der Default ist ein i18n-Schlüssel, kein Literal — im Beispiel steht
      // ein sprechender Titel.
      title: { defaultValue: 'Help' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="GuidePanel"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
>
  {#snippet children(values)}
    <GuideProvider controller={demoGuide}>
      <!-- `w-full` außen: Die Vorschaufläche zentriert ihren Inhalt, ohne sie
           fiele die Karte auf ihre Inhaltsbreite zusammen und die
           `justify-between`-Zeilen kleben aneinander. -->
      <div
        class="border-border-subtle bg-surface-elevated mx-auto w-full max-w-md rounded-2xl border p-6"
      >
        <div class="mb-4 flex items-center gap-1.5">
          <h3 class="text-text-primary text-base font-semibold">Billing</h3>
          <GuideMarker for="pg-plan" />
        </div>
        <dl class="space-y-2.5 text-sm">
          <div
            data-guide="pg-plan"
            class="border-border-subtle flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <dt class="text-text-tertiary">Plan</dt>
            <dd class="text-text-primary font-medium">Pro — $29/mo</dd>
          </div>
          <div
            data-guide="pg-seats"
            class="border-border-subtle flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <dt class="text-text-tertiary">Seats</dt>
            <dd class="text-text-primary font-medium">5 of 10 used</dd>
          </div>
        </dl>
      </div>

      <GuidePanel
        title={String(values.title ?? 'Help')}
        placement={values.placement}
        size={values.size}
        searchable={values.searchable}
      >
        <GuideArticle id="pg-plan" title="Billing & plans">
          <p>
            Your <GuideMention for="pg-plan">current plan</GuideMention> sets your monthly price and feature
            limits. Upgrade or downgrade at any time.
          </p>
          <p>
            Each <GuideMention for="pg-seats">seat</GuideMention> is one team member who can sign in.
            You are billed per occupied seat — see
            <GuideRef article="pg-seats">managing seats</GuideRef>.
          </p>
        </GuideArticle>
        <!--
          Der zweite Artikel ist das Ziel des `GuideRef` — und er macht die
          `pg-seats`-Mention oben erst gültig, die vorher ins Leere zeigte.
          `GuideRef` verlinkt *innerhalb* des Panels (Artikel → Artikel),
          `GuideMention` verbindet die UI mit dem Panel: die zwei Richtungen,
          die das Guide-System ausmachen.
        -->
        <GuideArticle id="pg-seats" title="Managing seats">
          <p>
            A seat frees up as soon as you remove a member. Billing follows on the next cycle, so
            removing someone mid-month does not refund the current one.
          </p>
          <p>
            Pricing per seat depends on your
            <GuideRef article="pg-plan">billing plan</GuideRef>.
          </p>
        </GuideArticle>
      </GuidePanel>
    </GuideProvider>
  {/snippet}
</PlaygroundConfigurator>
