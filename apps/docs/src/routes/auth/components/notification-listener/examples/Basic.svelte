<script lang="ts">
  import { NotificationListener } from '@urbicon-ui/auth';

  // `store` is your own notification state — the listener only delivers.
  const store = { add: (notification: unknown) => console.log('New notification:', notification) };
</script>

<NotificationListener
  onNotification={(n) => store.add(n)}
  onReconnect={(attempt) => console.log('Reconnecting…', attempt)}
/>
