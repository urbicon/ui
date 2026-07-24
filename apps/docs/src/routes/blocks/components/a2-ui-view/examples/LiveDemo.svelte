<script lang="ts">
  import { onDestroy } from 'svelte';
  import { A2UIView, A2UI_CATALOG_ID, Button, type A2uiActionEvent } from '@urbicon-ui/blocks';

  // A golden-file replay: the agent's JSONL envelopes arrive one line at a time.
  // The consumer's only job is to extend the payload array immutably — A2UIView
  // processes each new envelope incrementally and keeps local input edits. While
  // the stream is in flight `streaming` is true, so a child reference to a
  // not-yet-defined component renders a skeleton placeholder instead of a fault
  // chip; components fill in as their envelopes land.
  const SEQUENCE: unknown[] = [
    { version: 'v0.9.1', createSurface: { surfaceId: 'demo', catalogId: A2UI_CATALOG_ID } },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'demo',
        components: [
          { id: 'root', component: 'Card', child: 'col' },
          { id: 'col', component: 'Column', children: ['title', 'name', 'email', 'submit'] }
        ]
      }
    },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'demo',
        components: [
          { id: 'title', component: 'Text', text: 'Book a demo', variant: 'h4' },
          { id: 'name', component: 'TextField', label: 'Name', value: { path: '/name' } }
        ]
      }
    },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'demo',
        components: [
          { id: 'email', component: 'TextField', label: 'Work email', value: { path: '/email' } },
          { id: 'submit-label', component: 'Text', text: 'Request access' },
          {
            id: 'submit',
            component: 'Button',
            child: 'submit-label',
            action: {
              event: {
                name: 'book_demo',
                context: { name: { path: '/name' }, email: { path: '/email' } }
              }
            }
          }
        ]
      }
    },
    {
      version: 'v0.9.1',
      updateDataModel: { surfaceId: 'demo', value: { name: '', email: '' } }
    }
  ];

  let payload = $state<unknown[]>([]);
  let streaming = $state(false);
  let lastAction = $state<A2uiActionEvent | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function replay() {
    clearTimeout(timer);
    payload = [];
    lastAction = null;
    streaming = true;
    let i = 0;
    const tick = () => {
      payload = [...payload, SEQUENCE[i]];
      i += 1;
      if (i < SEQUENCE.length) {
        timer = setTimeout(tick, 550);
      } else {
        streaming = false;
      }
    };
    timer = setTimeout(tick, 300);
  }

  replay();
  onDestroy(() => clearTimeout(timer));
</script>

<div class="space-y-3">
  <div class="mx-auto max-w-sm">
    <A2UIView {payload} {streaming} onAction={(event) => (lastAction = event)} />
  </div>

  {#if lastAction}
    <pre
      class="bg-surface-base border-border-subtle text-text-secondary overflow-x-auto rounded-lg border p-3 text-xs">[ui-action] {JSON.stringify(
        lastAction,
        null,
        2
      )}</pre>
  {/if}

  <Button size="sm" variant="outlined" onclick={replay}>Replay stream</Button>
</div>
