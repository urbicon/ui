---
paradigm: minimal
theme: default
density: comfortable
---

# Design Manifest — Urbicon UI Docs

The persistent design intent for this project. Frontmatter records the enforced intake
decisions (paradigm, theme, density). `## Pattern Usages` is regenerated from
`data-design-pattern` markers by `sync_design_manifest`. `## Design Decisions` is an
append-only ADR log written by `record_design_decision`.

## Pattern Usages

<!-- AUTO-GENERATED pattern usages — managed by sync_design_manifest; do not edit by hand -->

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

