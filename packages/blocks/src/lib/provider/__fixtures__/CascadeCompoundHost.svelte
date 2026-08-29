<script lang="ts">
  import type { Component } from 'svelte';
  import Accordion from '$lib/primitives/Accordion/Accordion.svelte';
  import RadioGroup from '$lib/primitives/RadioGroup/RadioGroup.svelte';
  import SegmentGroup from '$lib/primitives/SegmentGroup/SegmentGroup.svelte';
  import Stepper from '$lib/primitives/Stepper/Stepper.svelte';
  import Tab from '$lib/primitives/Tab/Tab.svelte';
  import GuideProvider from '$lib/components/Guide/GuideProvider.svelte';
  import Calendar from '$lib/components/Calendar/Calendar.svelte';
  import GuidePanel from '$lib/components/Guide/GuidePanel.svelte';
  import GuideArticle from '$lib/components/Guide/GuideArticle.svelte';
  import { GuideController } from '$lib/utils/guide.svelte';
  import BlocksProvider from '../BlocksProvider.svelte';
  import type { ComponentDefaults } from '../blocks-context';
  import type { CompoundFamily } from './cascade-mount-props';

  // A compound child reads its parent through context and throws without one,
  // so the sweep cannot mount it on its own. One parent per family; the child
  // itself stays the component under measurement and keeps its own props.
  let {
    family,
    component,
    props = {},
    unstyled = false,
    defaults = {}
  }: {
    family: CompoundFamily;
    component: Component<Record<string, unknown>>;
    props?: Record<string, unknown>;
    unstyled?: boolean;
    defaults?: Record<string, ComponentDefaults>;
  } = $props();

  const Child = $derived(component);

  // GuidePanel's children render against a controller that has navigated to an
  // article; without that, GuideArticle renders nothing and GuideRef degrades
  // to plain text with no class to measure.
  const ARTICLE_ID = 'cascade-article';
  const guideController = new GuideController();
  guideController.openPanel(ARTICLE_ID);
</script>

{#snippet panelsSnippet()}<Child {...props} />{/snippet}

<BlocksProvider {unstyled} {defaults}>
  {#if family === 'accordion'}
    <Accordion><Child {...props} /></Accordion>
  {:else if family === 'radioGroup'}
    <RadioGroup><Child {...props} /></RadioGroup>
  {:else if family === 'segmentGroup'}
    <SegmentGroup><Child {...props} /></SegmentGroup>
  {:else if family === 'stepper'}
    <Stepper><Child {...props} /></Stepper>
  {:else if family === 'tabStrip'}
    <Tab>
      {#snippet tabs()}<Child {...props} />{/snippet}
    </Tab>
  {:else if family === 'tabPanels'}
    <Tab value="a" panels={panelsSnippet}>
      {#snippet tabs()}<span>strip</span>{/snippet}
    </Tab>
  {:else if family === 'guide'}
    <GuideProvider><Child {...props} /></GuideProvider>
  {:else if family === 'guidePanel'}
    <GuideProvider controller={guideController}>
      <GuidePanel>
        <GuideArticle id={ARTICLE_ID} title="Cascade">body</GuideArticle>
        <Child {...props} />
      </GuidePanel>
    </GuideProvider>
  {:else if family === 'calendar'}
    <Calendar>
      {#snippet header()}<Child {...props} />{/snippet}
    </Calendar>
  {/if}
</BlocksProvider>
