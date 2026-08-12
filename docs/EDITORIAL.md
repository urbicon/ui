# Editorial Guide

How the prose that reaches a consumer developer is written: docs-site pages and package
READMEs. Page *structure* is [DocsPageGuide.md](DocsPageGuide.md); prop JSDoc is the
`component-metadata` skill; `docs/internal/` is exempt.

## Who we write for

Someone with ten minutes and a task. They land mid-page from a search, they want the
component running in their own project, and they will leave as soon as it does. Success
looks like this: they copy the first example, it works, they adjust two props, they're gone.
A reader who leaves after the first example had a good visit.

Three goals, in this order:

1. **Lower the barrier.** The shortest path from "never seen this" to "runs in my project".
2. **Don't bury.** A page answers one question. Everything else is a link.
3. **Make it pleasant.** Reading should feel like a colleague showing you something,
   not like sitting an exam.

Two principles outrank every rule in this file. The reader's work is the measure, not the
word count: short is a means, and cutting helps until the remaining sentence has to be
read twice. And nobody reads in order: people land mid-page from a search, so the top of
a page stays light and the detail sits where a stuck reader jumps to.

## Canon

The Svelte docs. Three pages are vendored in
[`apps/docs/canon/`](../apps/docs/canon/README.md) so you read them locally instead of
fetching them. Read them before writing, not for inspiration but for calibration:

- [getting-started.md](../apps/docs/canon/getting-started.md) shows how little a page can
  contain.
- [what-are-runes.md](../apps/docs/canon/what-are-runes.md) shows how to introduce a
  concept: a definition, one snippet, three bullets on what makes it different, done.
- [effect.md](../apps/docs/canon/effect.md) shows how a reference page is built. For
  drafting, the opening sections and "When not to use `$effect`" carry the patterns; the
  sub-rune sections in between are there for completeness.

What they do that we copy:

- **The first sentence says what it is and names two or three concrete things you'd use it
  for.** Uses, not categories. The `$effect` page opens with effects and immediately lists
  third-party libraries, canvas drawing and network requests, all in the same sentence.
- **The most common mistake is the second thing on the page,** in plain prose with a link
  to the alternative, instead of a warning box at the bottom.
- **Code teaches, prose introduces.** One or two sentences lead into a snippet; the actual
  learning happens in the snippet, carried by comments like *this will re-run whenever
  `color` changes*.
- **Permission sentences.** "You don't need X for now; come back to it later." One line,
  and it takes weight off the reader.
- **Advanced features say they're advanced** and sit at the bottom of the page.
- **Anti-patterns are code pairs.** "Instead of this…" (snippet) "…do this:" (snippet).
  No lecture in between.
- **A little repetition is welcome.** Sections repeat a short clause instead of sending the
  reader back up the page.

## Page shape

1. What it is, and when to reach for it. One or two sentences — one, for a primitive whose function
   is already known, with no marketing in the hero. The Playground speaks first; orientation beyond
   that sentence moves to a section below.
2. The smallest working example. Complete, copy-paste-runnable, imports included.
3. The two or three props everyone will touch, each shown as a one-line change to the
   first example.
4. Common variations and recipes.
5. Exceptions and advanced use, labeled as such.

## Model paragraphs

These set the register. API details in them are illustrative; verify names against the
source before shipping anything. When a shipped page has a better paragraph than these,
swap it in: the samples here do more work than the rules below.

**Introducing a feature:**

> `<Table>` renders the rows you pass it. When the data lives on a server, give it a
> `source` with a `query` function. The table calls it whenever the user sorts, filters or
> changes the page:
>
> ```svelte
> <Table source={{ query: loadUsers }} />
> ```
>
> `loadUsers` receives the current page, sort and filters, and returns the rows plus
> `total` so the table can build its pagination.

**A permission sentence:**

> You don't need `processing: 'server'` for a few hundred rows. Pass them as `items` and let the
> table sort in the browser.

**The same fact, before and after:**

> ❌ The table's reconciliation layer memoizes the query descriptor, ensuring the fetch
> pipeline is only re-invoked when a semantically relevant axis of the view state changes.
>
> ✅ The table calls `query` again when the user changes the page, sort or filters.

## Voice

- Second person, present tense. The subject of the sentence is *you* or the code you write.
- The API's own names: `source.query`, `total`. Never a noun invented for the page.
- Plain words before precise-sounding ones: *file* over *ledger*, *setting* over *axis*.
- Every sentence should survive being said out loud to a colleague. If it sounds like a
  spec, rewrite it. If it sounds like marketing, cut it.
- State what happens. A sentence about what does *not* happen earns its place only when
  the behaviour contradicts a reasonable expectation, and a component that regularly
  contradicts expectations has an API problem, not a documentation problem.
- No dash rhythm. An em-dash that sets up a contrast or delivers a verdict reads as
  generated prose. Use a period, a colon, a semicolon or parentheses.
- Internals appear only when the reader writes different code once they know them. The
  dependency-tracking section of the `$effect` page is the calibration point: it describes
  internals, and it stays, because you structure your code around it. *What the library
  compares before re-running* is the kind that goes.

## Process

Rules sitting in context do not prevent the patterns while writing; a separate pass
catches them. Three steps:

1. **Draft as an answer.** Phrase the page as a question a real user asks ("How do I show
   server data in the table?"). Write the answer the way you'd type it to a colleague in
   chat, with the model paragraphs and the canon open next to you. Structure it afterwards.
2. **Fresh reader with a task.** A context that has never seen the draft, the canon or
   this guide gets the page with one instruction: *"Get this running from zero. Note every
   point where you stall, every sentence you skip, everything you needed and didn't
   find."* Skipped sentences mark the passages that describe instead of enable.
3. **Checklist.** Sentence hygiene, last.

Steps 2 and 3, together with a fact-verification pass against the component source, are
the `docs-editor` skill; run it after writing or substantially editing a page. Every
behaviour claim is checked there before a page ships.

## Checklist

Sentence items (1–8), then page items (9–13).

1. Announcements and self-narration ("In the following section…") → cut. A cross-link is fine.
2. Padding: adjectives whose opposite we'd never ship (powerful, seamless), list items
   added for cadence, cheerleading → cut.
3. A sentence restating what the snippet or demo already shows → cut. Say what neither
   shows: when to reach for it, what it costs, what breaks.
4. Internals with no consequence in the reader's code → cut. If the reader can't use the
   API without knowing them, that's an API finding. File it.
5. Nouns invented for the page → the API's own names.
6. A sentence about what does not happen → cut it and state the behaviour. Keep it only
   for an error someone actually hit; if readers keep needing the sentence, file an API
   finding instead.
7. Em-dash contrasts and verdicts → a period, a colon, or parentheses.
8. A bare category ("it is a controlled prop") → keep the consequence, drop the category.
9. Every section answers the question the page was opened for. A section answering another
   page's question moves there; one sentence and a link stay behind.
10. Before the first code block: at most three sentences of prose.
11. Three parallel cases in prose → a table, if item 9 lets all three stay. On a component
    page, a hand-written prop or type table → `<ApiReference>` / `<TypesReference>`; copies
    drift.
12. One example demonstrates one thing. Two things, two examples.
13. A note box only for behaviour that has cost someone time and that nothing catches.
    Everything else is a plain sentence in the section.

## Where facts live

Every fact has one home. A rule about a single prop belongs in its JSDoc, which is
generated onward into the API table, `llm.txt` and MCP. How props relate and when to reach
for which belongs on the page. Why a lint rule exists belongs in that script's header.
Exhaustive is the system; the page stays minimal.

## Changing this file

Budget: one page. A new rule needs a second offender; a single finding belongs in the
change that found it. Keep the model paragraphs current. They are the part of this file
that actually gets imitated.
