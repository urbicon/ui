<script lang="ts">
  import { goto } from '$app/navigation';
  import { Alert, Button, Card, Textarea } from '@urbicon-ui/blocks';
  import type { SessionState } from '$lib/events';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let title = $state('');
  let starting = $state(false);
  let failure = $state<string | null>(null);

  async function start(event: SubmitEvent) {
    event.preventDefault();
    const wish = title.trim();
    if (!wish || starting) return;
    starting = true;
    failure = null;
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: wish })
      });
      if (!response.ok) throw new Error(await response.text());
      const session = (await response.json()) as SessionState;
      // Der erste Wunsch reist als Query mit: die Sitzung existiert schon, aber
      // der Turn soll erst auf der Studio-Seite laufen — dort steht die
      // Oberfläche, die ihn anzeigt.
      await goto(`/s/${session.id}?first=${encodeURIComponent(wish)}`);
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
      starting = false;
    }
  }
</script>

<main class="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
  <header class="flex flex-col gap-2">
    <h1 class="text-2xl font-semibold">Artifact Studio</h1>
    <p class="text-text-secondary">
      Beschreiben, sehen, weiterreden. Der Agent baut mit dem echten
      <code class="rounded bg-surface-quiet px-1 py-0.5 font-mono text-sm">urbicon</code>-Wissen,
      validiert sich selbst und liefert in eine Sandbox auf eigener Origin.
    </p>
  </header>

  {#if failure}
    <Alert intent="danger" title="Die Sitzung ließ sich nicht anlegen">{failure}</Alert>
  {/if}

  <form class="flex flex-col gap-3" onsubmit={start}>
    <Textarea
      bind:value={title}
      label="Was soll entstehen?"
      placeholder="Eine Einstellungsseite für Benachrichtigungen — E-Mail, Push und SMS je Kategorie, mit Speichern-Leiste unten."
      minRows={3}
      autoResize
      disabled={starting}
    />
    <div class="flex items-center gap-3">
      <Button type="submit" intent="primary" loading={starting} disabled={!title.trim()}>
        {starting ? 'Sitzung wird vorbereitet …' : 'Anfangen'}
      </Button>
      <span class="text-sm text-text-tertiary">
        Der Primer wird einmal geladen — danach läuft jeder Wunsch gecacht.
      </span>
    </div>
  </form>

  {#if data.sessions.length}
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-medium text-text-secondary">Frühere Sitzungen</h2>
      <ul class="flex flex-col gap-2">
        {#each data.sessions as session (session.id)}
          <li>
            <Card href="/s/{session.id}" variant="outlined" padding="sm">
              <div class="flex items-baseline justify-between gap-4">
                <span class="truncate">{session.title}</span>
                <span class="shrink-0 font-mono text-xs text-text-tertiary">
                  {session.versions} Version{session.versions === 1 ? '' : 'en'} ·
                  {session.createdAt.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            </Card>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>
