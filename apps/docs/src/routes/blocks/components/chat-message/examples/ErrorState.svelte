<script lang="ts">
  import { ChatMessage, type ChatMessageData } from '@urbicon-ui/blocks';

  // `status: 'error'` switches the message to its failure presentation: the
  // partial text stays, and an Alert appears with a Retry button wired to onRetry.
  let attempt = $state(1);

  const message: ChatMessageData = {
    id: 'error-1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Let me pull the latest figures for you' }],
    createdAt: new Date('2026-01-01T09:41:00'),
    status: 'error'
  };
</script>

<div class="w-full max-w-2xl">
  <ChatMessage
    {message}
    layout="plain"
    onRetry={() => (attempt += 1)}
    errorLabel="Couldn't reach the model"
  />
  <p class="text-text-tertiary mt-2 text-xs">Retry pressed {attempt - 1}×</p>
</div>
