<script lang="ts">
  import { Alert, Badge, Button, Separator, Spinner } from '@urbicon-ui/blocks';
  import { onMount } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import { errorTextFromBody } from '../../utils/http.js';
  import type { SessionManagerProps } from './index.js';
  import { slotClass } from '../../utils/slot-class.js';

  let {
    t: tProp,
    basePath = '/api/auth/sessions',
    csrf,
    fetcher,
    unstyled = false,
    slotClasses = {},
    class: className
  }: SessionManagerProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  const doFetch: typeof globalThis.fetch = (input, init) =>
    fetcher ? fetcher(input, init) : fetch(input, init);

  interface SessionRow {
    id: string;
    userAgent: string | null;
    ip: string | null;
    lastActive: string;
    current: boolean;
  }

  let sessions = $state<SessionRow[]>([]);
  let available = $state(true);
  let loading = $state(true);
  let error = $state('');
  let revokingId = $state<string | null>(null);
  let revokingOthers = $state(false);

  async function loadSessions() {
    loading = true;
    error = '';
    try {
      const res = await doFetch(basePath);
      if (!res.ok) {
        error = t.common.error;
        return;
      }
      const data = await res.json();
      sessions = data.sessions ?? [];
      available = data.available !== false;
    } catch {
      // Surface the failure rather than rendering an empty list that looks like
      // "no other sessions".
      error = t.auth.errors.networkError;
    } finally {
      loading = false;
    }
  }

  async function revokeSession(id: string) {
    error = '';
    revokingId = id;
    try {
      const res = await csrfFetch(
        `${basePath}/revoke`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        },
        csrf,
        fetcher
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        error = errorTextFromBody(data, t);
        return;
      }
      // Drop locally only once the server confirms.
      sessions = sessions.filter((s) => s.id !== id);
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      revokingId = null;
    }
  }

  async function signOutOthers() {
    error = '';
    revokingOthers = true;
    try {
      const res = await csrfFetch(`${basePath}/revoke-others`, { method: 'POST' }, csrf, fetcher);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        error = errorTextFromBody(data, t);
        return;
      }
      await loadSessions();
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      revokingOthers = false;
    }
  }

  /** Zero-dep user-agent → "Browser · OS" heuristic (no UA-parser dependency). */
  function describeDevice(ua: string | null): string {
    const unknown = t.sessions.unknownDevice;
    if (!ua) return unknown;
    const browser = /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\/|Opera/.test(ua)
        ? 'Opera'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
    const os = /Windows/.test(ua)
      ? 'Windows'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'macOS'
          : /Android/.test(ua)
            ? 'Android'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
    if (!browser && !os) return unknown;
    return [browser, os].filter(Boolean).join(' · ');
  }

  const otherCount = $derived(sessions.filter((s) => !s.current).length);

  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);

  onMount(loadSessions);
</script>

<div class={cls('flex flex-col gap-4', [slotClasses.root, className].filter(Boolean).join(' '))}>
  <div class="flex items-center justify-between gap-4">
    <h2 class={cls('text-text-primary min-w-0 truncate text-lg font-semibold', slotClasses.title)}>
      {t.sessions.title}
    </h2>
    {#if otherCount > 0}
      <Button
        variant="outlined"
        intent="danger"
        size="sm"
        loading={revokingOthers}
        disabled={revokingOthers}
        onclick={signOutOthers}
        {unstyled}
        class="shrink-0"
      >
        {t.sessions.signOutOthers}
      </Button>
    {/if}
  </div>

  <div aria-live="polite">
    {#if error}<Alert intent="danger" size="sm" {unstyled}>{error}</Alert>{/if}
  </div>

  <Separator {unstyled} />

  {#if loading}
    <div class="flex justify-center py-4"><Spinner size="sm" /></div>
  {:else if !available}
    <p class={cls('text-text-tertiary py-4 text-center text-sm', slotClasses.empty)}>
      {t.sessions.unavailable}
    </p>
  {:else if sessions.length === 0}
    <p class={cls('text-text-tertiary py-4 text-center text-sm', slotClasses.empty)}>
      {t.sessions.empty}
    </p>
  {:else}
    <ul class={cls('flex flex-col gap-2', slotClasses.list)}>
      {#each sessions as session (session.id)}
        <li
          class={cls(
            'bg-surface-subtle border-border-subtle flex items-center justify-between gap-4 rounded-lg border px-4 py-3',
            slotClasses.item
          )}
        >
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-text-primary flex items-center gap-2 text-sm font-medium">
              <span class="truncate">{describeDevice(session.userAgent)}</span>
              {#if session.current}
                <Badge intent="success" size="sm" {unstyled} class={slotClasses.badge}>
                  {t.sessions.thisDevice}
                </Badge>
              {/if}
            </span>
            <span class="text-text-tertiary text-xs">
              {t.sessions.lastActive}: {new Date(session.lastActive).toLocaleString()}
              {#if session.ip}&middot; {session.ip}{/if}
            </span>
          </div>
          {#if !session.current}
            <Button
              variant="ghost"
              intent="danger"
              size="sm"
              loading={revokingId === session.id}
              disabled={revokingId === session.id}
              onclick={() => revokeSession(session.id)}
              {unstyled}
              class="shrink-0"
            >
              {t.sessions.signOut}
            </Button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
