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
  // in the page. The landing spot has to be picked while the card is still
  // mounted, focus moved once it is gone, and only while it is still ours.
  let restoreTarget: HTMLElement | null = null;

  $effect(() => {
    // Once, at mount — whatever held the focus before the prompt appeared.
    // `document.activeElement` is not reactive, so nothing re-runs this.
    const held = document.activeElement;
    restoreTarget = held instanceof HTMLElement && held !== document.body ? held : null;
  });

  /**
   * Where focus goes when the card is torn down: back to the element that had
   * it before the prompt appeared, else the nearest heading above the prompt,
   * which gets `tabindex="-1"` — without it `focus()` on a heading does
   * nothing, and with it the heading still stays out of the tab order. Null
   * when the page offers neither, which leaves the browser's own behaviour.
   */
  function landingSpot(inside: HTMLElement): HTMLElement | null {
    if (restoreTarget?.isConnected && !inside.contains(restoreTarget)) return restoreTarget;
    let nearest: HTMLElement | null = null;
    const headings = document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
    for (const heading of Array.from(headings)) {
      const precedes =
        (inside.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
      if (precedes && !inside.contains(heading)) nearest = heading;
    }
    if (nearest) nearest.tabIndex = -1;
    return nearest;
  }

  /**
   * Hand the focus on before the card disappears. `trigger` is the pressed
   * button, and its parent is the actions row — the card's whole focusable
   * surface, so containment answers "is the focus still ours". A user who
   * clicked elsewhere while the request ran did not ask to come back.
   */
  async function releaseFocus(trigger: HTMLElement | null) {
    const actions = trigger?.parentElement ?? null;
    const held = document.activeElement;
    const ours = held === null || held === document.body || actions?.contains(held) === true;
    const target = ours && actions ? landingSpot(actions) : null;
    await tick();
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
        void releaseFocus(trigger);
        onUnavailable?.(result.status);
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
    visible = false;
    void releaseFocus(event.currentTarget as HTMLElement | null);
    onDismissed?.();
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
