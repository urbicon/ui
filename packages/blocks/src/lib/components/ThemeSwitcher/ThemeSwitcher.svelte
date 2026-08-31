<script lang="ts">
  import type { ThemeSwitcherProps, Theme } from './index';
  import { themeSwitcherVariants, type ThemeSwitcherVariants } from './themeSwitcher.variants';
  import { onMount } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import SunIconDefault from '$lib/icons/SunIcon.svelte';
  import MoonIconDefault from '$lib/icons/MoonIcon.svelte';
  import MonitorIconDefault from '$lib/icons/MonitorIcon.svelte';
  import { useBlocksI18n } from '$lib/i18n';
  import { getStorage } from '$lib/internal/storage';

  const bt = useBlocksI18n();

  const SunIcon = resolveIcon('sun', SunIconDefault);
  const MoonIcon = resolveIcon('moon', MoonIconDefault);
  const MonitorIcon = resolveIcon('monitor', MonitorIconDefault);

  let {
    theme = $bindable('system'),
    strategy = 'cycle',
    storageKey = 'urbicon-theme',
    onThemeChange,
    variant = 'ghost',
    size = 'md',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    disabled = false
  }: ThemeSwitcherProps = $props();

  // One handle for the component's lifetime, the way `createPersistentState`
  // takes one at construction: `getStorage` re-reads and re-checks the ambient
  // object on every call, and a mount asks it four times otherwise.
  const storage = getStorage('localStorage');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Reactive, SSR-safe `prefers-color-scheme` reader (svelte/reactivity) —
  // re-evaluates `resolvedTheme` on OS changes without a manual listener.
  const prefersDark = new MediaQuery('(prefers-color-scheme: dark)');

  const variantProps: ThemeSwitcherVariants = $derived({ variant, size, disabled });

  const styles = $derived(themeSwitcherVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ThemeSwitcher', preset, variantProps, slotClassesProp)
  );

  const resolvedTheme: Theme = $derived(
    theme === 'system' ? (prefersDark.current ? 'dark' : 'light') : theme
  );

  const label = $derived(
    theme === 'light'
      ? bt('themeSwitcher.lightMode')
      : theme === 'dark'
        ? bt('themeSwitcher.darkMode')
        : bt('themeSwitcher.systemTheme')
  );

  function setTheme(next: Theme) {
    theme = next;
    applyTheme();
    onThemeChange?.(next);
  }

  function cycle() {
    if (strategy === 'toggle') {
      setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
    } else {
      const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
      setTheme(next);
    }
  }

  function applyTheme() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      if (storageKey) storage?.setItem(storageKey, 'light');
    } else if (theme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
      if (storageKey) storage?.setItem(storageKey, 'dark');
    } else {
      // System: drop both overrides and let `:root { color-scheme: light dark }`
      // resolve `light-dark()` against the OS preference natively — this keeps
      // following OS changes live, on every page, without a JS listener.
      root.classList.remove('light', 'dark');
      if (storageKey) storage?.removeItem(storageKey);
    }
  }

  onMount(() => {
    if (storageKey) {
      const saved = storage?.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') {
        theme = saved;
      }
    }
    applyTheme();
  });

  export function getTheme(): Theme {
    return theme;
  }

  export function getResolvedTheme(): Theme {
    return resolvedTheme;
  }
</script>

<button
  type="button"
  onclick={cycle}
  class={unstyled
    ? [slotClasses?.button, className].filter(Boolean).join(' ')
    : styles.button({ class: [slotClasses?.button, className] })}
  aria-label={label}
  title={label}
  {disabled}
>
  {#if theme === 'light'}
    <SunIcon
      class={unstyled ? (slotClasses?.icon ?? '') : styles.icon({ class: slotClasses?.icon })}
    />
  {:else if theme === 'dark'}
    <MoonIcon
      class={unstyled ? (slotClasses?.icon ?? '') : styles.icon({ class: slotClasses?.icon })}
    />
  {:else}
    <MonitorIcon
      class={unstyled ? (slotClasses?.icon ?? '') : styles.icon({ class: slotClasses?.icon })}
    />
  {/if}
</button>
