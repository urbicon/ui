<script lang="ts">
  // Test-only composition harness for the restProps contract of the Guide surfaces. Every
  // surface reads the GuideProvider controller through context, and GuideArticle/GuideRef
  // also need a GuidePanel, so one mount carries all of them, each with its own props
  // passed through. Under __fixtures__/ so it is excluded from the published package and
  // never collected as a test file. Not exported from the barrel.
  import type { GuideController } from '#lib/utils/index.js';
  import GuideArticle from '../GuideArticle.svelte';
  import GuideBeacon from '../GuideBeacon.svelte';
  import GuideHint from '../GuideHint.svelte';
  import GuideMarker from '../GuideMarker.svelte';
  import GuideMention from '../GuideMention.svelte';
  import GuidePanel from '../GuidePanel.svelte';
  import GuideProvider from '../GuideProvider.svelte';
  import GuideRef from '../GuideRef.svelte';
  import type {
    GuideArticleProps,
    GuideBeaconProps,
    GuideHintProps,
    GuideMarkerProps,
    GuideMentionProps,
    GuidePanelProps,
    GuideRefProps
  } from '../index';

  let {
    controller,
    panelProps = {},
    articleProps = {},
    refProps = {},
    mentionProps = {},
    hintProps = {},
    beaconProps = {},
    markerProps = {}
  }: {
    controller: GuideController;
    panelProps?: Partial<GuidePanelProps>;
    articleProps?: Partial<GuideArticleProps>;
    refProps?: Partial<GuideRefProps>;
    mentionProps?: Partial<GuideMentionProps>;
    hintProps?: Partial<GuideHintProps>;
    beaconProps?: Partial<GuideBeaconProps>;
    markerProps?: Partial<GuideMarkerProps>;
  } = $props();
</script>

<div data-guide="save">save target</div>

<GuideProvider {controller}>
  <GuideBeacon {...beaconProps} />
  <GuideMarker for="save" article="a" {...markerProps} />
  <GuideHint for="save" {...hintProps}>Hint body</GuideHint>
  <GuidePanel {...panelProps}>
    <GuideArticle id="a" title="Article A" {...articleProps}>Article body</GuideArticle>
    <GuideRef article="a" {...refProps}>ref text</GuideRef>
    <GuideMention for="save" {...mentionProps}>mention text</GuideMention>
  </GuidePanel>
</GuideProvider>
