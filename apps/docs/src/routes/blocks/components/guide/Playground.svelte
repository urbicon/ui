<!--
  Guide playground — lifted out of the doc page's live example so two pages can
  show it: the doc page and the landing hero. See `$lib/playground-host.ts`.

  The controls come from `guide-panel/api.ts`, not this file's own: the Guide
  family has nine surfaces, but only one is steerable in the example — the panel.
  The rest (Marker, Mention, Provider) is wiring, not a knob.
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

  // One controller carries the whole example — created once, shared through
  // context. `dev: false` keeps the console quiet; the example remembers
  // nothing (the "seen" status is never stored).
  const demoGuide = new GuideController({ dev: false });

  const controls = deriveControls(panelData, {
    pick: ['title', 'placement', 'size', 'searchable'],
    overrides: {
      // The default is an i18n key, not a literal — the example uses a plain title.
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
      <!-- `w-full` on the outside: the preview area centers its content; without
           it the card would collapse to its content width and the
           `justify-between` rows would stick together. -->
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
          The second article is the target of the `GuideRef`, and it makes the
          `pg-seats` mention above resolve (before it pointed at nothing).
          `GuideRef` links *within* the panel (article → article); `GuideMention`
          connects the UI to the panel: the two directions the Guide system is built on.
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
