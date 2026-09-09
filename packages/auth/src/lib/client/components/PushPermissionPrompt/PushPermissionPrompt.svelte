<script lang="ts">
  import { Button, Card, getBlocksConfig, resolveClassChain } from '@urbicon-ui/blocks';
  import { tick } from 'svelte';
  import { subscribeToPush } from '../../utils/service-worker.js';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import { parseJsonBody, wireError } from '../../utils/http.js';
  import { resolveAuthSlotClasses } from '../../utils/slot-class.js';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import type { PushPermissionPromptProps } from './index.js';

  let {
    t: tProp,
    vapidPublicKey,
    apiPath = '/api/notifications/push-subscription',
    csrf,
    fetcher,
    onSubscribed,
    onDismissed,
    onUnavailable,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: PushPermissionPromptProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'PushPermissionPrompt', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  let visible = $state(true);
  let error = $state<string | null>(null);
  // Enabling push is not idempotent: a second in-flight subscribe races the
  // first POST and can answer with the endpoint conflict the user never caused.
  // Expressed once, as the Enable button's `loading` — that renders the busy
  // state AND swallows the second click. The `if (busy) return` guard the sibling
  // pages carry would be dead weight here: theirs also catches Enter-to-submit on
  // a <form>, and this prompt has no form, so `onclick` is the only way in.
  let busy = $state(false);

  // A decision unmounts the whole card, so the button that carried the focus
  // ring goes with it and focus falls to `<body>` — the reader loses its place
  // in the page. The neighbours have to be read while the card is still
  // mounted, focus moved once it is gone, and only while it is still ours.
  let restoreTarget: HTMLElement | null = null;

  $effect(() => {
    // Once, at mount — whatever held the focus before the prompt appeared.
    // `document.activeElement` is not reactive, so nothing re-runs this.
    const held = document.activeElement;
    restoreTarget = held instanceof HTMLElement && held !== document.body ? held : null;
  });

  /**
   * Focusable elements in document order — the tab order too, unless the page
   * uses a positive `tabindex`; `disabled` is filtered separately.
   */
  const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

  /**
   * Whether the element is laid out. `checkVisibility` is the platform's own
   * answer and also sees `content-visibility`, which is how a closed
   * `<details>` hides its content. jsdom has neither it nor a working
   * `offsetParent` (measured: null for every element there), so under the test
   * runner the computed styles stand in — `display` is not inherited, so every
   * ancestor is read; `visibility` is, so the element's own value already
   * answers for its ancestors and honours an override inside a hidden box.
   */
  function isRendered(el: HTMLElement): boolean {
    const platform = el.checkVisibility?.({
      contentVisibilityAuto: true,
      visibilityProperty: true
    });
    if (platform !== undefined) return platform;
    if (getComputedStyle(el).visibility === 'hidden') return false;
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      if (getComputedStyle(node).display === 'none') return false;
    }
    return true;
  }

  /**
   * The focusables around the pressed button, in document order, read while the
   * card is still in the DOM. The card's own controls are in these lists and
   * drop out by themselves: they are disconnected by the time `reachable` runs.
   */
  function neighbours(trigger: HTMLElement): { after: HTMLElement[]; before: HTMLElement[] } {
    const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE));
    const at = all.indexOf(trigger);
    if (at === -1) return { after: all, before: [] };
    return { after: all.slice(at + 1), before: all.slice(0, at).reverse() };
  }

  /** The first candidate still in the document, enabled and rendered. */
  function reachable(candidates: HTMLElement[]): HTMLElement | null {
    for (const el of candidates) {
      if (!el.isConnected || el.hasAttribute('disabled') || !isRendered(el)) continue;
      return el;
    }
    return null;
  }

  /**
   * Hand the focus on before the card disappears: back to the element that held
   * it when the prompt appeared, else the next tab stop after the card, else the
   * one before it. A page with no other control gets nothing — the caller's
   * callback has already run and may have placed focus itself. No element
   * outside the card is mutated on the way.
   *
   * `trigger` is the pressed button and its parent is the actions row — the
   * card's whole focusable surface, so containment answers "is the focus still
   * ours". Whoever moved focus elsewhere, user or callback, keeps it.
   */
  async function releaseFocus(trigger: HTMLElement | null) {
    const actions = trigger?.parentElement ?? null;
    const held = document.activeElement;
    const ours = held === null || held === document.body || actions?.contains(held) === true;
    if (!ours || !trigger) return;
    const { after, before } = neighbours(trigger);
    // After the flush, not before: the card's own two buttons are still
    // connected until then, and focusing one of them lands on `<body>` a moment
    // later when it is removed.
    await tick();
    const restored = restoreTarget?.isConnected && isRendered(restoreTarget) ? restoreTarget : null;
    const target = restored ?? reachable(after) ?? reachable(before);
    target?.focus();
  }

  async function handleEnable(event: MouseEvent) {
    // Read before the first await: `currentTarget` is only set while the event
    // is being dispatched.
    const trigger = event.currentTarget as HTMLElement | null;
    error = null;
    busy = true;
    try {
      const result = await subscribeToPush(vapidPublicKey);

      if (result.status === 'denied' || result.status === 'unsupported') {
        // A declined permission (or a browser without push) is not a failure:
        // close, and tell the caller which it was so it can persist the outcome
        // instead of remounting the prompt on every visit.
        visible = false;
        // The caller's callback runs first on every closing path: a consumer
        // that places focus itself must not be overridden a tick later.
        onUnavailable?.(result.status);
        void releaseFocus(trigger);
        return;
      }
      if (result.status === 'error') {
        // Operational failure before the server was ever reached (malformed
        // VAPID key, no service worker, push service down). Keep the prompt
        // open with feedback — and give the developer the real error, which
        // the localized message intentionally hides from the user.
        console.error('[auth] enabling push failed before reaching the server:', result.error);
        error = t.notifications.push.error;
        return;
      }

      try {
        const res = await csrfFetch(
          apiPath,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: result.subscription.toJSON() })
          },
          csrf,
          fetcher
        );
        if (res.ok) {
          // Report success only once the server has actually stored the
          // subscription — firing the callback on a failed POST would mislead the
          // caller into thinking push delivery is set up.
          onSubscribed?.(result.subscription);
          visible = false;
          void releaseFocus(trigger);
        } else {
          // Deterministic refusals get precise messages via the machine code
          // ("please try again" would loop forever on a 409); everything else
          // keeps the generic retryable text.
          const { code } = wireError(await parseJsonBody(res));
          if (code === 'push_endpoint_conflict') {
            error = t.notifications.push.errorConflict;
          } else if (code === 'push_subscription_limit') {
            error = t.notifications.push.errorLimit;
          } else if (res.status === 429) {
            error = t.notifications.push.errorRateLimited;
          } else {
            error = t.notifications.push.error;
          }
        }
      } catch (err) {
        // Network error etc. — keep the prompt open WITH feedback so the user
        // can retry or dismiss; closing silently would leave no trace that
        // enabling failed (this was the one component without an error path).
        console.error('[auth] push subscription request failed:', err);
        error = t.notifications.push.error;
      }
    } finally {
      // Every branch above is one the user can retry from — the prompt stays
      // open unless it closed itself — so the flag has to clear on all of them.
      busy = false;
    }
  }

  function handleDismiss(event: MouseEvent) {
    const trigger = event.currentTarget as HTMLElement | null;
    visible = false;
    onDismissed?.();
    void releaseFocus(trigger);
  }
</script>

{#if visible}
  <Card
    variant="quiet"
    padding="md"
    {unstyled}
    class={unstyled
      ? resolveClassChain(slotClasses.root, className)
      : resolveClassChain('border-border-subtle border', slotClasses.root, className)}
  >
    <p
      class={unstyled
        ? slotClasses.text
        : resolveClassChain('text-text-secondary text-sm', slotClasses.text)}
    >
      {t.notifications.push.prompt}
    </p>
    <FormErrorAlert
      error={error ?? ''}
      {unstyled}
      class={unstyled ? slotClasses.error : resolveClassChain('mt-2', slotClasses.error)}
    />
    <div
      class={unstyled
        ? slotClasses.actions
        : resolveClassChain('mt-3 flex gap-2', slotClasses.actions)}
    >
      <Button
        variant="filled"
        intent="primary"
        size="sm"
        loading={busy}
        onclick={handleEnable}
        {unstyled}
      >
        {t.notifications.push.enable}
      </Button>
      <Button variant="ghost" intent="neutral" size="sm" onclick={handleDismiss} {unstyled}>
        {t.notifications.push.dismiss}
      </Button>
    </div>
  </Card>
{/if}
