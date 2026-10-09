<script lang="ts">
  // Test-only composition harness for Guide — the tour renderer reads its
  // controller from GuideProvider's context, so the test mounts the pair. Under
  // __fixtures__/ so it is excluded from the published package and never
  // collected as a test file. Not exported from the barrel.
  import type { GuideController } from '#lib/utils/index.js';
  import Guide from '../Guide.svelte';
  import GuideProvider from '../GuideProvider.svelte';
  import type { GuideProps } from '../index';

  let {
    controller,
    guideProps = {}
  }: {
    controller: GuideController;
    guideProps?: GuideProps;
  } = $props();
</script>

<GuideProvider {controller}>
  <Guide {...guideProps} />
</GuideProvider>
