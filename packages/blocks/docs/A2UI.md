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
| `A2UIView` | Renders one payload. Fail-loud and whitelist-only: unknown components and undeclared props never reach the DOM, and neither does a function-call binding — except the logic functions `not`, `and`, `or`, which evaluate to a boolean and execute nothing. |

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

## Gating a control on the data model

A binding resolves a pointer and nothing else, so `disabled: { "path": "/agreed" }` gates the wrong
way round. A2UI's Basic catalog defines three logic functions for this, and they are the only
function calls a binding may use:

```jsonc
{
  "id": "book",
  "component": "Button",
  "child": "bookLabel",
  "action": { "event": { "name": "book" } },
  "disabled": { "call": "not", "args": { "value": { "path": "/agreed" } } }
}
```

`not` takes `args.value`; `and` and `or` take `args.values`, two or more. Each operand is `true`,
`false`, a `{ path }` binding or another of the three — never another function, such as the
`required` that A2UI's own examples nest inside `and`.

- **Only `true` counts as true.** An operand that is `undefined`, `null`, a string or a number counts
  as false. A path nobody has written yet is therefore false, so the button above starts disabled
  without the agent having to initialise `/agreed`. A plain `disabled: { "path": … }` reads
  JavaScript truthiness instead (`"yes"` disables), and both lean closed for a consent gate: a stray
  value disables the plain binding, and in `not(consent)` anything but a real `true` is no consent.
- **Accepted only on a gate** — a boolean prop whose catalog entry says what it fails closed to:
  `Button.disabled` in the Urbicon catalog. Not on an input's `value`, which records what the user
  does and must stay a `{ path }`, and not on a string or number prop: both are a `TYPE_MISMATCH`
  error, and the prop is dropped.
- **A broken gate fails closed.** A value on `disabled` that cannot be used — a malformed call (an
  unknown key, a single operand for `and`), one nested or branching past the engine's caps, one
  naming any other function at the top or nested, a non-boolean literal such as `"true"`, a
  poisoned path — is an error, and the button stays disabled until the agent replaces it.
  Elsewhere, a function call other than these three resolves to nothing, with a
  `FUNCTION_CALL_UNSUPPORTED` warning.
- **`action.event.context` evaluates them too**, at click time, so the event carries the boolean. A
  malformed one is an error, and its key travels as `undefined`: context has nothing to fail closed
  to.
- **`checks` gates the button too.** A2UI's own form of this gate is a list of rules on the Button,
  `"checks": [{ "condition": { "path": "/agreed" }, "message": "…" }]`. Today only the Urbicon
  `Button` evaluates `checks`: the button is disabled while any condition is not exactly `true` —
  read like an operand, so the path above passes only once `/agreed` is `true` — or while
  `disabled` asks for it. A list the engine cannot evaluate is an error and holds `disabled` at
  `true`: a rule other than `{ condition, message }`, a list holding more operands than one call
  may when counted as an `and` over its conditions, or a condition `disabled` would refuse,
  `required` and `email` among them. `required` stays out on purpose: upstream counts `false` as a
  value, so it would pass for a box the user unticked. The `message` is not rendered. Every other
  component, every Basic one included, ignores `checks` with an `IGNORED_PROP` warning.
- **A gate is a convenience, not a guarantee.** The agent is still the only validator: an action
  can reach it with `/agreed` false, and it should not act on one.

## Requiring a component on a surface

The catalog says what a surface may contain. What one must contain — a consent box on the booking
form — is your rule for that form, so you state it per `surfaceId`, and the same object goes to
the view and to the prompt:

<!-- typecheck -->

```ts
import {
  type A2uiSurfaceRequirements,
  a2uiFencedTransportSection,
  a2uiSurfaceRequirementsSection,
  a2uiSystemPrompt,
  urbiconA2uiCatalogSpec
} from '@urbicon-ui/blocks';

export const BOOKING_REQUIREMENTS: A2uiSurfaceRequirements = {
  booking: [{ component: 'Checkbox', path: '/agreed', description: 'consent to the policy' }]
};

// Server: tell the model before it builds. The model picks surfaceIds, so the section pins it.
export const system = [
  a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
  a2uiSurfaceRequirementsSection(BOOKING_REQUIREMENTS, urbiconA2uiCatalogSpec),
  a2uiFencedTransportSection()
].join('\n\n');
```

```svelte
<!-- Client: the same catalog and the same object. Missing components are reported once settled. -->
<A2UIView
  payload={part.payload}
  streaming={message.status === 'streaming' || patchTargets.has(message.id)}
  catalogs={[urbiconA2uiCatalog]}
  surfaceRequirements={BOOKING_REQUIREMENTS}
  onValidationError={(issues) => queueForAgent(issues)}
/>
```

A requirement is met by a component of that name that is reachable from `root` and renders as
itself. One defined but never referenced renders nothing, and one the catalog does not know or that
lost a required prop renders as a fault chip — neither counts. With `path`, its `value` (or the prop
named in `prop`) must also be a `{ path }` binding that resolves to that pointer, template scope
included. One component meets one entry, so two `Checkbox` entries ask for two boxes; the entries
are matched to your components as a whole, so an entry is missing only when no assignment of the
rendered components could meet it.

Each unmet requirement is one `MISSING_REQUIRED_COMPONENT` issue on `onValidationError`, and only
once `streaming` is false: a surface arrives over several envelopes, and v0.9.1 has no message that
marks one complete, so the end of the turn that built or patched it is the earliest point at which
"missing" is true. It is an error so it travels the channel you relay, and the model can patch the
surface; nothing is thrown, and the surface renders as it stands. A surface whose id has no entry is
not checked. Without the view, a processor holding the view's catalogs, Basic first as the view
holds it — `createA2uiProcessor({ catalogs: [basicA2uiCatalogSpec, urbiconA2uiCatalogSpec],
surfaceRequirements })` — plus `collectGraphIssues(surface)` reports the same issue on a server.
Without `catalogs` the processor knows Basic alone, so an Urbicon entry is an `INVALID_REQUIREMENT`
warning and never checked.

Which catalog a surface is on is the model's choice, and `A2UIView` always holds the Basic catalog
as its fallback — a surface created with Basic's id, an unknown one or the upstream catalog URL
lands there. An entry that surface's catalog cannot hold (`Checkbox` is the Urbicon spelling,
`CheckBox` the Basic one) is still checked: it fails as `MISSING_REQUIRED_COMPONENT`, and the
message names the catalog the surface should have been created with. The prompt states it up front:
`a2uiSurfaceRequirementsSection` names that catalogId next to the surfaceId whenever Basic cannot
meet a surface's entries.

An entry no catalog of the view can meet — a component none of them has, a prop the component does
not declare, a relative `path` — is your mistake, not the model's. The view reports it once, as an
`INVALID_REQUIREMENT` warning when the surface is created, and leaves it unchecked;
`a2uiSurfaceRequirementsSection` leaves it out of the prompt, so the model is never asked for it.

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
mid-flow state. Once it resolves to something that is not an **array**, the view reports
`OPTIONS_NOT_A_LIST` so the agent can repair it. The check is the array-ness of the binding and
nothing more: an array whose items are not `{ label, value }` passes validation and reaches the
renderer, which is where a malformed item shows up.

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
