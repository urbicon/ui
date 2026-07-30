<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { Alert, Button, SegmentGroup, SegmentItem, Spinner, Textarea } from '@urbicon-ui/blocks';
  import type { SessionState, StudioEvent, VersionInfo } from '$lib/events';
  import { runTurn } from '$lib/stream';

  let { session }: { session: SessionState } = $props();

  /**
   * Der Serverzustand ist hier ein **Startwert**, kein Abonnement: ab dem ersten
   * Wunsch schreibt der Ereignisstrom die Versionen fort, und ein nachladender
   * `load` würde sie sonst überschreiben. Die Seite mountet diese Komponente
   * unter `{#key session.id}`, eine andere Sitzung bekommt also ohnehin eine
   * frische Instanz — genau die Bedingung, unter der `untrack` hier ehrlich ist
   * und nicht bloß eine Warnung stummschaltet.
   */
  let versions = $state<VersionInfo[]>(untrack(() => session.versions));
  /** 1-basiert wie die Chips; 0 heißt „noch nichts gebaut". */
  let shown = $state(untrack(() => session.versions.length));
  let view = $state<'preview' | 'source'>('preview');
  let wish = $state('');
  let running = $state(false);
  let failure = $state<string | null>(null);

  /**
   * Was gerade passiert — der Maschinenraum eines laufenden Turns.
   *
   * Er steht bewusst nicht auf der Bühne (ARTEFAKTE §4.3: die Erfahrung ist der
   * Inhalt, nicht der Linter), aber während der 40 Sekunden, die ein Wunsch
   * dauert, ist er das Einzige, was den Unterschied zwischen „arbeitet" und
   * „hängt" zeigt.
   */
  type Step =
    | { kind: 'wish'; text: string }
    | { kind: 'fix'; text: string }
    | { kind: 'cli'; text: string }
    | { kind: 'edit'; text: string; ok: boolean }
    | { kind: 'say'; text: string }
    | { kind: 'lint'; text: string; clean: boolean }
    | { kind: 'build'; text: string };
  /** Stabile Schlüssel für `{#each}` — der Index wäre keiner. */
  let keyed = $state<{ id: number; step: Step }[]>([]);
  let stepSeq = 0;

  function push(step: Step) {
    keyed.push({ id: stepSeq++, step });
  }

  /**
   * Den jüngsten Schritt einer Sorte umschreiben — für Schritte, die einen
   * Anfang und ein Ende haben (bisher nur der Build). Der Eintrag behält seinen
   * Schlüssel, die Zeile springt also nicht.
   */
  function replaceLast(kind: Step['kind'], text: string) {
    const entry = keyed.findLast((e) => e.step.kind === kind);
    if (entry) entry.step = { ...entry.step, text };
  }

  const current = $derived(versions.find((v) => v.n === shown));
  const kb = (n: number) => `${(n / 1024).toFixed(1)} kB`;

  /**
   * Dem Protokoll hinterherscrollen, solange der Turn läuft.
   *
   * Ein erster Wurf kann 45 Werkzeug-Runden haben; ohne das läuft der aktuelle
   * Schritt nach wenigen Aufrufen aus dem Bild und der Verlauf wirkt eingefroren.
   * Nur während `running` — danach soll das Zurückblättern nicht bevormundet
   * werden.
   */
  function followTail(node: HTMLElement) {
    $effect(() => {
      keyed.length;
      if (running) node.scrollTop = node.scrollHeight;
    });
  }

  async function send(instruction: string) {
    if (running) return;
    running = true;
    failure = null;
    keyed = [];
    push({ kind: 'wish', text: instruction });

    try {
      for await (const event of runTurn(session.id, instruction)) {
        apply(event);
      }
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    } finally {
      running = false;
    }
  }

  function apply(event: StudioEvent) {
    switch (event.type) {
      case 'turn:start':
        // Der erste Turn ist der Wunsch selbst — er steht schon da.
        if (event.kind === 'fix') push({ kind: 'fix', text: 'Der Linter hat etwas beanstandet' });
        break;
      case 'cli':
        push({
          kind: 'cli',
          text: `urbicon ${event.args.join(' ')} → ${kb(event.outputBytes)}`
        });
        break;
      case 'edit':
        push({
          kind: 'edit',
          ok: event.ok,
          text: event.ok
            ? `${event.command} −${event.oldBytes}/+${event.newBytes} B → ${kb(event.fileBytes)}`
            : `${event.command} ✗ ${event.error ?? 'fehlgeschlagen'}`
        });
        break;
      case 'text':
        if (event.text.trim()) push({ kind: 'say', text: event.text.trim() });
        break;
      case 'lint': {
        const { counts, scores } = event.report;
        push({
          kind: 'lint',
          clean: counts.error === 0 && !event.compileError,
          text: event.compileError
            ? `kompiliert nicht: ${event.compileError}`
            : `${counts.error} E / ${counts.warning} W · correctness ${scores.correctness} · craft ${scores.craft}`
        });
        break;
      }
      case 'build:start':
        push({ kind: 'build', text: 'wird gebaut …' });
        break;
      case 'version':
        versions = [...versions.filter((v) => v.n !== event.version.n), event.version].sort(
          (a, b) => a.n - b.n
        );
        shown = event.version.n;
        view = 'preview';
        // Den laufenden Schritt zum abgeschlossenen machen, statt „wird gebaut …"
        // stehen zu lassen: das Protokoll bleibt nach dem Turn sichtbar, und ein
        // dauerhaftes Partizip liest sich dort wie ein hängender Prozess.
        replaceLast(
          'build',
          `v${event.version.n} gebaut · ${(event.version.buildMs / 1000).toFixed(1)} s`
        );
        break;
      case 'error':
        failure = event.message;
        break;
      case 'done':
        break;
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const text = wish.trim();
    if (!text) return;
    wish = '';
    void send(text);
  }

  /**
   * Der erste Wunsch reist als Query mit — die Sitzung wurde auf der Startseite
   * angelegt, gelaufen ist er noch nicht. Die Query wird sofort aus der URL
   * genommen, damit ein Reload ihn nicht ein zweites Mal auslöst.
   *
   * `onMount` und nicht `$effect`: hier soll einmal etwas angestoßen werden, es
   * gibt nichts, worauf zu reagieren wäre. Ein Effekt hätte `page.url` als
   * Abhängigkeit — und `replaceState` schreibt genau die, würde sich also selbst
   * neu anstoßen und bräuchte einen Wächter gegen die eigene Schleife.
   */
  onMount(() => {
    const first = page.url.searchParams.get('first');
    if (!first || versions.length) return;
    replaceState(`/s/${session.id}`, {});
    void send(first);
  });
</script>

<div class="flex h-dvh flex-col">
  <header
    class="flex shrink-0 items-baseline justify-between gap-4 border-b border-border-subtle px-5 py-3"
  >
    <div class="flex items-baseline gap-3 overflow-hidden">
      <a href="/" class="shrink-0 text-sm text-text-tertiary hover:text-text-primary">← Sitzungen</a
      >
      <h1 class="truncate font-medium">{session.title}</h1>
    </div>
    <span class="shrink-0 font-mono text-xs text-text-tertiary">
      {session.model} · effort {session.effort}
    </span>
  </header>

  <div class="flex min-h-0 flex-1">
    <!-- Der Verlauf ist bewusst schmal: das Artefakt-Panel muss über dem
         lg-Breakpoint (1024 px) bleiben, sonst zeigen responsive Artefakte
         dauerhaft ihre Tablet-Variante (BEFUNDE §21). -->
    <aside class="flex w-80 shrink-0 flex-col border-r border-border-subtle">
      <div
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
        {@attach followTail}
      >
        {#if versions.length}
          <ol class="flex flex-col gap-3">
            {#each versions as version (version.n)}
              <li>
                <button
                  type="button"
                  class={[
                    'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                    version.n === shown
                      ? 'border-border-emphasis bg-surface-quiet'
                      : 'border-border-subtle hover:bg-surface-hover'
                  ]}
                  onclick={() => (shown = version.n)}
                >
                  <span class="block text-sm">{version.prompt}</span>
                  <span class="mt-1 block font-mono text-xs text-text-tertiary">
                    v{version.n} · {(version.durationMs / 1000).toFixed(0)} s ·
                    {version.lint.counts.error} E / {version.lint.counts.warning} W · ${version.costUsd.toFixed(
                      2
                    )}
                  </span>
                </button>
              </li>
            {/each}
          </ol>
        {/if}

        <!-- Der Maschinenraum bleibt nach dem Turn stehen, statt sich
             wegzuräumen: die Schlusssätze des Modells („ich habe X eingefügt,
             validiert 100/100") sind das Protokoll dessen, was gerade passiert
             ist, und wer sie sucht, sucht sie direkt nach dem Turn. -->
        {#if keyed.length}
          <ol
            class={[
              'flex flex-col gap-2 font-mono text-xs',
              versions.length && 'border-t border-border-subtle pt-4'
            ]}
          >
            {#each keyed as entry (entry.id)}
              {@const step = entry.step}
              <li
                class={[
                  step.kind === 'wish' && 'font-sans text-sm text-text-primary',
                  step.kind === 'fix' && 'text-warning-600',
                  step.kind === 'cli' && 'text-text-tertiary',
                  step.kind === 'edit' && (step.ok ? 'text-text-secondary' : 'text-danger-600'),
                  step.kind === 'say' && 'font-sans text-sm text-text-secondary',
                  step.kind === 'lint' && (step.clean ? 'text-success-600' : 'text-warning-600'),
                  step.kind === 'build' && 'text-text-tertiary'
                ]}
              >
                {step.text}
              </li>
            {/each}
            {#if running}
              <li class="flex items-center gap-2 text-text-tertiary">
                <Spinner size="xs" /> arbeitet
              </li>
            {/if}
          </ol>
        {/if}
      </div>

      <form class="shrink-0 border-t border-border-subtle p-3" onsubmit={submit}>
        <Textarea
          bind:value={wish}
          placeholder={versions.length ? 'Was soll sich ändern?' : 'Was soll entstehen?'}
          minRows={2}
          maxRows={6}
          autoResize
          disabled={running}
          size="sm"
        />
        <div class="mt-2 flex justify-end">
          <Button
            type="submit"
            intent="primary"
            size="sm"
            loading={running}
            disabled={!wish.trim()}
          >
            Schicken
          </Button>
        </div>
      </form>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <div
        class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-2"
      >
        <div class="flex flex-wrap items-center gap-1.5">
          {#each versions as version (version.n)}
            <Button
              size="xs"
              variant={version.n === shown ? 'filled' : 'outlined'}
              intent={version.n === shown ? 'primary' : 'neutral'}
              onclick={() => (shown = version.n)}
            >
              v{version.n}
            </Button>
          {/each}
          {#if current}
            <span class="ml-2 font-mono text-xs text-text-tertiary">
              {current.lint.counts.error} E / {current.lint.counts.warning} W · correctness {current
                .lint.scores.correctness} · craft {current.lint.scores.craft} ·
              {(current.durationMs / 1000).toFixed(0)} s + {(current.buildMs / 1000).toFixed(1)} s Build
            </span>
          {/if}
        </div>
        {#if current}
          <SegmentGroup bind:value={view} size="sm" ariaLabel="Ansicht">
            <SegmentItem value="preview">Vorschau</SegmentItem>
            <SegmentItem value="source">Quelltext</SegmentItem>
          </SegmentGroup>
        {/if}
      </div>

      {#if failure}
        <div class="px-5 pt-4">
          <Alert intent="danger" title="Abgebrochen">{failure}</Alert>
        </div>
      {/if}

      <div class="min-h-0 flex-1">
        {#if !current}
          <div class="flex h-full items-center justify-center px-6 text-center">
            <p class="max-w-sm text-text-tertiary">
              {running
                ? 'Der Agent recherchiert, schreibt und validiert. Der erste Wurf dauert typischerweise unter einer Minute.'
                : 'Noch keine Version. Beschreibe links, was entstehen soll.'}
            </p>
          </div>
        {:else if view === 'preview'}
          <!--
            `allow-scripts allow-same-origin` zusammen ist nur dann die bekannte
            Gefahr, wenn die Sandbox DIESELBE Origin wie der Host hat — dann
            könnte sie ihre eigenen Sandbox-Attribute entfernen. Hier liegt sie
            auf 127.0.0.1:5211, also gewährt `allow-same-origin` ihr nur Zugriff
            auf sich selbst, nie auf den Host. Ohne das Attribut wäre die Origin
            opak, und dagegen matcht die CSP-Quelle `'self'` nicht mehr — der
            Browser blockt dann das eigene Artefakt-Modul (BEFUNDE §3).
          -->
          <iframe
            title="Artefakt v{current.n}"
            src={current.frameUrl}
            sandbox="allow-scripts allow-same-origin"
            referrerpolicy="no-referrer"
            class="h-full w-full border-0 bg-surface-base"
          ></iframe>
        {:else}
          <div class="h-full overflow-auto bg-surface-quiet">
            <pre class="p-5 font-mono text-xs leading-relaxed"><code>{current.code}</code></pre>
          </div>
        {/if}
      </div>
    </main>
  </div>
</div>
