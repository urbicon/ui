<script lang="ts">
  import { GuideController } from '$lib/utils';
  import type { GuideProviderProps } from './index';
  import { setGuideContext } from './guide.context';

  let { storage, navigate, controller, children }: GuideProviderProps = $props();

  // Use a consumer-supplied controller (for programmatic access from outside the provider)
  // or create one. Built once from the initial props — a stable controller/adapter is
  // expected, so later prop changes are intentionally ignored. SSR-safe: the default
  // adapter only touches localStorage inside load/save. `storage`/`navigate` are ignored
  // when a `controller` is supplied (it already carries them).
  // svelte-ignore state_referenced_locally
  const instance = controller ?? new GuideController({ storage, navigate });
  setGuideContext(instance);
</script>

{@render children()}
