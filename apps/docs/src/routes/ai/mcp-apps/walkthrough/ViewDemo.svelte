<!--
  The walkthrough's NoteView, compiled from the guide's own fence
  (`guideFencePlugin` in vite.config.ts), on the package's real bridge
  (`createBridge`, `viewBridge`, `toolCaller`). This page is the host on the
  other end of the transport: it answers the handshake, answers `pin_note` the
  way the walkthrough's `call` does, and lists every message the bridge sends.
  What `startView` adds on top (size, theme) does not run here.
-->
<script lang="ts">
  import NoteView from 'virtual:guide-fence/mcp-app/WALKTHROUGH.md/NoteView.svelte';
  import { SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';
  import {
    type Bridge,
    type CallToolResult,
    createBridge,
    type JsonRpcMessage,
    type Transport,
    type ViewState,
    viewBridge
  } from '@urbicon-ui/mcp-app/view';
  import { toolCaller } from '@urbicon-ui/mcp-app/view/tools';
  import { onMount } from 'svelte';

  interface Note {
    id: string;
    title: string;
    body: string;
    pinned: boolean;
  }

  const GROCERIES: Note = {
    id: 'n1',
    title: 'Groceries',
    body: 'Oat milk, lemons, rye bread.',
    pinned: false
  };

  /** What the walkthrough's `call` answers for a note. */
  function noteResult(note: Note): CallToolResult {
    return {
      content: [
        { type: 'text', text: `${note.title}${note.pinned ? ' (pinned)' : ''}: ${note.body}` }
      ],
      structuredContent: { note }
    };
  }

  type Step = 'ready' | 'waiting' | 'failed';
  let step = $state<Step>('ready');

  /** The state object after `startView` has written the step into it. */
  function stateAt(at: Step): ViewState {
    switch (at) {
      case 'ready':
        return {
          phase: 'ready',
          input: { id: 'n1' },
          result: noteResult(GROCERIES),
          problem: null,
          context: {}
        };
      case 'waiting':
        return { phase: 'waiting', input: { id: 'n1' }, result: null, problem: null, context: {} };
      case 'failed':
        // An error result's first text block becomes `state.problem`.
        return {
          phase: 'failed',
          input: { id: 'n9' },
          result: { content: [{ type: 'text', text: 'No note n9.' }], isError: true },
          problem: 'No note n9.',
          context: {}
        };
    }
  }

  interface Sent {
    id: number;
    method: string;
    params: string;
  }
  let sent = $state.raw<Sent[]>([]);
  let nextId = 0;

  /** One host per shown view: a step switch closes the old bridge, so its late answers go nowhere. */
  function connectHost(): Bridge {
    let deliver: (data: unknown) => void = () => {};
    let stored = { ...GROCERIES };
    const answer = (id: JsonRpcMessage['id'], result: unknown, delayMs = 0) =>
      setTimeout(() => deliver({ jsonrpc: '2.0', id, result }), delayMs);

    const transport: Transport = {
      send(message) {
        if (message.method) {
          sent = [
            ...sent,
            { id: nextId++, method: message.method, params: JSON.stringify(message.params ?? {}) }
          ];
        }
        if (message.id === undefined) return;
        if (message.method === 'ui/initialize') {
          const { protocolVersion } = message.params as { protocolVersion: string };
          answer(message.id, {
            protocolVersion,
            hostInfo: { name: 'docs page', version: '1.0.0' }
          });
        } else if (message.method === 'tools/call') {
          const { arguments: args } = message.params as { arguments: { pinned?: unknown } };
          stored = { ...stored, pinned: args.pinned !== false };
          // A round trip through a host takes a moment; the button shows it.
          answer(message.id, noteResult(stored), 600);
        } else {
          answer(message.id, {});
        }
      },
      listen(handler) {
        deliver = handler;
        return () => {
          deliver = () => {};
        };
      }
    };
    return createBridge(transport, { appInfo: { name: 'notes', version: '1.0.0' } });
  }

  /** A step switch may close a bridge mid-handshake; that rejection is the expected end. */
  function connectQuietly(target: Bridge): void {
    target.connect().catch(() => {});
  }

  // Created unconnected for the prerender; the handshake runs in the browser.
  let bridge = $state.raw(connectHost());

  function show(at: Step): void {
    bridge.close();
    sent = [];
    step = at;
    bridge = connectHost();
    connectQuietly(bridge);
  }

  onMount(() => {
    connectQuietly(bridge);
    return () => bridge.close();
  });
</script>

<svelte:head>
  <!-- What the notes server writes into the view for `base.meta`, so "Open in Notes" shows. -->
  <meta name="notes:base" content="https://notes.example.com" />
</svelte:head>

<div class="border-border-subtle overflow-hidden rounded-lg border">
  <div
    class="border-border-subtle bg-surface-quiet flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2"
  >
    <p class="text-text-tertiary font-mono text-xs">show_note · ui://notes/note/…</p>
    <SegmentGroup value={step} onValueChange={(v) => show(v as Step)} size="sm" ariaLabel="Step">
      <SegmentItem value="ready">Result</SegmentItem>
      <SegmentItem value="waiting">Waiting</SegmentItem>
      <SegmentItem value="failed">Failed</SegmentItem>
    </SegmentGroup>
  </div>

  {#key bridge}
    <NoteView state={stateAt(step)} bridge={viewBridge(bridge)} tools={toolCaller(bridge)} />
  {/key}

  <div class="border-border-subtle bg-surface-quiet border-t px-4 py-3">
    <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">
      // What the view sent the host
    </p>
    <ul class="mt-2 space-y-1">
      {#each sent as message (message.id)}
        <li class="font-mono text-xs break-all">
          <span class="text-text-primary">{message.method}</span>
          <span class="text-text-secondary">{message.params}</span>
        </li>
      {/each}
    </ul>
  </div>
</div>
