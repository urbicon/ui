<!--
  A2UIView-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `#lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.

  Der Payload steht im Schnipsel, und zwar der des gewählten Szenarios: Ein
  `<A2UIView />` ohne Envelopes ist nichts, was jemand ausführen kann — die
  Komponente *ist* ihre Nutzlast. `bind:values`, damit der Wechsel des
  Szenario-Reglers den gedruckten Payload mitnimmt.

  **Die Bühne ist ein Chat, kein Formular auf grauer Fläche.** Das ist die
  Pointe der Komponente: Nicht „hier ist ein Anmeldeformular", sondern *das
  Modell hat dieses Formular gerade in deiner Antwort gebaut*. Ohne die
  Nachricht drumherum fehlt genau die Hälfte, die A2UI ausmacht — und die
  Verdrahtung (`partRenderers.a2ui`) ist die Zeile, die ein Leser sucht:
  A2UIView hängt bewusst nicht im Standard-Renderer von ChatMessage, damit sie
  nicht im Basis-Bundle jedes Chats landet.

  Der Rückkanal ist mitgebaut, weil er die eine Regel des Protokolls trägt:
  **nur eine `action` meldet zurück.** Ein Klick auf den Knopf der Surface hängt
  das aufgelöste Ereignis als nächste Nutzer-Nachricht an — genau das, was ein
  echter Client an den Agenten schickt. Tippen im Feld tut das nicht; der
  Datenmodell-Stand reist erst mit der Aktion.

  Auf die Aktion folgt der Zug des Agenten, denn die Surface prüft nichts
  (`checks` ignoriert der Basic-Katalog; docs/A2UI.md: „The agent is the only
  validator"). Endet die Bühne beim Echo, liest sich jede Aktion als ausgeführt,
  auch eine leer abgeschickte. Ein leeres Feld beantwortet der Agent deshalb mit
  einem Hinweis, den er in die bestehende Surface patcht — ausgeführt wird
  nichts. Eine gelungene Anmeldung baut dieselbe Karte um: Ein Agent ändert UI,
  die er schon geschickt hat, statt nur darunter zu antworten.
-->
<script lang="ts">
  import {
    A2UI_CATALOG_ID,
    A2UIView,
    type A2uiActionEvent,
    Button,
    ChatMessage,
    type ChatMessageData
  } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    serializeValue
  } from '@urbicon-ui/docs';
  import type { PlaygroundHostProps } from '#lib/playground-host.js';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // Die `context` einer Aktion nennt jedes Feld der Surface: Was sie weglässt,
  // erreicht den Agenten nicht, und im Echo sieht es aus wie verloren.
  const SCENARIOS: Record<string, unknown[]> = {
    signin: [
      { version: 'v0.9.1', createSurface: { surfaceId: 'pg', catalogId: A2UI_CATALOG_ID } },
      // Zwei `updateComponents`, nicht eines: So kommt eine Surface aus einem
      // echten Modell an — die Hülle zuerst, die Felder danach. Der
      // Zwischenzustand ist genau der, für den `streaming` existiert (`col`
      // verweist auf drei Kinder, die es noch nicht gibt).
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId: 'pg',
          components: [
            { id: 'root', component: 'Card', child: 'col' },
            { id: 'col', component: 'Column', children: ['title', 'email', 'password', 'submit'] },
            { id: 'title', component: 'Text', text: 'Welcome back', variant: 'h4' }
          ]
        }
      },
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId: 'pg',
          components: [
            { id: 'email', component: 'TextField', label: 'Email', value: { path: '/email' } },
            {
              id: 'password',
              component: 'TextField',
              label: 'Password',
              variant: 'obscured',
              value: { path: '/password' }
            },
            { id: 'submit-label', component: 'Text', text: 'Sign in' },
            {
              id: 'submit',
              component: 'Button',
              child: 'submit-label',
              action: {
                event: {
                  name: 'signin',
                  context: { email: { path: '/email' }, password: { path: '/password' } }
                }
              }
            }
          ]
        }
      },
      {
        version: 'v0.9.1',
        updateDataModel: { surfaceId: 'pg', value: { email: '', password: '' } }
      }
    ],
    survey: [
      { version: 'v0.9.1', createSurface: { surfaceId: 'pg', catalogId: A2UI_CATALOG_ID } },
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId: 'pg',
          components: [
            { id: 'root', component: 'Card', child: 'col' },
            { id: 'col', component: 'Column', children: ['q', 'rating', 'contact', 'submit'] },
            { id: 'q', component: 'Text', text: 'How was your experience?', variant: 'h4' }
          ]
        }
      },
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId: 'pg',
          components: [
            {
              id: 'rating',
              component: 'Slider',
              label: 'Rating',
              value: { path: '/rating' },
              max: 10
            },
            {
              id: 'contact',
              component: 'CheckBox',
              label: 'You may contact me',
              value: { path: '/contact' }
            },
            { id: 'submit-label', component: 'Text', text: 'Submit' },
            {
              id: 'submit',
              component: 'Button',
              child: 'submit-label',
              action: {
                event: {
                  name: 'submit_survey',
                  context: { rating: { path: '/rating' }, contact: { path: '/contact' } }
                }
              }
            }
          ]
        }
      },
      {
        version: 'v0.9.1',
        updateDataModel: { surfaceId: 'pg', value: { rating: 5, contact: false } }
      }
    ]
  };

  const controls = deriveControls(componentData, {
    pick: ['streaming'],
    overrides: {
      // Startwert `true`, obwohl die Komponente `false` vorgibt: Diese Bühne
      // führt einen ankommenden Stream vor, und das ist der Zustand, in dem ein
      // Client sie dabei hält. Auf `false` ist die Prop hier folgenlos, solange
      // die Surface vollständig ist — genau deshalb stand der Regler vorher tot
      // im Panel.
      streaming: { type: 'boolean', defaultValue: true }
    },
    extra: [
      {
        type: 'dropdown',
        key: 'scenario',
        label: 'Scenario',
        items: [
          { label: 'Sign-in form', value: 'signin' },
          { label: 'Feedback survey', value: 'survey' }
        ],
        defaultValue: 'signin'
      }
    ]
  });

  let values = $state<Record<string, unknown>>(defaultValuesOf(controls));

  const scenario = $derived((values.scenario as string) ?? 'signin');
  const fullPayload = $derived(SCENARIOS[scenario] ?? SCENARIOS.signin);

  /**
   * Der Zug des Agenten auf eine Aktion: ein Satz im Verlauf und, wo nötig, ein
   * Patch an die Surface, aus der die Aktion kam — kein zweites Formular im
   * Verlauf.
   */
  interface AgentTurn {
    action: A2uiActionEvent;
    reply: string;
    patch: unknown[];
  }

  const signinColumn = (children: string[], extra: unknown[] = []) => ({
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'pg',
      components: [{ id: 'col', component: 'Column', children }, ...extra]
    }
  });

  function agentTurn(which: string, action: A2uiActionEvent): AgentTurn {
    if (which === 'survey') {
      const reply =
        action.context.contact === true
          ? 'Thanks — noted, and the team may follow up.'
          : 'Thanks — noted for the summary.';
      return { action, reply, patch: [] };
    }
    const email = String(action.context.email ?? '').trim();
    const emailOk = /^[^\s@]+@[^\s@]+$/.test(email);
    // Jedes Passwort gilt — nur ein leeres nicht.
    const passwordOk = String(action.context.password ?? '') !== '';
    if (!emailOk || !passwordOk) {
      // Jeder Hinweis steht unter seinem Feld. `col` wird mit jedem Versuch neu
      // gesetzt, so verliert ein inzwischen ausgefülltes Feld seinen Hinweis.
      return {
        action,
        reply: 'Not signed in yet — the form shows what is missing.',
        patch: [
          signinColumn(
            [
              'title',
              'email',
              ...(emailOk ? [] : ['email-hint']),
              'password',
              ...(passwordOk ? [] : ['password-hint']),
              'submit'
            ],
            [
              {
                id: 'email-hint',
                component: 'Text',
                text: 'Enter the email you signed up with.',
                variant: 'caption'
              },
              {
                id: 'password-hint',
                component: 'Text',
                text: 'Enter your password.',
                variant: 'caption'
              }
            ]
          )
        ]
      };
    }
    return {
      action,
      reply: 'You are in. Where were we?',
      patch: [
        signinColumn(
          ['title', 'status'],
          [{ id: 'status', component: 'Text', text: `Signed in as ${email}.` }]
        )
      ]
    };
  }

  /** Die Aktionen der Surface und was der Agent darauf geantwortet hat. */
  let turns = $state.raw<AgentTurn[]>([]);

  /**
   * Wie viele Envelopes zugestellt sind — `null` heißt „alle".
   *
   * Ohne das ist der `streaming`-Regler folgenlos: Gemessen rendert eine
   * *fertige* Surface mit `streaming` an und aus byte-identisch (11026 Zeichen
   * DOM, beide Male). Die Prop entscheidet, was mit einer Referenz auf eine
   * noch nicht definierte Komponente passiert — Platzhalter statt Fehlermarke —
   * und die gibt es nur mitten im Aufbau.
   */
  let delivered = $state<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Die Patches des Agenten hängen hinter dem Payload, nie dazwischen: A2UIView
  // wendet nur an, was an einen referenzgleichen Anfang angehängt wird, und
  // baut sonst neu auf — dann wäre das eingetippte Feld wieder leer.
  const patches = $derived(turns.flatMap((turn) => turn.patch));
  const payload = $derived(
    delivered === null ? [...fullPayload, ...patches] : fullPayload.slice(0, Math.max(1, delivered))
  );
  const playing = $derived(delivered !== null);

  function stopPlayback() {
    clearTimeout(timer);
    timer = undefined;
    delivered = null;
  }

  function play() {
    clearTimeout(timer);
    turns = [];
    delivered = 1;
    const step = () => {
      if (delivered === null) return;
      if (delivered >= fullPayload.length) {
        delivered = null;
        return;
      }
      delivered += 1;
      timer = setTimeout(step, 900);
    };
    timer = setTimeout(step, 900);
  }

  /** Die Frage, auf die das Modell mit einer Surface geantwortet hat. */
  const PROMPTS: Record<string, { ask: string; reply: string }> = {
    signin: {
      ask: 'I need to get into my account.',
      reply: 'Sure — sign in here and I will pick up where you left off.'
    },
    survey: {
      ask: 'Ask me how the onboarding went.',
      reply: 'Happy to. Two questions, then I will summarise it for the team.'
    }
  };

  /**
   * Der Verlauf. `envelopes` ist ein Parameter, weil Bühne und Schnipsel
   * verschiedene Stände zeigen: Die Bühne den gerade zugestellten (beim
   * Abspielen also einen Ausschnitt), der Schnipsel den vollständigen — wie ein
   * Payload wächst, ist Sache des Transports, nicht der Verwendung.
   */
  function threadFor(which: string, envelopes: unknown[]): ChatMessageData[] {
    const prompt = PROMPTS[which] ?? PROMPTS.signin;
    return [
      {
        id: `${which}-ask`,
        role: 'user',
        parts: [{ type: 'text', text: prompt.ask }],
        createdAt: new Date('2026-01-01T09:41:00'),
        status: 'complete'
      },
      {
        id: `${which}-reply`,
        role: 'assistant',
        parts: [
          { type: 'text', text: prompt.reply },
          { type: 'a2ui', payload: envelopes }
        ],
        createdAt: new Date('2026-01-01T09:41:04'),
        status: 'complete'
      }
    ];
  }

  // Der Szenario-Wechsel setzt die Züge zurück — eine Antwort auf eine Frage,
  // die nicht mehr dasteht, wäre falscher Verlauf.
  $effect(() => {
    void scenario;
    turns = [];
    stopPlayback();
  });

  // Die Blase zeigt, was der Agent bekommt — bis auf ein eingegebenes
  // Passwort: Er bekommt es vollständig, im Verlauf stünde es im Klartext.
  // Ein leeres bleibt sichtbar leer, denn genau das beantwortet der Agent.
  const maskPassword = (key: string, value: unknown) =>
    key === 'password' && typeof value === 'string' && value !== '' ? '••••' : value;

  const thread = $derived.by((): ChatMessageData[] => [
    ...threadFor(scenario, payload),
    ...turns.flatMap((turn, i): ChatMessageData[] => [
      {
        id: `${scenario}-action-${i}`,
        role: 'user',
        parts: [
          {
            type: 'text',
            text: `\`${turn.action.name}\` → ${JSON.stringify(turn.action.context, maskPassword)}`
          }
        ],
        createdAt: new Date('2026-01-01T09:41:20'),
        status: 'complete'
      },
      {
        id: `${scenario}-answer-${i}`,
        role: 'assistant',
        parts: [{ type: 'text', text: turn.reply }],
        createdAt: new Date('2026-01-01T09:41:22'),
        status: 'complete'
      }
    ])
  ]);

  /**
   * Der Schnipsel zeigt die Verdrahtung, nicht das nackte Tag: A2UIView sitzt im
   * `a2ui`-Snippet einer ChatMessage, und `onAction` ist der Rückweg. Beides
   * zusammen ist die Antwort auf „wie benutze ich das", und keine Prop-Liste
   * kann sie geben.
   */
  function chatSnippet(current: Record<string, unknown>): string {
    const which = (current.scenario as string) ?? 'signin';
    const streaming = current.streaming === true;
    return `<script lang="ts">
  import { A2UIView, ChatMessage } from '@urbicon-ui/blocks';
  import type { A2uiActionEvent } from '@urbicon-ui/blocks';

  // The settled payload. In a live chat it arrives envelope by envelope out of
  // an \`\`\`a2ui fence — see \`A2uiStreamSplitter\` and \`routeMessageParts\`.
  const thread = ${serializeValue(threadFor(which, SCENARIOS[which] ?? SCENARIOS.signin), 2)};

  function handleAction(event: A2uiActionEvent) {
    // The only return path: send this back to the agent as the next turn.
    // Typing in the surface does not report — the data model rides along here.
    // Nothing is checked on the client: an empty field reaches the agent, which
    // answers with a patched hint instead of acting (the shipped prompt says so).
  }
<\/script>

{#snippet a2ui(part)}
  <!-- \`streaming\` while the answer is still arriving: a reference to a
       not-yet-defined component then renders a placeholder instead of a fault
       chip. Flip it off once the stream settles, or a genuinely dangling
       reference stays a placeholder for good. -->
  <A2UIView payload={part.payload} onAction={handleAction}${streaming ? ' streaming' : ''} />
{/snippet}

{#each thread as message (message.id)}
  <ChatMessage {message} partRenderers={{ a2ui }} />
{/each}`;
  }
</script>

<PlaygroundConfigurator
  componentName="A2UIView"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  bind:values
  codeGenerator={chatSnippet}
>
  {#snippet children(values)}
    {#snippet a2ui(part: { payload: unknown })}
      <A2UIView
        payload={part.payload}
        streaming={values.streaming === true}
        onAction={(event) => (turns = [...turns, agentTurn(scenario, event)])}
      />
    {/snippet}
    <!-- Schmaler als eine Doku-Spalte: Eine Surface, die über die halbe Seite
         läuft, liest sich als Seite und nicht als Nachricht. -->
    <div class="mx-auto flex w-full max-w-md flex-col gap-4">
      <!-- Der Aufbau ist Demo-Steuerung und steht deshalb nicht im Schnipsel:
           In einer echten App liefert ihn der Transport. Ohne ihn wäre der
           `streaming`-Regler aber unvorführbar — er entscheidet nur über den
           Zwischenzustand. -->
      <div class="flex items-center gap-2">
        <Button intent="primary" size="sm" onclick={play} disabled={playing}>
          {playing ? 'Streaming…' : 'Replay the stream'}
        </Button>
        {#if playing}
          <span class="text-text-tertiary text-xs">
            envelope {delivered} of {fullPayload.length}
          </span>
        {/if}
      </div>
      {#each thread as message (message.id)}
        <ChatMessage {message} partRenderers={{ a2ui }} />
      {/each}
    </div>
  {/snippet}
</PlaygroundConfigurator>
