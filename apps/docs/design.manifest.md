---
paradigm: minimal
theme: default
density: comfortable
---

# Design Manifest — Urbicon UI Docs

The persistent design intent for this project. Frontmatter records the enforced intake
decisions (paradigm, theme, density). `## Product Intent` is the target identity.
`## Token Overrides` lists project-specific tokens `urbicon validate` should accept.
`## Pattern Usages` is regenerated from `data-design-pattern` markers by
`urbicon sync-manifest`. `## Design Decisions` is an append-only ADR log written by
`urbicon record-decision`.

## Product Intent

**Audience:** Developers evaluating and integrating Urbicon UI — technical, scanning for API truth and evidence that the system is crafted, not generated.

**Voice:** editorial, precise, restrained

**References:**

- Editorial technical documentation that reads as a designed artifact: strong typographic hierarchy, generous vertical rhythm, colour reserved for meaning
- The component pages themselves — each must demonstrate the principle it documents

**Anti-references:**

- Generic admin-dashboard chrome: heavy panels, colour as decoration
- Kitchen-sink component zoos that list widgets without composing them

## Token Overrides

<!-- The docs site uses the standard Urbicon token set; no project-specific cores. -->

_None yet._

## Pattern Usages

<!-- AUTO-GENERATED pattern usages — regenerated from data-design-pattern markers; do not edit by hand -->

- `dashboard` — src/routes/recipes/dashboard/+page.svelte

<!-- END pattern usages -->

## Design Decisions

### 2026-06-13 — Adopt data-design-pattern markers on recipe roots

**Status:** accepted

**Decision:** Recipe pages that exemplify a Layer-4 composition pattern carry data-design-pattern="<name>" on their root element.

**Rationale:** Makes pattern usage greppable for sync_design_manifest and pattern-change impact analysis (Option C).

### 2026-05-23 — Editorial paradigm for the documentation site

**Status:** accepted

**Decision:** The docs site uses the Minimal paradigm with an editorial layer: vertical rhythm, restrained chrome, typographic hierarchy over colour.

**Rationale:** A component library's docs must read as a designed artifact, not a generic dashboard.

