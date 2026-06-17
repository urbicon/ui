<script lang="ts">
  import type { ThemeSwitcherProps, Theme } from './index';
  import { themeSwitcherVariants } from './themeSwitcher.variants';
  import { onMount } from 'svelte';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import SunIconDefault from '$lib/icons/SunIcon.svelte';
  import MoonIconDefault from '$lib/icons/MoonIcon.svelte';
  import MonitorIconDefault from '$lib/icons/MonitorIcon.svelte';
  import { useBlocksI18n } from '$lib/i18n';

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

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.ThemeSwitcher?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'ThemeSwitcher', preset),
      slotClassesProp
    )
  );

  let mounted = $state(false);

  const styles = $derived(
    unstyled ? undefined : themeSwitcherVariants({ variant, size, disabled })
  );

  function slot(name: 'button' | 'icon') {
    const base = styles?.[name]?.() ?? '';
    const override = slotClasses?.[name] ?? '';
    return override ? `${base} ${override}` : base;
  }

  const resolvedTheme: Theme = $derived.by(() => {
    if (theme !== 'system' || typeof window === 'undefined') return theme;
    if (!mounted) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

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
      if (storageKey) localStorage.setItem(storageKey, 'light');
    } else if (theme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
      if (storageKey) localStorage.setItem(storageKey, 'dark');
    } else {
      root.classList.remove('light', 'dark');
      if (storageKey) localStorage.removeItem(storageKey);
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }

  onMount(() => {
    mounted = true;

    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') {
        theme = saved;
      }
    }
    applyTheme();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') applyTheme();
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
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
  class="{slot('button')} {className}"
  aria-label={label}
  title={label}
  {disabled}
>
  {#if theme === 'light'}
    <SunIcon class={slot('icon')} />
  {:else if theme === 'dark'}
    <MoonIcon class={slot('icon')} />
  {:else}
    <MonitorIcon class={slot('icon')} />
  {/if}
</button>
