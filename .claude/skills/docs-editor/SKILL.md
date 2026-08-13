---
name: docs-editor
description: Review pass for docs-site prose — a blind reader pass first, then facts, then the EDITORIAL.md checklist. Use after writing or substantially editing an apps/docs page, or when asked for an "Editor-Pass", "Kalt-Test" or a prose review of documentation pages.
---

# The review pass

Three passes, three contexts, in this order. The order is the point: pass 1 decides what the page
must contain, and passes 2 and 3 only work on what survives it. Run it the other way round and the
page gets polished around its holes.

None of them runs in the context that wrote the text — a context does not see its own violations
(measured 2026-08-05/06).

## 1. The reader pass — no source code, no checklist

The instrument that finds what the other two cannot: information the reader needs and never gets,
and paragraphs that teach nothing. Measured 2026-08-06 on `/table/remote-data`: two blind readers
independently named four blockers — an unlisted union of `operator` values, a prop named with no
object to put it on, an undefined "column id", a subscription with no teardown — that two full
checklist passes with source access had both missed. One of them flagged the exact sentence the
maintainer had rejected, unprompted.

**On a component page the reader works from the RENDERED page, not the `.svelte` source.** Every
component page carries a live Playground and generated API/Types tables. A reader handed the source
is blind to all three: they report variant/size questions the Playground already answers and type
shapes the Types section already lists as "never shown", and they cannot see a single visual or
interaction defect. Measured 2026-08-13: a source-only reader marked three Calendar type shapes as
missing that the rendered Types section documented in full. Point the reader at the running dev
server — a text dump plus full-page screenshots, or a browser tab — never the file.

Give the agent the page file **and nothing else**. Explicitly forbid: opening any other file —
including `docs/EDITORIAL.md` and the canon in `apps/docs/canon/`, which would turn the reader
into a reviewer — searching the repo, reading the library source, judging style, proposing
wording, counting words.
Unclear is a finding, not something to go and resolve — the moment the reviewer can look it up,
they stop being able to feel the gap.

Cast them as the reader the page is for: a working developer, solid everyday Svelte and
TypeScript, never used this part of the library, arriving with the concrete task the page's title
promises. Paragraph by paragraph in reading order — headings, tables, code examples and notes
included — four questions each:

1. What can I now do in my own code that I could not a paragraph ago? "Nothing" is an allowed and
   valuable answer.
2. Did I have to read it twice, and which part tripped me?
3. What did I read and discard — not needed for my task, or about the library's inner workings
   rather than my code?
4. What question do I have that the page has not answered?

Then three closing questions: could you write your code without further help and where exactly
would you get stuck; which single paragraph was the most useless; which piece of information did
you need and never got.

**One reader is the default.** Two readers on two versions — same prompt, neutral file names in a
scratch directory, neither told the other exists — is the A/B for when two versions are explicitly
being judged against each other, and runs only when whoever drives the session asks for it.
Agreement between them is a real finding; a stumble only one of them has is usually still the
paragraph's fault, not the reader's.

## 2. The fact pass — with the source

Only for the claims that survived pass 1. Verify every behaviour claim in the package source
(table pages: `packages/table/src/lib/core/table/index.ts`, `core/TableProvider.svelte`,
`types/tableTypes.ts`, `view/observe.svelte.ts`, `view/source.ts`; other packages accordingly).
True and needed information survives — moved if misplaced, never dropped on suspicion. A wrong
claim, and any pass-1 gap that turns out to be an API problem rather than a docs problem, go to
whoever drives the session.

## 3. The checklist pass

`docs/EDITORIAL.md`, every sentence against the sentence items (1–8), then the whole page
against the page items (9–13), reported separately. This is sentence hygiene and the cheapest
of the three — it cannot see a missing paragraph, so it never runs first.

## 4. The demo pass — render and interact

The three passes above read text; none of them renders the page. Layout and interaction defects
survive all three and `validate` too: an overflow example that does not overflow at the page's own
width, an `align` control that never centres the item, a hand-built card where the library's own
`Card` belongs, an arrow jump that leaves items half-visible. After the checklist pass, render the
interactive examples against the running dev server and click through the core interaction each one
claims — the overflow, the binding, the arrows, the keyboard nav — not just the first paint. A real
component defect goes to whoever drives the session (and onto the bug list); a demo
mis-configuration is fixed in the page. Measured 2026-08-12: a full three-pass wave shipped four such
defects that only a human sight-check caught, which is what added this pass.

A screenshot-plus-console-check is **not** this pass. Measured 2026-08-13 on the component pages: a
Playwright pass that only shot each page and read the console passed five defects a human caught in
five minutes — a Playground control whose default contradicted the component's own default, a
control stretched to the full stage width, whitespace left above the controls after a view switch,
untranslated demo labels, and a heatmap cell styled as a clickable button with no action. The pass
has to switch every view, open every menu and dropdown, click the interactive cells, and read every
visible label — then split each finding into a page fix or a component bug. On an interactive
component this pass runs **early**, not last: its findings decide what the prose must cover.

## Gates and reporting

`bunx prettier --write <page>`, then `bun --filter='@urbicon-ui/docs-app' run sections:lint` — and
`examples:budget` when the page is a component page. Green before reporting.

Report as points, not an essay. Pass 1: the blockers, the paragraphs that taught nothing, verbatim
quotes. Passes 2 and 3: each change with what it rests on. And explicitly, anything
`docs/EDITORIAL.md` itself got wrong — guide findings go to whoever drives the session, not into
the guide ("Changing this file" there sets the bar: a rule needs a repeat offender).

The pass commits nothing and stages nothing.
