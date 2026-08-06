# Editorial Guide

How the prose that reaches a consumer developer is written — docs-site pages, package READMEs,
head comments. Page *structure* is [DocsPageGuide.md](DocsPageGuide.md); what belongs in prop
JSDoc versus on a page is the `component-metadata` skill; `docs/internal/` is exempt.

Use this file as a process, not as writing instructions. Rules sitting in context do not prevent
the patterns while writing — a separate editing pass catches them (measured 2026-08-05: nine
violations in a draft written with this file in context, all found by the pass). Write from the
principles and the canon; audit with the checklist. The `docs-editor` skill runs that pass in a
fresh context.

## Principles

**How much work the reader does to understand** outranks every rule below. Where they disagree,
the rule is what needs fixing.

- **Plain words before precise-sounding ones.** *File* over *ledger*, *setting* over *axis*,
  *control* over *knob*. Define a term only when no plain word exists.
- **Short is a means, not the goal.** Cutting helps until the remaining sentence has to be read
  twice.
- **One page, both readers.** A newcomer acts on the opening of a section; the experienced reader
  finds the exception further down. Common case first, exception after — in every section.
- **Nobody reads in order.** Readers land mid-page from search or a link. Every section stands on
  its own; repeating a short clause beats sending the reader back up.

## Canon

Write like these pages — structure, register, length:

- `apps/docs/src/routes/table/remote-data/+page.svelte` — the compact case: one mechanism, two
  fetch paths
- `apps/docs/src/routes/table/url-state/+page.svelte` — the layered case: three mechanisms plus
  SSR, every section standing alone

## Before writing

- Name the question the page answers, in one sentence. Everything on the page earns its place
  against it.
- The first sentence says what the thing is and when to reach for it. Not how it came to be.
- Every fact has one home. A rule about one prop → its JSDoc (generated onward into the API
  table, `llm.txt`, MCP). How props relate, when to reach for which, the wiring → the page. Why a
  lint rule exists → that script's header. An API problem → the change that found it, not a note.
  Exhaustive is the system; minimal is the page.

## Checklist — the editing pass

Two rounds in order: every sentence against 1–15, then the whole page against 16–19.

Cut:

1. Announcements and self-narration — "In the following section…", "The reason is timing." A
   plain cross-link is fine.
2. Verdicts riding a dash — `— the canonical real-world use case`. A dash carrying information
   stays.
3. Adjectives that decide nothing — powerful, seamless, robust… Test: would we ever ship the
   opposite?
4. List items padded for cadence — two if two are true, five if five are.
5. Encouragement — "you're good to go".
6. Design rationale in the flow — aside, or out.
7. Sentences restating the snippet or the live demo (read the demo's own markup first). Say what
   neither shows: when to reach for it, what it costs, what breaks.
8. Insider nouns and metaphors — axes, seams, stages; a token *ledger*, a *choreography*. Use the
   ordinary word; defining one is the fallback when none exists.

Reshape:

9. A colon or dash that pays off its own set-up → two sentences.
10. A rhetorical `…, which is why …` → full stop. A causal link that *is* the information stays in
    one sentence.
11. A negation without an error it prevents → cut, or name who does it instead.
12. A hypothetical as argument ("a per-field gate *would*…") → say what this design does.

Each sentence:

13. Can the reader look at their own code afterwards and decide something? A bare category ("It
    is a controlled prop") fails; keep the consequence, drop the category. Never define a term
    with its own word.
14. Default shapes: condition → consequence; task → tool. One purely orienting sentence per
    section is the budget.
15. Every behaviour claim is checkable against the component — verified in the source before it
    ships.

Then the page:

16. Still answering the question it was opened for? Anything now belonging elsewhere — a second
    topic is a second page, an API finding goes into the current change?
17. Three parallel cases in prose → a comparison table. A table restating a type or prop list →
    `<ApiReference>` / `<TypesReference>`; hand-written copies drift.
18. One example demonstrates one thing. Two things, two examples.
19. A note needs a victim: behaviour that has cost someone time, or that nothing catches. Where
    DEV already warns, a plain sentence in the section replaces the note. Caveats crowding the
    page are an API finding (`/table/url-state` was ~¼ notes and produced #157).

## The layer with no reader

Head comments are read by every model that edits the file and by nobody who visits the site, so
nothing keeps them short. An explanation that holds for N files lives in one place, not N.
Evidence for a rule lives at the script that enforces it — a guide states the rule and points
there.

## Prop JSDoc

The sentence rules (9–15) apply there unchanged. What belongs in JSDoc versus on a page — the
`@summary` budget, the description contract, who reads what — is the `component-metadata` skill.

## Deliberately not regulated

Sentence length, humour, second person, opening with a question, playful or plain. The cuts leave
room for a voice; they do not supply one.

## Changing this file

- A new rule needs a repeat offender — a second page failing the same way. A single finding
  belongs in the change that found it.
- Budget: one page. A rule in means a rule out.
- Checklist form is load-bearing, twice over. Guide prose is the longest style sample in an
  author's context and gets imitated — a worked example from an earlier revision of this file
  shipped verbatim into a page. And imperative fragments cannot violate the sentence rules they
  state.
