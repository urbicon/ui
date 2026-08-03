<!--
  SidebarLayout-Playground — neu, damit ihn zwei Seiten zeigen können: die
  Doku-Seite und der Landing-Hero. Siehe `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.

  Warum die Overrides unten: SidebarLayout ist eine Seiten-Hülle — `min-h-screen`
  auf Wurzel und Hauptspalte, die eingebettete Sidebar `position: fixed`. In
  einer Vorschaufläche würde beides ausbrechen. Die vier Overrides binden es an
  den Rahmen, über die dokumentierte `slotClasses`-API der Komponente (die
  Sidebar-Slots werden von SidebarLayout durchgereicht) — kein Nachbau, dieselbe
  Komponente, die auch diese Doku-Seite trägt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { MenuIcon, SidebarLayout } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let open = $state(false);

  const NAV = ['Dashboard', 'Projects', 'Team', 'Settings'];

  const CONTAINED = {
    root: '!min-h-full !rounded-xl',
    main: '!min-h-full',
    sidebar: '!absolute',
    sidebarBackdrop: '!absolute'
  };

  const controls = deriveControls(componentData, {
    pick: ['side', 'mode', 'sidebarWidth', 'contentMaxWidth'],
    overrides: {
      // Die Vorschaufläche ist schmaler als ein Viewport; 16rem (der Default der
      // Komponente) ließe für den Inhalt nichts übrig.
      sidebarWidth: { label: 'Sidebar Width', defaultValue: '11rem' },
      contentMaxWidth: { label: 'Content Max Width' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="SidebarLayout"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { SidebarLayout } from '@urbicon-ui/blocks';"],
    state: { open: false },
    consts: { NAV },
    twoWay: ['open']
  }}
>
  {#snippet children(values)}
    <div
      class="border-border-subtle relative h-80 w-full overflow-hidden rounded-xl border"
      data-playground-frame="sidebar-layout"
    >
      <SidebarLayout
        bind:open
        side={values.side}
        mode={values.mode}
        sidebarWidth={values.sidebarWidth}
        contentMaxWidth={values.contentMaxWidth}
        slotClasses={CONTAINED}
      >
        {#snippet sidebarHeader()}
          <div class="text-text-primary px-4 py-3 text-sm font-semibold">Acme</div>
        {/snippet}

        {#snippet sidebar()}
          <nav class="space-y-1 p-3">
            {#each NAV as item, i (item)}
              <a
                href="#{item.toLowerCase()}"
                class={[
                  'block rounded-lg px-3 py-2 text-sm transition-colors',
                  i === 0
                    ? 'bg-surface-subtle text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                ]}
              >
                {item}
              </a>
            {/each}
          </nav>
        {/snippet}

        {#snippet mobileHeader({ openSidebar })}
          <button
            class="text-text-secondary hover:text-text-primary -m-2 p-2 transition-colors"
            onclick={openSidebar}
            aria-label="Open navigation"
          >
            <MenuIcon class="h-5 w-5" />
          </button>
          <span class="text-text-primary text-sm font-semibold">Acme</span>
        {/snippet}

        <p class="text-text-primary text-lg font-semibold">Dashboard</p>
        <p class="text-text-secondary mt-2 text-sm leading-relaxed">
          The main column offsets itself against <code>--sidebar-effective-width</code>, so the
          content never sits underneath the rail. Below 1024px the rail becomes an overlay and this
          column reflows to full width.
        </p>
        <!-- `collapsible` blendet die Leiste auf allen Viewports aus; ohne einen
             Öffner im Inhalt wäre der Modus in der Vorschau eine Sackgasse. -->
        {#if values.mode === 'collapsible' && !open}
          <button class="text-primary mt-4 text-sm hover:underline" onclick={() => (open = true)}>
            Show sidebar
          </button>
        {/if}
      </SidebarLayout>
    </div>
  {/snippet}
</PlaygroundConfigurator>
