<script lang="ts">
  import { ToolCallCard, type ChatToolCallPart } from '@urbicon-ui/blocks';

  // A failed call: the card opens itself so the error is visible without a
  // click. `errorMessage` renders above the (still available) input.
  const call: ChatToolCallPart = {
    type: 'tool-call',
    id: 'db-query-7',
    name: 'run_query',
    state: 'error',
    input: { sql: 'SELECT * FROM invoices WHERE due < now()' },
    errorMessage: 'permission denied for relation "invoices" (SQLSTATE 42501)'
  };
</script>

<ToolCallCard toolCall={call} />
