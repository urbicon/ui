# AI Chat

Conversational surface for an LLM assistant or copilot — a streaming message log with a composer, optionally split alongside an artifact the assistant is producing.

## Layout

- **Structure:** `Chat` is the shell — a pinned `header`, the scrollable conversation as `children` (a `ChatMessageList`), and a pinned `composer` (a `PromptInput`) at the bottom. The shell itself never scrolls; its body child does.
- **Full height, `min-h-0` chain:** the surface fills its parent. `Chat` uses `min-h-0` flex discipline internally, but every ancestor from the page down to `Chat` must also be a `min-h-0` flex/grid child (or a fixed height like `h-[40rem]`) — one `min-h-auto` link in the chain and the log grows the page instead of scrolling inside itself.
- **Width:** cap the reading column (`max-w-3xl`–`max-w-5xl`, centered) for a standalone chat. A docked copilot fills its panel; a chat-plus-artifact layout puts `Chat` in one `SplitPane` pane and the artifact (editor, preview, table) in the other.
- **Density:** `ChatMessage` `layout="bubble"` for a messaging feel, `layout="plain"` for a document/transcript feel; `density` tightens vertical rhythm for information-dense copilots.

## Component Selection

| UI Need | Component | Configuration |
|---|---|---|
| The whole surface | `Chat` | `header` / `children` / `composer` snippets — pure structure, no state |
| The conversation log | `ChatMessageList` | `messages`, `onRegenerate`, `onRetry`, `onStickChange`; `layout` / `density` passed through to each message |
| One message | `ChatMessage` | Rendered per entry by default; override the `message` snippet only for a bespoke row |
| The composer | `PromptInput` | `onSubmit({ text, attachments })`, `onStop`, `busy`; `allowAttachments` + `accept` / `maxFiles` for files |
| Markdown answer | `StreamingMarkdown` | The default text-part renderer — settles block by block, repairs the streaming tail, no `{@html}` |
| A tool invocation | `ToolCallCard` | The default tool-call-part renderer — a muted status row, JSON input/output, auto-open on error; `variant="card"` frames it for a trace view; replaceable via `partRenderers['tool-call']` |
| Model reasoning | `ReasoningDisclosure` | The default reasoning-part renderer — collapsed "Thought for Xs", pulsing while streaming; replaceable via `partRenderers['reasoning']` |
| A cited source | `CitationChip` | `[n]` markers in markdown resolve to chips when `sources` are supplied; policy-checked link |
| Chat + artifact layout | `SplitPane` | Chat in one pane, the live artifact (editor / preview / table) in the other |
| Empty state | `ChatMessageList` `empty` snippet | Or `emptyTitle` / `emptyDescription` — a prompt to start |

## Visual composition

A conversation nests deeper than any other surface in this library — shell → message → tool call → payload — which makes it the one place where framing mistakes compound. Three rules keep it readable.

- **Only the outermost frame draws an outline.** A block that frames itself *and* is framed by its parent stacks two outlines at the same radius, which reads as depth that is not there. `CodeBlock` has `variant="plain"` (no surface, outline, radius or padding) for exactly this: `ToolCallCard` renders its JSON payloads with it, and any custom `partRenderers` block inside a card should too. The parent owns the frame, the child owns the content.
- **Machinery is not content.** A reader following an answer is not reading the tool calls, so the two parts that report *how* the answer was produced share one register, down to the numbers: `ToolCallCard` (default `variant="plain"`) and `ReasoningDisclosure` are both text-width rows — `inline-flex w-fit`, `py-1`, tertiary ink hovering to `primary-text`, a 14 px chevron — with their expanded body indented by `pl-3` instead of boxed. Change one, change the other. Reach for `variant="card"` only on a surface someone opened to read the calls themselves — an agent trace, a run log.
- **Differentiate message surfaces by tint, not by border.** `ChatMessage` tints the assistant bubble (`surface-elevated`) and the user's (`primary-subtle`) and draws no outline on either. Adding one per message turns a conversation into a stack of boxes.
- **One caption per thing.** A section heading above a block whose own header repeats the same fact ("Input" over "json") is one chrome row too many. Pass `label` to the block instead.

Radius follows the tier system rather than per-component values: the bubble rides `bridge` (6 px, it is content), framed blocks ride `contain` (2 px, they are panels), the composer rides `modify`. Retune brand-wide through `--radius-bridge` / `--radius-contain`, never by overriding a single slot — see [principles.md §Semantic Radius Tiers](../principles.md).

## Streaming states

A message's `status` is the state machine; the consumer owns `ChatMessageData[]` and patches it as tokens arrive (never mutate the array element — replace it by `id`).

- **`streaming`** — tokens append in place to the last assistant message; `ChatMessageList` shows the live cursor and, while the reader is pinned to the bottom, follows the growth.
- **`complete`** (or omitted) — the settled answer.
- **`error`** — the request failed; the message switches to its failure presentation with a **Retry** action (`onRetry`).
- **`aborted`** — the user pressed **Stop** (an `AbortController` cancelled the request); same Retry affordance.
- **Stop / Retry / Regenerate:** `PromptInput`'s send button flips to a Stop button while `busy`. `onRegenerate` (wired to the last assistant message) drops that turn and re-runs; `onRetry` re-runs a failed/aborted turn.

## Scroll behavior

- **Stick-to-bottom:** the list follows new content *only* while the reader is at the bottom. Scroll up mid-stream and it stops following, surfacing a floating jump-back button with a new-message count. `onStickChange(stuck)` reports the transition.
- **Prepend history:** loading older messages above anchors the scroll position — the reader's current message stays put instead of jumping. Prepend to the front of `messages`; the engine handles the anchor.
- **Announcements:** generation start and the completed answer are each announced once to screen readers — not every token.

## Security

- **No raw HTML.** Assistant text is parsed into a component tree by `StreamingMarkdown` — there is no `{@html}` anywhere. Never route model output through `{@html}` yourself.
- **Strict URL policy, block-by-default.** Every link (markdown links, `CitationChip` sources, attachment URLs) is checked before it can reach the DOM. Images are **blocked by default** — an LLM- or server-supplied image URL is untrusted input and is never rendered inline. Attachment `url`s render only as a policy-checked download link, never as an `<img>`/`<iframe>`.
- **Attachments are input, not output.** Files from `PromptInput` are the user's; ownership of their preview URLs transfers to your message list on submit.

## Accessibility

- The conversation log is a `role="log"` region with `aria-live="off"` — token-by-token live output would flood a screen reader. A separate polite status region announces generation start and the finished answer once each (handled by `ChatMessageList`; supply `generatingLabel` / `errorLabel` / `abortedLabel`).
- The composer textarea is labelled (`label`); the send/stop/attach buttons carry accessible names (`sendLabel` / `stopLabel` / `attachLabel`).
- Keep the send affordance keyboard-reachable and honor `submitOn` (`enter` vs `mod-enter`) so multi-line composition is possible.

## Anti-Patterns

- Do not render assistant output with `{@html}` or as an inline image — the whole point of `StreamingMarkdown` + the URL policy is to keep untrusted model output out of the DOM as markup.
- Do not mutate a message object in place to append a token (`msg.parts[0].text += delta`). Replace the message by `id` so its identity changes and the render updates — `messages = messages.map(m => m.id === id ? { ...m, parts } : m)`.
- Do not use `EventSource` for the stream. You need to POST the message history, and `EventSource` is GET-only — read the response as a `ReadableStream` instead.
- Do not force-scroll to the bottom on every token. That fights the reader who scrolled up; rely on the stick-to-bottom engine and its jump-back pill.
- Do not put `Chat` inside a scrolling `min-h-auto` ancestor. One non-`min-h-0` link breaks the height chain and the log grows the page.
- Do not hand-roll the message row when `partRenderers` will do — override renderers for tool calls / reasoning, not the whole `message` snippet.
- Do not put a framed block inside a framed block. A default `CodeBlock` (or your own bordered card) inside a `ToolCallCard` stacks two outlines at the same radius; use `variant="plain"` for the inner one.
- Do not frame tool calls in a chat stream. `variant="card"` belongs to trace and log surfaces; in a conversation it turns every call the model makes into a box the reader has to step over.
- Do not outline message bubbles. They differentiate by tint; a border per message turns the conversation into a stack of boxes.
- Do not reach for a raw radius (`rounded-lg`) on a chat surface. Use the tier tokens so a brand can retune the whole family at once.
- Do not index `messages` position to identify a turn in `{#each}` — key by `message.id`.

## Related

- Component: `Chat`, `ChatMessageList`, `ChatMessage`, `PromptInput` — the surface; `StreamingMarkdown`, `ToolCallCard`, `ReasoningDisclosure`, `CitationChip` — the parts
- Recipe: `ai-chat` — complete production-ready code (SSE endpoint + streaming client)
- Pattern: `dashboard` — when the copilot is one docked panel among analytics
