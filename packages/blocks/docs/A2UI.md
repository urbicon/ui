# A2UI — agent-generated UI in a chat

`A2UIView` renders [A2UI](https://a2ui.org) (Agent-to-UI, v0.9.1) envelopes into live Urbicon
components: the agent describes a form, the user fills it in, and the values flow back. This guide
covers what the types cannot tell you — how a surface behaves over a whole conversation, and which
of its rules the protocol enforces rather than the renderer.

> Stability: **experimental**. The pieces below are shipped and tested, but the API may still move.

## The five pieces

| Piece | What it does |
| --- | --- |
| `a2uiSystemPrompt()` | The catalog contract: every component, prop and enum the agent may use. Generated from the same registry the validator checks against, so prompt and validation cannot drift. |
| `a2uiFencedTransportSection()` | How envelopes travel: the agent writes prose and opens a ` ```a2ui ` fence. The prompt half of `A2uiStreamSplitter`. |
| `A2uiStreamSplitter` | Turns a token stream into ordered message parts — text, and `a2ui` parts whose payload grows envelope by envelope. |
| `A2uiSurfaceRouter` + `routeMessageParts()` | Delivers envelopes to the message that owns their surface, so an agent can patch a form it sent two turns ago. |
| `A2UIView` | Renders one payload. Fail-loud and whitelist-only: unknown components, undeclared props and function-call bindings never reach the DOM. |

```ts
// Server — the system prompt, assembled from the shipped pieces.
const system = [
  a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
  a2uiDataSchemaSection(MY_SCHEMA),   // optional: type-check the data model
  a2uiFencedTransportSection(),
  MY_DOMAIN_RULES                      // yours: which tools to call, what never to invent
].join('\n\n');
```

```svelte
<!-- Client — one splitter per model round, one router per conversation. -->
<A2UIView
  payload={part.payload}
  streaming={message.status === 'streaming' || patchTargets.has(message.id)}
  catalogs={[urbiconA2uiCatalog]}
  onAction={(event) => sendUserTurn(`[ui-action] ${JSON.stringify(event)}`)}
  onValidationError={(issues) => queueForAgent(issues)}
/>
```

## Surfaces outlive the reply that created them

A `surfaceId` is unique for the renderer's lifetime, and `deleteSurface` is the only way to retire
one. That is what makes multi-step flows work: the agent sends further envelopes for the same
`surfaceId` in a later turn and the form updates **in place**, keeping whatever the user typed.

A payload-driven renderer alone cannot do that — one `A2UIView` owns the surfaces of one payload,
so a patch from a later message would arrive at a view that never saw the `createSurface`. That is
what the router is for: it keeps a `surfaceId → payload` ledger and hands each envelope to the
payload that owns it.

```ts
const router = new A2uiSurfaceRouter();

// Before storing a message's parts, route them:
const result = routeMessageParts(router, messages, messageId, parts);
messages = result.messages;         // patches already delivered into earlier payloads
storeParts(result.parts);           // this message's own parts, foreign envelopes removed
queueForAgent(result.issues);       // e.g. a re-used surfaceId — a protocol slip worth reporting

// When a turn leaves the transcript (regenerate, retry, delete):
messages = revokeMessage(router, messages, droppedMessageId);
```

Two consequences worth designing for:

- **A patched surface needs streaming grace.** Envelopes land one at a time, and the agent is told
  to send containers before their children. Render every message named in `result.targets` with
  `streaming` until the patching turn ends, or each intermediate state reads as a dangling
  reference and the user watches error chips appear and vanish.
- **A long-lived surface deserves different treatment.** `result.promoted` fires the first time a
  surface is patched from a later turn — the moment it stops being a record of one reply. Whether
  that means a marker, a jump link or a pinned panel is a product decision; the protocol says
  nothing about where a surface is displayed.

## You only hear from the user when they act

This surprises everyone once. Per spec, **passive data changes send nothing**: typing in a field,
picking a date, choosing an option updates the surface's data model locally and the agent never
learns of it. The only channel is an `action` — a control the user activates.

Three rules follow, and the shipped prompt states all three:

1. **Anything the agent means to fill in later needs a trigger.** A section that says "pick a date
   and I'll show the times", with no button to press, is a dead end.
2. **A plain choice must not be an action.** A control that only records what the user picked binds
   to the data model (`value: { path }`) — the selection highlights instantly, no round-trip. A row
   of buttons that each set a value shows no selected state and costs a turn per tap.
3. **The agent is the only validator.** The client submits whatever it is given, so an action that
   arrives with required fields empty should be answered with a patched hint, not carried out.

Set `sendDataModel: true` on `createSurface` and every action from that surface additionally carries
the full data model (`A2uiActionEvent.dataModel`), read at click time. It is the antidote to an
under-specified `action.context`.

## Options that come from fetched data

The pattern behind every "load the choices, then let me pick" flow: write the fetched list into the
data model and bind the chooser to it, rather than rewriting the component for each result.

```jsonc
{"version":"v0.9.1","updateDataModel":{"surfaceId":"booking","path":"/slots",
  "value":[{"label":"09:00","value":"09:00"},{"label":"13:45","value":"13:45"}]}}
{"version":"v0.9.1","updateComponents":{"surfaceId":"booking","components":[
  {"id":"pick","component":"RadioGroup","value":{"path":"/time"},"options":{"path":"/slots"}}]}}
```

While `/slots` is still absent the chooser renders empty and stays silent — that is the normal
mid-flow state. Once it resolves to something that is not a list of `{ label, value }`, the view
reports `OPTIONS_NOT_A_LIST` so the agent can repair it.

## Reporting problems back

`onValidationError` fires with every issue the payload produced, each carrying a `severity`. The
error-severity ones are shaped to be relayed to the agent verbatim as a `VALIDATION_FAILED` error;
`a2uiFencedTransportSection()` tells it to expect them behind a `[ui-error]` prefix and re-emit a
corrected surface. Warnings are degradations the surface survived — worth logging, rarely worth a
round-trip. Router issues are the exception: a re-created `surfaceId` is a protocol slip, so relay
it even though it is only a warning.

## Two catalogs

`A2UIView` always understands the **Basic** catalog (the v0.9.1 subset). Passing
`catalogs={[urbiconA2uiCatalog]}` adds the **Urbicon** catalog — real intents and sizes, `Section`,
`RichText`, `Accordion`, `DatePicker`, `Slider` — which the agent selects per surface via
`createSurface.catalogId`. Use the matching spec (`urbiconA2uiCatalogSpec`) when building the
prompt; the two must agree or every component in the payload is unknown.

The Urbicon prompt is capped at 24 kB by a test, deliberately: a bloated prompt measurably degrades
conformance. If you add catalog entries, keep descriptions tight and let the generated prop types
carry the mechanics.
