<script lang="ts">
  import { Button, Card } from '@urbicon-ui/blocks';
  import { subscribeToPush } from '../../utils/service-worker.js';
  import { useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { PushPermissionPromptProps } from './index.js';

  let {
    t: tProp,
    vapidPublicKey,
    subscriptionEndpoint = '/api/notifications/push-subscription',
    csrf,
    fetcher,
    onSubscribed,
    onDismissed,
    unstyled = false,
    slotClasses = {},
    class: className
  }: PushPermissionPromptProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(tProp ?? authLocale());

  let visible = $state(true);

  async function handleEnable() {
    try {
      const subscription = await subscribeToPush(vapidPublicKey);
      if (subscription) {
        const res = await csrfFetch(
          subscriptionEndpoint,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON() })
          },
          csrf,
          fetcher
        );
        // Report success only once the server has actually stored the
        // subscription — firing the callback on a failed POST would mislead the
        // caller into thinking push delivery is set up.
        if (res.ok) onSubscribed?.(subscription);
      }
    } finally {
      // Always dismiss, even if the subscription POST throws (network error) —
      // otherwise the prompt stays open with no way for the user to close it.
      visible = false;
    }
  }

  function handleDismiss() {
    visible = false;
    onDismissed?.();
  }
</script>

{#if visible}
  <Card
    variant="quiet"
    padding="md"
    {unstyled}
    class={unstyled
      ? [slotClasses.root, className].filter(Boolean).join(' ')
      : ['border-border-subtle border', slotClasses.root, className].filter(Boolean).join(' ')}
  >
    <p
      class={unstyled
        ? slotClasses.text
        : ['text-text-secondary text-sm', slotClasses.text].filter(Boolean).join(' ')}
    >
      {t.notifications.push.prompt}
    </p>
    <div
      class={unstyled
        ? slotClasses.actions
        : ['mt-3 flex gap-2', slotClasses.actions].filter(Boolean).join(' ')}
    >
      <Button variant="filled" intent="primary" size="sm" onclick={handleEnable} {unstyled}>
        {t.notifications.push.enable}
      </Button>
      <Button variant="ghost" intent="neutral" size="sm" onclick={handleDismiss} {unstyled}>
        {t.notifications.push.dismiss}
      </Button>
    </div>
  </Card>
{/if}
