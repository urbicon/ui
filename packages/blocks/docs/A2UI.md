# A2UI — agent-generated UI in a chat

`A2UIView` renders [A2UI](https://a2ui.org) (Agent-to-UI, protocol 1.0) envelopes into live Urbicon
components: the agent describes a form, the user fills it in, and the values flow back. This guide
covers what the types cannot tell you — how a surface behaves over a whole conversation, and which
of its rules the protocol enforces rather than the renderer.

> Stability: **experimental**. The pieces below are shipped and tested, but the API may still move.

## The pieces

| Piece                                        | What it does                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a2uiSystemPrompt()`                         | The catalog contract: every component, prop and enum the agent may use. Generated from the same registry the validator checks against, so prompt and validation cannot drift.                                                                                                         |
| `a2uiFencedTransportSection()`               | How envelopes travel — the agent writes prose and opens a ` ```a2ui ` fence — and what a later turn may do with a surface. The prompt half of `A2uiStreamSplitter`.                                                                                                                   |
| `A2uiStreamSplitter`                         | Turns a token stream into ordered message parts — text, and `a2ui` parts whose payload grows envelope by envelope.                                                                                                                                                                    |
| `A2uiSurfaceRouter` + `routeMessageParts()`  | Delivers envelopes to the message that owns their surface, so an agent can patch a form it sent two turns ago.                                                                                                                                                                        |
| `a2uiActionMessage()` / `a2uiErrorMessage()` | Write the action and error turns a transport section tells the agent to expect, from the same options.                                                                                                                                                                                |
| `validateA2uiPayload()`                      | The issues `A2UIView` reports, without a DOM — for a server.                                                                                                                                                                                                                          |
| `A2UIView`                                   | Renders one payload. Fail-loud and whitelist-only: unknown components and undeclared props never reach the DOM, and neither does a function-call binding — except the logic functions `not`, `and`, `or` and the system function `@index`, which compute a value and execute nothing. |

```ts
// Server — the system prompt, assembled from the shipped pieces.
const system = [
  a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
  a2uiDataSchemaSection(MY_SCHEMA), // optional: type-check the data model
  a2uiFencedTransportSection(),
  MY_DOMAIN_RULES // yours: which tools to call, what never to invent
].join('\n\n');
```

```svelte
<!-- Client — one splitter per model round, one router per conversation. -->
<A2UIView
  payload={part.payload}
  streaming={message.status === 'streaming' || patchTargets.has(message.id)}
  catalogs={[urbiconA2uiCatalog]}
  onAction={(event) => sendUserTurn(a2uiActionMessage(event))}
  onValidationError={(issues) => queueForAgent(issues)}
/>
```

`a2uiActionMessage()` writes the turn the transport section describes; give both the same options
when you change a prefix. Every piece in the table but `A2UIView` also loads from
`@urbicon-ui/blocks/a2ui`, the engine without Svelte — the entry a server imports. A runtime that
does not compile Svelte, such as plain Node or `bun test`, loads that entry and fails on the package
root.

**Hold the messages that reach `payload` in `$state.raw`.**
The view appends only while the envelopes it already applied arrive as the very same objects, and
rebuilds otherwise, dropping what the user typed. A deep `$state` wraps an object assigned to it in
a proxy of its own, so the snapshot a splitter hands over reaches the view as new
objects on every update. `revokeMessage()` finds a patch's envelopes by reference as well, and
through a deep `$state` finds none to take back.

## What of A2UI 1.0 the engine speaks

The engine is a renderer for the protocol's surface messages and deliberately stops short of its
function calls. What an envelope may carry, and what becomes of it:

| Part of the protocol                                   | Here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"version": "1.0"`                                     | The only version accepted. An envelope of an earlier one is an `INVALID_VERSION` error and applies nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `createSurface`                                        | With `catalogId`, `sendDataModel`, and — inline — `dataModel` and `components`: one message can carry the whole surface, the data model applied first. `metadata.extensions` is validated and otherwise ignored. `theme` left the protocol and is an error.                                                                                                                                                                                                                                                                                            |
| `updateComponents`, `deleteSurface`                    | A component is replaced by id; a deleted surface frees its id.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `updateDataModel`                                      | `value` is required. `null` deletes the key at `path`, and at the root empties the model; a message without `value` is an error and changes nothing. A message that would nest the model deeper than 64 levels — an inline `createSurface.dataModel` too — is a `MAX_DEPTH` error and is not applied.                                                                                                                                                                                                                                                  |
| `{ "@path": … }`, `{ "@call": …, "args": … }`          | The binding and the function call. In a list template a path without a leading `/` is relative to the item, and `""` is the item itself. An object with plain `path` or `call` keys is a literal: on a prop that takes a binding it is a type mismatch whose message names the 1.0 form, and in an action's `context`, where a literal is legal, one with exactly those keys is sent as written, with a `TYPE_MISMATCH` warning. In a literal object a key with one leading `@` is reserved (`INVALID_RESERVED_KEY`); `"@@type"` is `@type`.           |
| `@catalogId`, `@accessibility`, `@checks`, `@metadata` | The keys every component may carry beside its catalog's props. See [Two catalogs](#two-catalogs), [Accessibility](#accessibility) and [Gating a control](#gating-a-control-on-the-data-model); `@metadata` is validated and dropped.                                                                                                                                                                                                                                                                                                                   |
| Component ids                                          | Identifiers: letters, digits and `_`, no hyphen, no leading digit. Another id is an `INVALID_ID` error; the component still renders under it.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `@index`                                               | The 0-based position of a list template's current item, plus `args.offset`. On a component that renders outside a template it is an `INDEX_OUTSIDE_TEMPLATE` error.                                                                                                                                                                                                                                                                                                                                                                                    |
| Catalog functions                                      | `not`, `and`, `or` are evaluated, on a gate; `openUrl` runs as a Button's `functionCall` action, through `urlPolicy`, once its catalog resolves and its `url` is a string or a binding. Another key on the call, an unknown catalog or a `url` of another type is an error, and the action is dropped: a Basic `Button`, which requires one, renders as a fault chip. Every other one (`formatString`, `required`, `regex`, …) resolves to nothing, with a `FUNCTION_CALL_UNSUPPORTED` warning; as a `functionCall` action it leaves the button inert. |
| `callRendererFunction`, `agentFunctionResponse`        | Recognised and refused: no function here may be called by the agent, and the engine calls none on the agent. Each is an `INVALID_FUNCTION_CALL` error that carries the `functionCallId` — what a transport needs to answer the call with a `rendererFunctionResponse` error.                                                                                                                                                                                                                                                                           |
| `allowedParents` / `allowedChildren`, capabilities     | Not read. No shipped catalog declares composition constraints, and capabilities are exchanged by the transport.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

A pointer — a `path`, a `{ "@path" }` binding — follows RFC 6901, except that empty segments
collapse, as upstream's A2UI conformance suite defines: `/foo/` is `/foo`, `//a///b//` is `/a/b`,
and `/`, like `""`, is the whole model. So no pointer addresses a key `""`.

The data model nests at most 64 levels, and every write into it takes one path —
`updateDataModel`, an inline `createSurface.dataModel`, and what the user types into a bound field.
A message's `path` of `""` or `/` replaces the whole model; a user's edit never does. A write
creates what its path passes through where that is missing or `null`, so a field bound to
`/guests/1/name` takes the user's typing before the agent has sent any guests: an index past the end
of a list leaves the gap as holes, which read as missing and serialise as `null`, and `-` appends.
It never replaces a string, number or boolean with a container: a path that runs through one —
`/user/name/first` onto `"Alice"`, or `/a` onto a model the agent replaced with `1` — is refused.
So is a `path` that is neither `""` nor starts with `/`, holds a `~` not followed by `0` or `1`,
has a segment into a list that is no index (`01`, `name`), or adds a list item above index 10000;
and a write that would pad a surface's lists with more than 10000 empty slots in all, every slot a
message or a user's edit has padded since `createSurface` counted. Each is a `POINTER_ERROR`, and
nothing is written.

A binding, and a list template's `path`, is read by the same rules. One with a `~` not followed by
`0` or `1` is a `POINTER_ERROR` and resolves to nothing — a key that holds a `~` is addressed as
`~0`. One with more segments than the model has levels, a template item's scope included, is a
`MAX_DEPTH` error and resolves to nothing — on a gate such as `disabled`, to its failsafe. A
template whose `path` is refused renders no items. An action's context literal nested deeper than
64 levels is a `MAX_DEPTH` error too, and the action is dropped.

An input is disabled for any reason a user's edit at the pointer of its binding would be refused:
the pointer is refused on its own, as above; it runs through a string, number or boolean the model
holds now, the root included; it has a segment into a list that is no index; it adds a list item
above index 10000; it would pad past the surface's 10000 slots; it has no segments — `""` or `/`
outside a list template, `//`, an absolute `/` inside one — so the edit would replace the whole
model; or what the input writes would nest the model past 64 levels, as the list a `ChoicePicker`
or `Select` writes does at a pointer of 64 segments. In a template, `""` is the item and takes the
edit. Every reason but the first is an issue on the input — a `MAX_DEPTH` for the depth, a
`POINTER_ERROR` for the rest — from `onValidationError` and `validateA2uiPayload` alike, and both
are recomputed from the data model: the `updateDataModel` that makes room for the write enables the
input and clears the issue. A pointer of no segments, or one too deep, keeps the input disabled
until the agent binds it to another.

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
messages = result.messages; // patches already delivered into earlier payloads
storeParts(result.parts); // this message's own parts, foreign envelopes removed
queueForAgent(result.issues); // e.g. a re-used surfaceId — a protocol slip worth reporting

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
   to the data model (`value: { "@path" }`) — the selection highlights instantly, no round-trip. A row
   of buttons that each set a value shows no selected state and costs a turn per tap.
3. **The agent is the only validator.** The client submits whatever it is given, so an action that
   arrives with required fields empty should be answered with a patched hint next to the field,
   not carried out.

Set `sendDataModel: true` on `createSurface` and every action from that surface additionally carries
the full data model (`A2uiActionEvent.dataModel`), read at click time. It is the antidote to an
under-specified `action.context`.

An action can also say what the user did in the agent's own words: `action.event.userMessage`, a
string or a binding, arrives resolved as `A2uiActionEvent.userMessage` — a line you can show as the
user's turn instead of the raw event.

## Gating a control on the data model

A binding resolves a pointer and nothing else, so `disabled: { "@path": "/agreed" }` gates the wrong
way round. A2UI's Basic catalog defines three logic functions for this, and they are the only
function calls a binding may use:

```jsonc
{
  "id": "book",
  "component": "Button",
  "child": "bookLabel",
  "action": { "event": { "name": "book" } },
  "disabled": { "@call": "not", "args": { "value": { "@path": "/agreed" } } }
}
```

`not` takes `args.value`; `and` and `or` take `args.values`, two or more. Each operand is `true`,
`false`, a `{ "@path" }` binding or another of the three — never another function, such as the
`required` that A2UI's own examples nest inside `and`.

- **A value counts as A2UI coerces a boolean.** `true`, the string `"true"` in any letter case, a
  number other than 0 and a validation result with `valid: true` count as true; `undefined`, `null`,
  every other string, `0` and every other object or array count as false. A path nobody has written
  yet is therefore false, so the button above starts disabled without the agent having to initialise
  `/agreed`. A plain `disabled: { "@path": … }` is read the same way, and so is a CheckBox's bound
  `value`: `"yes"` disables nothing, and `"false"` does not either.
- **Accepted only on a gate** — a boolean prop whose catalog entry says what it fails closed to:
  `Button.disabled` in the Urbicon catalog. Not on an input's `value`, which records what the user
  does and must stay a `{ "@path" }`, and not on a string or number prop: both are a `TYPE_MISMATCH`
  error, and the prop is dropped.
- **A broken gate fails closed.** A value on `disabled` that cannot be used — a malformed call (an
  unknown key, a single operand for `and`), one nested or branching past the engine's caps, one
  naming any other function at the top or nested, one whose catalog does not resolve, a non-boolean
  literal such as `"true"`, a poisoned path — is an error, and the button stays disabled until the
  agent replaces it. Elsewhere, a function call other than these three and `@index` resolves to
  nothing, with a `FUNCTION_CALL_UNSUPPORTED` warning.
- **A call runs in a catalog.** It may name one with `catalogId`; without, it runs in the surface's
  default. All catalogs of the engine carry the three functions, so this decides one thing: a call
  that reaches no configured catalog — an unknown `catalogId`, or none on a surface that has no
  default — is not evaluated.
- **`action.event.context` evaluates them too**, at click time, so the event carries the boolean. A
  malformed one is an error, and its key travels as `undefined`: context has nothing to fail closed
  to.
- **`@checks` gates the button too.** A2UI's own form of this gate is a list of rules on the Button,
  `"@checks": [{ "condition": { "@path": "/agreed" }, "message": "…" }]`. Today only the Urbicon
  `Button` evaluates `@checks`: the button is disabled while any condition does not count as true —
  read like an operand, so a condition may also resolve to a validation result — or while `disabled`
  asks for it. A list the engine cannot evaluate is an error and holds `disabled` at `true`: a rule
  with a key other than `condition` and the optional `message`, a literal condition (A2UI 1.0 takes
  a binding or a call there), a list holding more operands than one call may when counted as an
  `and` over its conditions, or a condition `disabled` would refuse, `required` and `email` among
  them. `required` stays out on purpose: upstream counts `false` as a value, so it would pass for a
  box the user unticked. The `message` is not rendered. A bare `checks`, the key before 1.0, is an
  `UNKNOWN_PROP` error that holds `disabled` at `true` as well. Every other component, every Basic
  one included, ignores `@checks` with an `IGNORED_PROP` warning.
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
lost a required prop renders as a fault chip — neither counts, and nor does one whose
`@accessibility.hidden` is true, or that of a component around it, which no one can operate. With
`path`, its `value` (or the prop named in `prop`) must also be a `{ "@path" }` binding that resolves
to that pointer, template scope included. One component meets one entry, so two `Checkbox` entries
ask for two boxes; the entries are matched to your components as a whole, so an entry is missing
only when no assignment of the rendered components could meet it.

Each unmet requirement is one `MISSING_REQUIRED_COMPONENT` issue on `onValidationError`, and only
once `streaming` is false: a surface arrives over several envelopes, and A2UI has no message that
marks one complete, so the end of the turn that built or patched it is the earliest point at which
"missing" is true. It is an error so it travels the channel you relay, and the model can patch the
surface; nothing is thrown, and the surface renders as it stands. A surface whose id has no entry is
not checked. Without the view,
`validateA2uiPayload(payload, { catalogs: [urbiconA2uiCatalogSpec], surfaceRequirements })` reports
the same issue on a server: it takes the view's options, as specs, and holds Basic first as the view
does. Leave out `catalogs` and it knows Basic alone, like a view without them, so an Urbicon entry is
an `INVALID_REQUIREMENT` warning and never checked.

Which catalog a surface defaults to is the model's choice. An entry that catalog cannot hold
(`Checkbox` is the Urbicon spelling, `CheckBox` the Basic one) is still checked, because a component
may name its own catalog: it fails as `MISSING_REQUIRED_COMPONENT`, and the message names the
`@catalogId` the component needs. The prompt states it up front: `a2uiSurfaceRequirementsSection`
names the catalogId next to each surfaceId.

An entry no catalog of the view can meet — a component none of them has, a prop the component does
not declare, a relative `path` — is your mistake, not the model's. The view reports it once, as an
`INVALID_REQUIREMENT` warning when the surface is created, and leaves it unchecked;
`a2uiSurfaceRequirementsSection` leaves it out of the prompt, so the model is never asked for it.

## Options that come from fetched data

The pattern behind every "load the choices, then let me pick" flow: write the fetched list into the
data model and bind the chooser to it, rather than rewriting the component for each result.

```jsonc
{"version":"1.0","updateDataModel":{"surfaceId":"booking","path":"/slots",
  "value":[{"label":"09:00","value":"09:00"},{"label":"13:45","value":"13:45"}]}}
{"version":"1.0","updateComponents":{"surfaceId":"booking","components":[
  {"id":"pick","component":"RadioGroup","value":{"@path":"/time"},"options":{"@path":"/slots"}}]}}
```

While `/slots` is still absent the chooser renders empty and stays silent — that is the normal
mid-flow state. Once it resolves to something that is not an **array**, the view reports
`OPTIONS_NOT_A_LIST` so the agent can repair it. The check is the array-ness of the binding and
nothing more: an array whose items are not `{ label, value }` passes validation and reaches the
renderer, which is where a malformed item shows up.

## Reporting problems back

`onValidationError` fires with every issue the payload produced, each carrying a `severity`. The
error-severity ones are shaped like A2UI's `VALIDATION_FAILED` error and can be relayed as one
verbatim. For a chat transport, `a2uiFencedTransportSection()` tells the agent to expect them behind
a `[ui-error]` prefix and re-emit a corrected surface, and `a2uiErrorMessage(issues)` writes that
turn, with the issues grouped by surface so each `surfaceId` is written once as a field. Warnings
are degradations the surface survived — worth logging, rarely worth a round-trip. Router issues are
the exception: a re-created `surfaceId` is a protocol slip, so relay it even though it is only a
warning.

On a server, `validateA2uiPayload()` returns the issues the view reports through
`onValidationError` once `streaming` is false, built by the same function the view uses; give it the
view's `catalogs`, `dataSchema` and `surfaceRequirements`, as specs. What only the view can see is an
issue that reads the data model after the user changed it.

## Accessibility

`@accessibility` is the protocol's, so every component of every catalog takes it:
`{ label?, description?, live?, hidden? }`. `label`, `description` and `hidden` may be bound. An
object with any other key, or a key of the wrong type, is an error and is dropped whole.

- **`label`** names the element that takes focus, or the group around a component's controls. A
  component that takes none is named through its role, and a labelled `Column` or `Card` becomes a
  group; a `Text` has no role to name. The label outranks the visible one and is never shown, so it
  must contain its text (WCAG 2.5.3, Label in Name). A control without a `label` of its own shows
  none: give it one where sighted users need to see what it is for.
- **`description`** is the accessible description of the same element, read after the component's
  own `error` where it shows one. On a time field — a `TimeInput`, or a `DateTimeInput` with only
  `enableTime` — the label names the group around the segments, and the description goes to each
  segment, where the field puts its own messages.
- **`live`** (`off`, `polite`, `assertive`) is the `aria-live` of the component's root.
- **`hidden: true`** wraps the component in an element that is `inert` and `aria-hidden`: it and its
  children leave the accessibility tree, the tab order and pointer input, and stay visible. It is
  for decoration and repeated content. `aria-hidden` alone would leave a control focusable that a
  screen reader is told does not exist. The wrapper is there whenever `hidden` is declared, so a
  bound value toggles it in place; declaring `hidden` on a component already on screen mounts it
  afresh, and an input with a literal `value` loses what the user typed.

## Two catalogs

`A2UIView` always understands the **Basic** catalog: a subset of upstream's `basic` catalog, major
version 1 — a surface that names upstream's id for it resolves to the subset too. Passing
`catalogs={[urbiconA2uiCatalog]}` adds the **Urbicon** catalog — real intents and sizes, `Section`,
`RichText`, `Accordion`, `DatePicker`, `Slider`.

A surface names its default catalog with `createSurface.catalogId`, and a single component another
one with `"@catalogId"`, so one surface can mix both: a Basic `ChoicePicker` beside an Urbicon
`Badge`. Each component is validated against its own catalog and rendered by that catalog's
dispatcher.

**Nothing falls back.** A `catalogId` no catalog of the view answers to is an `UNKNOWN_CATALOG`
error, and so is a component's `@catalogId`; a component on a surface without a default needs its
own. What does not resolve renders as a fault chip. Use the matching spec
(`urbiconA2uiCatalogSpec`) when building the prompt; the two must agree or every component in the
payload is unknown.

The Urbicon prompt is capped at 24 kB by a test, deliberately: a bloated prompt measurably degrades
conformance. If you add catalog entries, keep descriptions tight and let the generated prop types
carry the mechanics.

## In an MCP App

This guide covers a chat. In an MCP App the agent sends the envelopes as a tool's arguments, each
call of that tool opens a view of its own, and no later call reaches an earlier one, so the rules
`a2uiFencedTransportSection()` gives the agent do not hold there. The library ships no transport for it. The
[8.38.0 entry of the blocks migration guide](https://github.com/urbicon/ui/blob/main/packages/blocks/docs/MIGRATION.md#8380)
says where a transport of your own starts and links the removed one as a template.
