# @urbicon-ui/chat-demo

A tiny, **local-only** SvelteKit proof-of-concept for the Urbicon UI A2UIView
(Agent-to-UI) surface. A Claude agent answers in prose and, when a form or a
chooser genuinely helps, emits live **A2UI** UI that renders as real Urbicon
components — and the user's interactions with that UI flow back into the chat.

> Not deployed, not published (`"private": true`). No API key lives in this repo.

## What it shows

- **Prompt-first A2UI transport.** The agent writes Markdown and emits UI inside
  a fenced ` ```a2ui ` block as JSONL (one A2UI v0.9.1 envelope per line). The
  system prompt is `a2uiSystemPrompt()` from `@urbicon-ui/blocks` plus a small
  transport section.
- **Incremental client splitting.** `src/lib/a2ui-stream.ts` is a chunk-invariant
  state machine over the token stream: text → text parts; each complete line
  inside a fence → an A2UI envelope appended immutably to the `a2ui` part, which
  A2UIView consumes and renders as it grows.
- **Round-trip interaction.** A Button on a rendered surface becomes a new
  `[ui-action] …` user turn; queued validation errors are reported to the agent
  as a `[ui-error] …` line on the next send.

**Success criterion:** a natural request ("Build me a small booking form for a
haircut appointment.") yields valid, catalog-conformant A2UI payloads with no
validation errors, and interactions with the rendered UI arrive back in the chat.

## Setup

```bash
cp apps/chat-demo/.env.example apps/chat-demo/.env   # then edit .env, set ANTHROPIC_API_KEY
bun install                                          # from the repo root
bun --filter='@urbicon-ui/chat-demo' run dev         # http://localhost:5173
```

The key is read only at **runtime** (`$env/dynamic/private`). If it is missing,
the `/api/chat` endpoint answers `500` with a clear message — the build and
`check` still pass without a `.env`.

## Scripts

```bash
bun --filter='@urbicon-ui/chat-demo' run dev      # dev server (needs .env)
bun --filter='@urbicon-ui/chat-demo' run build    # builds without a key
bun --filter='@urbicon-ui/chat-demo' run check    # svelte-check
bun --filter='@urbicon-ui/chat-demo' run test     # stream-splitter unit tests
```

## How it fits together

```
PromptInput ──▶ /api/chat (+server.ts)  ──▶ client.messages.stream(claude-opus-4-8)
                     │  relays raw tokens as text/event-stream (token/done/error)
                     ▼
        A2uiStreamSplitter (src/lib/a2ui-stream.ts)
                     │  text parts + a2ui parts (growing envelope arrays)
                     ▼
ChatMessageList ▶ ChatMessage ▶ partRenderers.a2ui ▶ A2UIView
                     │  onAction / onValidationError
                     └────────────▶ back into the chat as a new user turn
```
