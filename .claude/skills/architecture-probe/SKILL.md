---
name: architecture-probe
description: Probing a package's architecture with five sondes in a fixed order (git archaeology, consistency matrix, empirical verification, change-cost, blind redesign) instead of answering with a judgement. Use when asked how good a package's architecture is, whether it has accumulated debt, or to find the inconsistencies a reading review misses.
---

# Probing an architecture

**Never answer "how good is the architecture of X?" with a judgement.** The question is
holistic and unfalsifiable, so it comes back polite. A reviewer who reads code adopts its
framing — this repo's packages are exceptionally well commented, and almost every exception
carries a justification naming the measurement that forced it. Reading convinces you exception
by exception. **The number of exceptions is the finding, and it is invisible while reading.**

Change the question instead. Run the sondes below in order and stop when the answer is clear.
First full run: `packages/table`, 2026-08-18, 18 agents → `docs/internal/TABLE-MIGRATIONEN-2026-08-18.md`.

## Two rules, without which none of the sondes carries

1. **Every finding needs a site that pays for it** — a code location or a scenario with numbers.
   Without this clause all five sondes produce well-phrased architecture criticism. With it,
   about two thirds of raw findings drop before anyone reads them.
2. **Verify against a real oracle, never a second reading.** A running test with a positive
   control in the opposite case. This is roughly a third of the total effort and it is the
   difference between a report and an opinion.

Finder agents must be told: *no overall judgement, no grade, no praise, only lists.* They
volunteer a verdict otherwise, and the verdict is what you are trying not to get.

## The order

### 1. Git archaeology — one agent, cheapest, highest yield

Ask: which cause was repaired more than once, and did each fix change the **model** (removed a
state source, unified a write path) or add a **special case** (another branch, another guard,
another flag)?

Recurring fix *series* are the finding, not individual fixes. This is the only sonde that
produces an explanation rather than symptoms — on `packages/table` it produced the whole
diagnosis (unfinished migrations: the right answer was found and applied, and each rollout
stopped halfway).

Make the agent check the current code for whether each cause still stands, and mark
`structural` only when one cause demonstrably produced three or more fixes.

### 2. Consistency matrix — one agent per cross-cutting concern

Pick the concerns from what step 1 surfaced. On table these were: state ownership and write
paths, client vs. server processing, value/identity resolution, and render duality
(desktop/mobile/grouped).

**The prompt must enforce two phases:** first collect *every* site mechanically — the working
phrasing is *"list every site and how it does it — do not judge"* — and only then derive the
inconsistencies. The deviation then falls out of the table instead of being invented or missed.
Highest hit rate for concrete bugs of all five sondes.

An inconsistency without a `price` field does not count. Require it in the schema.

### 3. Empirical verification — the obligation, not a sonde

Every claim that will reach a report gets a running test. Follow the `blocks-testing` skill —
no `@testing-library/svelte`, no `jest-dom`. Give the agents:

- **a positive control, mandatory**: measure the same thing in the opposite case (client instead
  of server, non-virtualized instead of virtualized) with the identical rig. If the control is
  not green, the rig measures nothing and nothing may be claimed. (Same lesson as
  `guard-green-for-the-wrong-reason`.)
- **`NOT_DECIDABLE` as a permitted verdict.** jsdom does not lay out; `offsetHeight` is 0. Where
  layout is needed, stub `clientHeight` (pattern in `Table.render.svelte.test.ts:534`). Anything
  pixel-shaped stays unclaimed.
- **an adversarial brief**: the job is to *refute*. A refuted finding is a valuable result.
- **a unique temp filename per agent** (parallel verifications otherwise overwrite each other),
  delete it afterwards, commit nothing.
- **a warning about a dirty tree**: other sessions may have unrelated changes staged. Tell the
  agent which paths are foreign, that it must not revert them, and that its own package must
  come back clean.

Of 11 verified claims on table, 9 held, 2 were corrected in their reach, 0 fell — but both
corrections mattered, and one of them moved the cause of a defect.

### 4. Change-cost probes — two or three real roadmap items

Have the change planned in detail, never implemented. The question is not "is this possible" but
**"at how many places would the same decision have to be carried independently?"** Demand a
count, the file list, and a split into *unavoidable requirement complexity* vs. *structural
cost*, each with evidence. Require honesty in both directions — "surprisingly cheap" is a result.

Pick at least one item that is actually on the roadmap, and at least one combination the package
explicitly refuses; the refusal machinery is often more expensive than the thing refused.

### 5. Blind redesign — last, and only where it earns its cost

Felix's idea; it works, but not through the diff.

- A **separate agent** distils an implementation-neutral requirements dossier from README, docs,
  props JSDoc and test names. Give it a **ban list** of internal names (module, type, prop and
  export names) and make it grep its own output against the list and report the result.
- The architect gets **only that file** and is told explicitly not to look at the package. Have
  it list every file it read.
- **One subsystem per architect, never the whole package** — the latter produces an essay.
- Require **justifications and rejected alternatives** for every non-obvious choice. This is
  where the value is: because the architect must defend each decision, the justifications name
  the real defects without knowing them. On table one of them predicted four existing bugs in a
  single sentence about why a nested model would let four consumers drift apart.

It can also support a quality claim, but read the evidence asymmetrically: **divergence is
strong evidence, convergence is weak.** The dossier's edge rules are distilled from the
behaviour of the design under test, so a competent designer satisfying them tends to land on
its mechanism — on table, the blind architect "independently" invented the claims register
with a composite key, and the dossier clause that forced it ("…auch, wenn zwischen ihnen eine
Ablage anderer Art lag") was itself extracted from that register's code comment. A convergent
choice counts only where the dossier did not already dictate it; a divergent one always
counts, because it proves an alternative satisfying the same rules exists. The v8 view
object's "pass" is therefore a consistency proof, not an optimality proof.

**Its limit:** a design without change pressure optimises for the status quo. Both blind
architects chose the same sort representation as the real code — the one the change-cost probe
independently identified as the package's most expensive structural debt. Sonde 4 and sonde 5
do not replace each other.

## Where the results go

- **Verified defects with user impact** → issues, with the four label axes and a milestone. Where
  the fix needs a product decision (what does "select all" mean when the server holds the rows?),
  leave `ready` off and put the options in the body. That is what `ready` is for.
- **The architecture diagnosis** → a document under `docs/internal/`, not issues. "The row
  renderer exists three times" is a state, not a task; as an issue it sits open for a year. Issue
  the *work* that ends the state, and let it link back.
- **Method learnings** → this file.

## Traps from the first run

- **A quota limit kills every agent of a workflow at once.** All seven returned the same error
  string. `resumeFromRunId` does not help when nothing was cached — check the journal before
  diagnosing, and set an explicit `model` on the agent calls when the session model is the one
  that ran out.
- **Read big workflow results from the journal, not whole.** Extract titles and verdicts with
  `jq` over `journal.jsonl` first, then pull the few entries that matter.
- **`rg` output is not evidence.** A truncated grep hides hits; make agents read the files they
  cite. (`vollstaendigkeit-nie-aus-abgeschnittenem-grep`.)
