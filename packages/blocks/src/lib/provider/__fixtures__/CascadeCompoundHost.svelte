<script lang="ts">
  import { untrack, type Component } from 'svelte';
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
  //
  // `data-cascade-scope` is how the sweep finds the child's own outermost
  // element inside the parent's markup. It has to be a wrapper element rather
  // than an attribute on the child, because a rest-props attribute lands
  // wherever the component spreads its rest props — on RadioItem's <input>,
  // for one, which is not its root. Context is component-tree scoped, so the
  // extra element changes nothing the children can observe.
  let {
    family,
    component,
    props = {},
    tour = false,
    unstyled = false,
    defaults = {}
  }: {
    family: CompoundFamily;
    component: Component<Record<string, unknown>>;
    props?: Record<string, unknown>;
    tour?: boolean;
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

  // `Guide` renders the bubble, its step dots and the progress row only
  // mid-tour, and without one it reached a single slot of thirty-one. Two
  // steps, because one dot cannot be both the active and an inactive marker —
  // which is the pairing `dot`/`dotActive` share an element for. The fixture
  // asks for it rather than this file deciding, so the necessity assertion can
  // drop it on its own.
  //
  // Built once, not in a `$derived`: `startTour` registers on the overlay
  // stack, and mutating state inside a derived is `state_unsafe_mutation`.
  // `untrack` states that reading the initial value is the intent — `tour`
  // never changes for the life of a mount, so there is nothing to react to.
  const tourController = untrack(() => tour) ? new GuideController() : undefined;
  tourController?.startTour({
    id: 'cascade-tour',
    steps: [
      { title: 'One', body: 'a' },
      { title: 'Two', body: 'b' }
    ]
  });
</script>

{#snippet scoped()}
  <span data-cascade-scope style="display: contents"><Child {...props} /></span>
{/snippet}

<BlocksProvider {unstyled} {defaults}>
  {#if family === 'accordion'}
    <!-- Open, matching the child's own `value`. A closed item never renders
         the classes its open state carries (`rotate-180` on the chevron), so
         the sweep would measure a state with nothing to contest — measured:
         with the item closed, reverting the chevron fix leaves route D green. -->
    <Accordion value={['a']}>{@render scoped()}</Accordion>
  {:else if family === 'radioGroup'}
    <RadioGroup>{@render scoped()}</RadioGroup>
  {:else if family === 'segmentGroup'}
    <SegmentGroup>{@render scoped()}</SegmentGroup>
  {:else if family === 'stepper'}
    <Stepper>{@render scoped()}</Stepper>
  {:else if family === 'tabStrip'}
    <Tab>
      {#snippet tabs()}{@render scoped()}{/snippet}
    </Tab>
  {:else if family === 'tabPanels'}
    <Tab value="a" panels={scoped}>
      {#snippet tabs()}<span>strip</span>{/snippet}
    </Tab>
  {:else if family === 'guide'}
    <!-- `controller` undefined without the `tour` fixture: GuideProvider builds its own. -->
    <GuideProvider controller={tourController}>{@render scoped()}</GuideProvider>
  {:else if family === 'guidePanel'}
    <GuideProvider controller={guideController}>
      <GuidePanel>
        <GuideArticle id={ARTICLE_ID} title="Cascade">body</GuideArticle>
        {@render scoped()}
      </GuidePanel>
    </GuideProvider>
  {:else if family === 'calendar'}
    <Calendar>
      {#snippet header()}{@render scoped()}{/snippet}
    </Calendar>
  {/if}
</BlocksProvider>
