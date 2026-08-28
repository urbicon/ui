<script lang="ts">
  import { Badge, Button, Separator, Spinner, getBlocksConfig } from '@urbicon-ui/blocks';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import { onMount } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import { errorTextFromBody, getJson, parseJsonBody } from '../../utils/http.js';
  import type { SessionManagerProps } from './index.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';

  let {
    t: tProp,
    apiPath = '/api/auth/sessions',
    csrf,
    fetcher,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: SessionManagerProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'SessionManager', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

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
  // Two failures with different reach, kept apart so neither can silently
  // stand in for the other (the split InvitationManager and PasskeyManager
  // make): `loadError` disowns the list region — "no active sessions" and
  // "unavailable" both describe a list that was actually fetched — while
  // `actionError` is a failed sign-out with the rows on screen still valid.
  // Both speak through the one alert below.
  let actionError = $state('');
  let loadError = $state('');
  const error = $derived(actionError || loadError);
  let revokingId = $state<string | null>(null);
  let revokingOthers = $state(false);

  async function loadSessions() {
    loading = true;
    loadError = '';
    try {
      const { ok, data } = await getJson(apiPath, { fetcher });
      if (!ok) {
        loadError = errorTextFromBody(data, t);
        return;
      }
      sessions = (data.sessions as SessionRow[] | undefined) ?? [];
      available = data.available !== false;
    } catch {
      // Surface the failure rather than rendering an empty list that looks like
      // "no other sessions".
      loadError = t.auth.errors.networkError;
    } finally {
      loading = false;
    }
  }

  async function revokeSession(id: string) {
    actionError = '';
    revokingId = id;
    try {
      const res = await csrfFetch(
        `${apiPath}/revoke`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        },
        csrf,
        fetcher
      );
      if (!res.ok) {
        actionError = errorTextFromBody(await parseJsonBody(res), t);
        return;
      }
      // Drop locally only once the server confirms.
      sessions = sessions.filter((s) => s.id !== id);
    } catch {
      actionError = t.auth.errors.networkError;
    } finally {
      revokingId = null;
    }
  }

  async function signOutOthers() {
    actionError = '';
    revokingOthers = true;
    try {
      const res = await csrfFetch(`${apiPath}/revoke-others`, { method: 'POST' }, csrf, fetcher);
      if (!res.ok) {
        actionError = errorTextFromBody(await parseJsonBody(res), t);
        return;
      }
      await loadSessions();
    } catch {
      actionError = t.auth.errors.networkError;
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
  <div class={cls('flex items-center justify-between gap-4')}>
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
        class={cls('shrink-0')}
      >
        {t.sessions.signOutOthers}
      </Button>
    {/if}
  </div>

  <FormErrorAlert {error} {unstyled} class={slotClasses.error} />

  <Separator {unstyled} />

  {#if loading}
    <div class={cls('flex justify-center py-4')}><Spinner size="sm" {unstyled} /></div>
  {:else if loadError}
    <!-- The alert above carries the reason; a list that was never fetched has no
         reading of its own down here. -->
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
          <div class={cls('flex min-w-0 flex-col gap-0.5')}>
            <span class={cls('text-text-primary flex items-center gap-2 text-sm font-medium')}>
              <span class={cls('truncate')}>{describeDevice(session.userAgent)}</span>
              {#if session.current}
                <Badge intent="success" size="sm" {unstyled} class={slotClasses.badge}>
                  {t.sessions.thisDevice}
                </Badge>
              {/if}
            </span>
            <span class={cls('text-text-tertiary text-xs')}>
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
              class={cls('shrink-0')}
            >
              {t.sessions.signOut}
            </Button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
