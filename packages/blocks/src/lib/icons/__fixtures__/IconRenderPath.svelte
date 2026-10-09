<script lang="ts" module>
  /**
   * Every way an Urbicon icon reaches the page. The `override` paths swap
   * `logOut` for `LogInIcon` through an `IconProvider`, so they draw log-in
   * geometry; the others draw log-out.
   */
  export type IconRenderPathName =
    'name' | 'direct' | 'resolveIcon' | 'override-name' | 'override-resolveIcon';
</script>

<script lang="ts">
  import Icon from '../Icon.svelte';
  import IconProvider from '../IconProvider.svelte';
  import type { IconProps } from '../icon-types';
  import LogInIcon from '../LogInIcon.svelte';
  import LogOutIcon from '../LogOutIcon.svelte';
  import ResolveIconProbe from './ResolveIconProbe.svelte';

  let { path, ...iconProps }: IconProps & { path: IconRenderPathName } = $props();
</script>

{#if path === 'name'}
  <Icon name="logOut" {...iconProps} />
{:else if path === 'direct'}
  <LogOutIcon {...iconProps} />
{:else if path === 'resolveIcon'}
  <ResolveIconProbe {...iconProps} />
{:else if path === 'override-name'}
  <IconProvider icons={{ logOut: LogInIcon }}>
    <Icon name="logOut" {...iconProps} />
  </IconProvider>
{:else}
  <IconProvider icons={{ logOut: LogInIcon }}>
    <ResolveIconProbe {...iconProps} />
  </IconProvider>
{/if}
