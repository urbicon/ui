# Changelog

All notable changes to this project will be documented in this file.
This changelog is automatically generated from [Conventional Commits](https://www.conventionalcommits.org).


## [6.14.0] - 2026-07-02

### Bug Fixes
- **auth**: Harden cbor/webauthn parsing against hostile input
- **auth**: Resolve callers via session cookie and validated locals
- **auth**: No-op prisma user writes on missing rows per contract

### Features
- **auth**: Rate-limit re-auth endpoints by default and add a logger seam

### Refactoring
- **auth**: Drop the never-implemented email notification channel

## [6.13.0] - 2026-07-02

### Bug Fixes
- **auth**: Derive web push cek/nonce via plain rfc 8188 info strings
- **auth**: Upsert push subscriptions by endpoint

### Features
- **auth**: Ship passkey list/delete and notification crud handler factories

## [6.12.0] - 2026-07-02

### Bug Fixes
- **auth**: Default-deny unauthenticated remote-function requests in route guard

## [6.11.0] - 2026-07-02

### Documentation
- **blocks**: Add cockpit recipe for JourneyTimeline rich rows

### Features
- **blocks**: Add marker/trailing snippets + attention status

## [6.10.1] - 2026-07-02

### Bug Fixes
- **blocks**: Rebuild JourneyTimeline horizontal rail as a station spine

## [6.10.0] - 2026-07-02

### Bug Fixes
- **blocks**: Cancel in-flight focus pin + gate panel aria-controls

### Documentation
- **blocks**: Rewrite JourneyTimeline docs for the chronicle rework
- **blocks**: De-duplicate JourneyTimeline example details

### Features
- **blocks**: Rework JourneyTimeline as a focus+context chronicle

## [6.9.0] - 2026-07-01

### Bug Fixes
- **blocks**: Harden JourneyTimeline focus + scroll-spy against edge cases
- **blocks**: Correct JourneyTimeline vertical connector geometry

### Documentation
- **blocks**: Document JourneyTimeline primitive

### Features
- **blocks**: Add JourneyTimeline primitive

### Testing
- **blocks**: Cover JourneyTimeline variants + SSR render

## [6.8.1] - 2026-07-01

### Bug Fixes
- **docs**: Resolve @fontsource-variable side-effect imports for svelte-check
- **blocks**: Guard cross-route tours against re-entrant navigationSource
- **blocks**: Surface a synchronous off-route landing in cross-route tours

### CI/CD
- Build all packages + docs metadata before the typecheck gate
- Compose `build` from `build:ts`, drop the release double-build

### Documentation
- **guide**: Document re-entrancy-safe synchronous navigationSource

## [6.8.0] - 2026-06-30

### Bug Fixes
- **blocks**: Harden cross-route engine (silent-failure review)
- **blocks**: Keep cross-route diagnostic across redirect chains
- **blocks**: Clear expected route for targetless cross-route steps

### Documentation
- **blocks**: Document declarative cross-route touring

### Features
- **blocks**: Declarative cross-route guide tours (engine)
- **blocks**: Forward navigate hook through GuideProvider

## [6.7.2] - 2026-06-30

### Bug Fixes
- **auth**: Convert ES256 passkey signatures to raw before verify (Codeberg #38)
- **auth**: Stop corrupting VAPID signatures with a bogus DER conversion
- **auth**: Return 400 (not 500) for an unimportable stored passkey key

### Refactoring
- **auth**: Harden ES256 DER converter per review (scope, errors, tests)

## [6.7.1] - 2026-06-30

### Documentation
- **table**: Gate the data-fit padding override to the md breakpoint

## [6.7.0] - 2026-06-30

### Documentation
- Native controls

### Features
- **table**: Expose `data-fit` on the container for layout hooks

## [6.6.0] - 2026-06-30

### Bug Fixes
- **table**: Stack mobile filter bar so search is not crushed (Codeberg #28)
- **table**: Enlarge mobile toolbar touch targets, drop dead card slot (Codeberg #32)
- **table**: Scope mobile touch-target sizing to the toolbar triggers (Codeberg #32)
- **table**: Avoid nested-interactive in selectable mobile cards (Codeberg #30)

### Documentation
- **table**: Correct stale priority docs + sharpen JSDoc/validation (Codeberg #33)

### Features
- **table**: Add a sort control to the mobile filter bar (Codeberg #29)
- **table**: Redesign mobile card with a title + compact grid (Codeberg #31)
- **table**: Support row selection in the mobile card (Codeberg #30)

### Refactoring
- **table**: Unify column priority as a mobile-card concept (Codeberg #33)

## [6.5.0] - 2026-06-30

### Bug Fixes
- **blocks**: Address review findings for the GuidePanel index features

### Documentation
- **blocks**: Document GuidePanel grouping/search + GuideRef (Codeberg #25/#26/#27)

### Features
- **blocks**: Group the GuidePanel article index by section (Codeberg #25)
- **blocks**: Add opt-in article search to GuidePanel (Codeberg #26)
- **blocks**: Add GuideRef for declarative article→article links (Codeberg #27)

## [6.4.1] - 2026-06-30

### Bug Fixes
- **blocks**: Render icon↔label gap in Button & Badge via [gap:inherit] (Codeberg #21)
- **blocks**: Keep Combobox listbox closed after selection/clear (Codeberg #19)
- **blocks**: Guard every import.meta.env.DEV with optional chaining (Codeberg #20)

## [6.4.0] - 2026-06-26

### Features
- **auth**: Add autoVerifyInvited to pre-verify invitation-gated signups

## [6.3.15] - 2026-06-26

### Bug Fixes
- **blocks**: Compensate the keyboard viewport offset for top-layer popovers (Codeberg #23)

## [6.3.14] - 2026-06-26

### Bug Fixes
- **blocks**: Own anchored-panel positioning solely in Floating UI (Codeberg #23)

## [6.3.13] - 2026-06-25

### Bug Fixes
- **blocks**: Compensate transformed containing block for in-dialog overlays

## [6.3.12] - 2026-06-25

### Bug Fixes
- **blocks**: Render anchored overlays in-place inside modal dialogs

## [6.3.11] - 2026-06-25

### Documentation
- Surface the i18n audit tools in CLI/README/agent context
- Add an i18n Auditing & Quality page to the docs site

## [6.3.10] - 2026-06-25

### Bug Fixes
- **i18n**: Defer package registration to first use (Codeberg #22 registry TDZ)

## [6.3.9] - 2026-06-25

### Bug Fixes
- **i18n**: Harden translation audit against bad input and throwing sinks
- **i18n**: Harden unused-key scanner against false positives (review)
- **design**: Make i18n bundle-load failures gate, load .js, skip non-locales

### Documentation
- Add i18n audit implementation plan
- Mark WP0 + WP1 done in i18n audit plan
- Mark WP2 (unused-key scanner) done in i18n audit plan
- Mark WP3–WP5 done, i18n audit plan complete

### Features
- **i18n**: Add translation audit + runtime onMissingKey hook
- **i18n**: Add unused-key source scanner on the /audit subpath
- **i18n**: Add hardcoded-string lint (Feature C) to the audit subpath
- **design**: Add `urbicon i18n` command over the i18n audit

### Miscellaneous
- **i18n**: Replace the regex i18n-analyzer with `urbicon i18n` (dogfood + CI)

## [6.3.8] - 2026-06-24

### Features
- **blocks**: Add single-line overflow mode to Breadcrumb

### Refactoring
- **blocks**: Unify overlay positioning on a shared useFloatingPanel
- **docs**: Build the DocsLayout sticky header on the Breadcrumb primitive

## [6.3.7] - 2026-06-24

### Bug Fixes
- **blocks**: Keep anchored overlays stable on iOS (visualViewport + viewport-fit height)
- **blocks**: Dismiss Combobox/Select via pointerdown for reliable touch close
- **docs**: Single morphing page title in sticky header, overflow-safe
- **blocks**: Stop overlay max-height from latching short after viewport shrink
- **blocks**: Don't collapse a Breadcrumb when the ellipsis would hide one item

### Documentation
- Reflect SegmentGroup overflow collapse + iOS input floor
- Document Breadcrumb collapse + correct overlay keyboard notes

### Features
- **blocks**: Collapse long Breadcrumb trails into an expandable ellipsis

## [6.3.6] - 2026-06-24

### Bug Fixes
- **blocks**: Use manual dismiss for Popover with an external trigger
- **blocks**: Focus the Menu panel, not the first item, on pointer-open
- **blocks**: Drive Select keyboard nav from the focused trigger
- **blocks**: Add a Combobox chevron toggle to close the listbox
- **blocks**: Floor focusable inputs to 16px on touch to stop iOS zoom
- **docs**: Stack playground controls above their labels on mobile
- **docs**: Add a mobile nav to the landing header
- **blocks**: Detect SegmentGroup overflow via item geometry, not scrollWidth

### Documentation
- **blocks**: Fix stale Select handler reference in focus-policy comment

### Features
- **blocks**: Collapse SegmentGroup to a vertical stack on overflow

## [6.3.5] - 2026-06-24

### Features
- **auth**: Give the Lettermint transport a configurable from-default and timeout

## [6.3.4] - 2026-06-24

### Miscellaneous
- Update dependencies

## [6.3.3] - 2026-06-24

### Bug Fixes
- **i18n**: Emit fully-specified ESM specifiers from svelte-package builds
- **design**: Surface the Tailwind 4 wiring step in `init`
- **i18n**: Avoid a double slash when completing a trailing-slash dir specifier
- **design-engine**: Keep soft-wrapped values in the manifest Product Intent
- **mcp-server**: Advertise real get_recipe scenarios
- **mcp-server**: Show the origin package in find_components search results
- **docs**: Make the dashboard and login recipes lint-clean
- **auth**: Target the Lettermint v2 send API in the email transport
- **auth**: Prefill RegisterPage email from the invite link

### Documentation
- **design**: Note the standalone `bunx` invocation

### Features
- **design**: Make find/get-component dependency-aware
- **design-engine**: Enforce deep-import, motion, and intent-typo rules
- **blocks**: Expose DateRangePicker as a standalone catalog entry
- **auth**: Add configurable sender (from) for outbound emails
- **auth**: Return machine error codes so pages localize handler errors
- **auth**: Localize default emails and add per-mail builder hooks

### Miscellaneous
- **blocks**: Exclude test fixtures from the published tarball

### Testing
- **docs-gen**: Lint recipe live-preview code against the design engine

## [6.3.2] - 2026-06-23

### Bug Fixes
- **mcp-server**: Document border-hairline token + guard css-reference against drift

### Documentation
- **design**: Complete the override ladder in the AGENTS.md template

## [6.3.1] - 2026-06-23

### Bug Fixes
- **blocks**: Make system theme follow color-scheme natively; unify dark mode on light-dark()
- Missed changes related to refined override-architecture
- **design-engine**: Whitelist skeleton-shimmer token

### Miscellaneous
- Add design-* packages to commitlint scope list

## [6.3.0] - 2026-06-23

### Documentation
- Surface customization override ladder, fix class-trap + token table
- Align component conventions + structure standard with type-safe slotClasses

### Features
- **blocks**: Type-safe slotClasses + resolveSlotClasses library-wide

## [6.2.0] - 2026-06-22

### Features
- **blocks**: Add prop-conditional overrides to BlocksProvider

## [6.1.7] - 2026-06-22

### CI/CD
- Release-script

## [6.1.6] - 2026-06-22

### Bug Fixes
- **blocks**: Redraw 17 unrecognizable icons
- Clarify urbicon exit-code semantics (1 = failed, 2 = usage only)
- Point the design manifest at the urbicon CLI, not the removed MCP tools
- **design-engine**: Harden slop heuristics per review (ReDoS, FP, FN)
- **design-engine**: Harden manifest history + intent parsing per review
- **mcp-server**: Address Schritt-8 review — prompt args, fail-loud bundle, stale docs
- **docs**: Label the icon-only buttons in the notification-center recipe
- **design**: Harden init file-mutation + bundle-missing paths (review)

### Documentation
- Csrf-explanation
- Refresh stale module references after engine extraction
- Update mcp-server tool inventory after dropping the 3 FS tools
- Repoint residual manifest-module references to the urbicon CLI
- Drop the 3 removed MCP tools from the public /ai docs page
- Address Schritt-5 review — refresh mcp-server README, clarify recipe gate
- Describe the two-axis linter (correctness + slop-floor) in the READMEs
- Document and dogfood the extended design manifest
- **design**: Document the design verbs in the CLI README
- **design**: Document hook + CI enforcement, ship copy-paste templates
- Note urbicon hook + CI enforcement in the design-loop description
- **mcp-server**: Note the AST-pass checks in the validate_design description

### Features
- Add urbicon CLI (@urbicon-ui/design) for design validation + manifest
- Whitelist project tokens per call via validate_design(extraTokens)
- Add @urbicon-ui/design-content package + bundle locator
- **docs-gen**: Emit the design-content bundle in docs:gen:all
- Split design-linter score into correctness + slop-floor axes
- Expand the slop-floor from 4 to 20 system-agnostic heuristics
- **design-engine**: Extend the manifest schema with intent, token overrides + history
- **design**: Wire urbicon validate + context to the extended manifest
- **design**: Add the design-verb skill — 10 recipes + router (single source)
- **docs-gen**: Bundle the design verbs into design-content
- **mcp-server**: Serve the full design-verb table as prompts
- **design**: Add urbicon verbs / verb <name> to print the design recipes
- **design**: Gate the slop axis with urbicon validate --slop-floor
- **design**: Add urbicon hook — the PostToolUse design gate
- **design-engine**: Add a zero-dep markup scanner for the AST pass
- **design-engine**: Catch component API hallucination (F-J)
- **design-engine**: Flag icon-only buttons with no accessible name (F-G)
- **design**: Add urbicon find and get-component (local Knowledge plane)
- **design**: Add urbicon init and the consumer AGENTS.md template

### Miscellaneous
- Landing page - wording
- Publish @urbicon-ui/design-engine before mcp-server
- Wire @urbicon-ui/design-content into publish, trust + lint config

### Refactoring
- **mcp-server**: Extract design engine into @urbicon-ui/design-engine
- **mcp-server**: Drop the 3 filesystem tools (moved to the urbicon CLI)
- **mcp-server**: Read content from the @urbicon-ui/design-content bundle
- **design**: Address Schritt-9 review — tighter hook feedback, leaner CI doc
- **design-engine**: Harden the markup scanner per Schritt-10 review
- **design-engine**: Extract shared catalog search into engine/search

### Testing
- Lock backward-compat for an intact old-tail usages block

## [6.1.5] - 2026-06-18

### Documentation
- Surface Planner in navigation + MCP, complete the recipe nav
- Add ChartFrame doc page (was catalog-only / 404) and link it

### Features
- **blocks**: Anchor Calendar week/day views on a real day, not the 1st

## [6.1.4] - 2026-06-18

### Bug Fixes
- **blocks**: Break icon circular dependency, split icon.context module
- **blocks**: Repoint icon lint + scaffold tooling at the split modules
- **blocks**: Address Planner review findings
- **blocks**: Make Planner's today date number legible

### Build
- Add release:publish script for local npm publishing

### Documentation
- Point icon references at the split modules (icon-registry/icon-types)
- Dategrid-refactoring, remove obsolete ToDos and comments
- Mark DateGrid plan phases 0-2 as done
- Tick DateGrid DoD for completed phases 0-3
- **blocks**: Add Planner documentation page
- Tick DateGrid plan — phases 4 (Planner) + 5 (DX/Discovery) done

### Features
- **docs**: Editorial de-slop redesign — typography, layout, colour & voice
- **blocks**: Add @urbicon-ui/blocks/date subpath with pure date geometry
- **blocks**: Add headless DateGridController + Scaffold (layer 1)
- **blocks**: Add Planner component (date-grid layer 2b)
- **mcp-server**: Wire Planner into discovery (pattern, recipe, suggest, matrix)

### Miscellaneous
- Initial commit
- Update dpendencies

### Refactoring
- **blocks**: Re-base Calendar onto shared DateGridController
