# Changelog

All notable changes to this project will be documented in this file.
This changelog is automatically generated from [Conventional Commits](https://www.conventionalcommits.org).


## [6.21.3] - 2026-07-13

### Bug Fixes
- **docs**: Scale landing sparkline to the card via svg slot class
- **docs**: Align tokens page with the real token sources
- **blocks**: Align figma token export with the real token sources
- **docs**: Compute figma-tokens page stats from the export
- **blocks**: Make shadow tokens render as real box-shadows
- **blocks**: Block keyboard interaction on disabled badges
- **blocks**: Forward consumer oninput through Textarea
- **blocks**: Let manual-mode popover close from its trigger and restore focus
- **docs**: Use semantic tokens in table customization example
- **docs**: Stop CodeExample warning fallback on section/toc/types-reference examples

### Documentation
- Log sparkline fixed-width ergonomics debt
- Rework button-group page with real use-cases and customization
- Log DOM-sweep and shadow-verification findings as debt
- Catch table pages up with the shipped API
- Log dead table date-filter comparison as debt
- Polish the docs-package section pages
- Log prettier single-quote attribute corruption as debt

### Refactoring
- **blocks**: Drop dead Badge hover state, correct ButtonGroup size JSDoc

### Testing
- **e2e**: Add missing rooms VR baselines
- **blocks**: Interactive DOM coverage for the round-2 primitives

## [6.21.2] - 2026-07-10

### Breaking Changes
- **blocks**: Move Tooltip to open/onOpenChange with controlled mode
> **BREAKING:** TooltipProps.onVisibleChange is now onOpenChange (same boolean payload); the tv() axis 'visible' is renamed 'open' (affects only overrides conditioned on that axis). Also fixes the keyboard focus-open path: the wrapper span listened via focus/blur, which do not bubble — a keyboard focus on the consumer's trigger child never opened the tooltip (WCAG 1.4.13). focusin/focusout bubble and cover any focusable descendant; covered by the new Tooltip.svelte.test.ts.
- **blocks**: Rename FormField hint to helper across the form seam
> **BREAKING:** FormFieldProps.hint is now helper; the FormField slotClasses key 'hint' is now 'helper'; Combobox slotClasses key 'hint' is now 'helper'; useFormField's input field hint and return field hintId are now helper/helperId.

### Bug Fixes
- **docs**: Repair broken rendering and false claims (triage quick-fix block)
- **blocks**: Stop calling the built-in positioning engine "Floating UI" in public JSDoc
- **docs**: Rewrite both auth recipe codes against the shipped handler factories
- **docs**: Rewrite the /docs index as a hand-curated card list
- **docs**: Align locale-switcher page with the Select-based implementation
- **blocks**: Localize Breadcrumb's built-in accessibility labels
- **blocks**: Harden onOpenChange against ghost transitions (review findings)
- **table**: Honor column.align in default cells
- **table**: Align summary rows with the column grid, drop the boxed frame
- **blocks**: Correct Combobox async loading sequencing and abort on teardown
- **blocks**: Re-enable NumberInput stepper clicks and harden stepping
- **blocks**: Guard toaster.promise against throwing user formatters
- **blocks**: Reset Dialog drag styles on teardown and recenter on reopen
- **blocks**: Reconcile Guide seen-writes made during an async storage.load
- **design-engine**: Split emoji-as-icon regex to dodge Bun alternation bug

### Documentation
- Log mcp-server bin node-incompatibility as technical debt
- Define the open-state vocabulary for overlays and disclosures
- Bring the size table and callback examples up to reality
- Recast the design verbs and agent templates CLI-first
- Record the Option-B position — MCP out of the narrative, CLI is the surface
- Technical-debt
- **docs**: Say out loud who runs the CLI — the agent, not the developer
- **docs**: Document table summaries, column visibility, and the header menu
- **technical-debt**: Record deferral of Button preset catalog (BTN-3)
- **technical-debt**: Record deferrals from the FR-sweep review
- Refactor landing page
- Technical debts

### Features
- **docs**: Add DRAFT_ROUTES launch switch, disable profile-card and semantic-radii
- **blocks**: Add onOpenChange to Menu, Select, and Combobox
- **blocks**: Give ConfirmDialog the standard styling contract
- **blocks**: Symmetrize the form family — Toggle error state, xs-xl sizes
- Extract the shared knowledge core into design-engine (reference + icon search)
- Complete the urbicon CLI knowledge surface
- **docs**: Lead the AI story with the package track, drop the local MCP setup
- **blocks**: Add renderItem snippet to Pagination
- **blocks**: Add opt-in accentEdge to Drawer
- **blocks**: Add draggable mode to Dialog
- **blocks**: Add group support to Combobox
- **blocks**: Add async server-side search to Combobox
- **blocks**: Add context-menu trigger to Menu
- **blocks**: Add action buttons and promise toasts (Sonner-style)
- **blocks**: Allow async GuideStorageAdapter.load()
- **blocks**: Add NumberInput component
- **blocks**: Add purpose axis to Badge (BDG-1)
- **blocks**: Add multi-select with tags to Combobox

### Testing
- **table**: Hoist concern imports to fix flaky timeout under parallel run

## [6.21.1] - 2026-07-09

### Breaking Changes
- **blocks**: Tighten the tv() API surface — type-safe slots, fail-loud config, ClassValue parity
> **BREAKING:** four narrowings of the tv() call surface (no runtime consumer existed for any of them — verified repo-wide): - the React-era `className` alias is gone everywhere (props, compound  entries, matchesCompound). Svelte has one class prop. - `base` and `slots` are mutually exclusive: the primary slot is declared  as `slots.base`. Historically a top-level base was silently dropped  unless a slot happened to be named 'base'. - the slot-mode resolve call takes no top-level `class` (it had no slot to  attach to and was silently ignored) — class overrides belong to the slot  functions; a DEV warning covers untyped callers. - no-slot variant values are class strings/arrays; an object (slot map)  there is now a config error. Found one real instance: table's  headerMenuItemVariants marker axis used {} instead of ''. Completeness upgrades: - slot-name type safety: slot-map keys in variant values and compound  classes are compile-checked against the declared slots  (ValidSlotVariants intersection — a 'wrapeer' typo is now a type error  at that key). Closes the biggest documented trade-off of the engine. - config-time runtime validation (covers JS callers and configs built from  imported constants): unknown slot keys, unknown compound axes/values,  undeclared defaultVariants values and no-slot slot-maps all throw at  module init with precise messages. Half-declared boolean axes  (loading: { true } + a compound on loading: false) stay idiomatic. - call-site class inputs mirror Svelte 5's ClassValue: cx() and every  `class` override accept clsx-shaped records ({ active: cond }), nested  arrays included. Config-side values deliberately keep object = slot map. - every resolver exposes its config as a non-enumerable `.config` for  tooling (variants linter, docs-gen). - micro: single-lookup bucket cache; slot bases tokenized once per config.

### Bug Fixes
- **blocks**: Redirect GuidePanel focus on article switch, reset search on close
- **blocks**: Enter modal state after the dialog ref binds (Dialog/Drawer)
- **blocks**: Skip disabled tabs during Tab keyboard navigation
- **blocks**: Skip disabled segments in SegmentGroup keyboard navigation
- **blocks**: Keep Accordion's last item open under collapsible=false
- **blocks**: Guard the deferred showModal against teardown before its tick
- **design**: Skip __fixtures__ dirs in the i18n source audit
- **blocks**: Per-instance body-scroll-lock ownership (Dialog/Drawer/Sidebar)
- **blocks**: Correct tv() bucket classification for arbitrary properties and v4 utility families
- **blocks**: Resolve same-bucket conflicts across variant axes and compounds (XC-10)
- **blocks**: Model shorthand dominance in the tv() conflict resolver
- **blocks**: Vertical CompositionBar segments collapsed to zero height
- **blocks**: Harden tv() validation and shadow classification per adversarial review
- **docs**: Restore Section header rhythm to the size axis
- **blocks**: Variants-lint leave-one-out attribution, fail-loud gates, CI wiring
- **docs**: Tint landing specimen cards into their rooms + correct copy facts
- **blocks**: Export TVConfig/SlotNames so consumer packages can emit types
- **docs**: Visible keyboard focus on the hero index panel links
- **docs**: Apply review findings — aria-current, badge anchor parity
- **table**: Controlled selection no longer freezes user row selection
- **table**: Dedupe incoming ids in the setSelectedIds idempotence guard
- **blocks**: Stack in-place floating panels above later positioned siblings
- **blocks**: Own in-place panel z-index in the hook, rescale --z-dropdown

### Documentation
- Log Calendar current-time red-500 as technical debt
- Reference technical-debt.md in AGENTS + CONTRIBUTING
- Log ConfirmDialog async-confirm unhandled rejection as technical debt
- Log Collapsible controlled-open optimistic mutation as technical debt
- Document the __fixtures__ compound-widget test pattern
- Log the unconditional body-scroll unlock on destroy as technical debt
- Log the two shared DatePicker commit-path test gaps as technical debt
- Update the tv() trade-offs section for fold + dominance semantics
- Log the darwin-only e2e visual snapshots as technical debt
- Tv() v7 semantics — axis-order doctrine, type-safe configs, variants-lint
- Log flaky table sort test + missing d.ts build guard as debt
- Log table initial* gaps, single-select UX, slotClasses conflict as debt

### Features
- **blocks**: Per-instance collapse motion for Accordion + Collapsible
- **blocks**: Overlay-motion tokens + per-instance props for Toast & Tooltip
- **blocks**: Variants-lint guard — and purge the dead tokens it found
- **docs**: Add editorial/library docs-theme toggle
- **docs**: Rebuild landing as a palette-channel color-rooms poster
- **docs**: Room-tinted playground stage, TOC aligned with content top
- **docs**: Rooms block marker + quiet underlines + localized TOC kickers
- **docs**: Flatten the sidebar nav — in-place expansion, chip + block marker
- **docs**: Landing hero as cover + index — inverted set panel, tiles pierce the fold
- **docs**: Landing tile 'AI & DX' becomes 'Design' — the loop is the story
- **blocks**: Publish the sidebar-layout pinned-chrome height as a CSS var
- **docs**: Landing table specimen — status badges, preselection, no overflow
- **docs**: 'view source' flip on the landing specimen cards
- **docs**: Rebuild blocks overview as a specimen-book catalog
- **docs**: Rebuild getting-started as a four-step build guide

### Miscellaneous
- Update dependencies

### Refactoring
- **blocks**: Extract shared roving-focus index helpers
- Replace non-null assertions with explicit narrowing
- **docs**: Rename theming hooks to the data-docs-* contract
- **docs**: One scrollspy for DocsLayout and TableOfContents
- **docs**: Rooms selected via data-room — colours live only in CSS
- **docs**: Dedupe hero header, sticky offsets via published variable

### Styling
- Refactor landing page & docs layout

### Testing
- **blocks**: Variant tests for ButtonGroup, Pagination, Sidebar
- **blocks**: Variant tests for EmptyState, FileUpload, SidebarLayout
- **blocks**: Variant tests for Calendar day-state matrix
- **blocks**: Variant tests for Guide + Planner (sweep complete)
- **blocks**: Jsdom component-test layer + Combobox interaction tests
- **blocks**: Jsdom interaction tests for Select/Menu/Dialog
- **blocks**: Interaction tests for Toggle and Checkbox
- **blocks**: Interaction tests for ConfirmDialog
- **blocks**: Interaction tests for Tab + composite fixture pattern
- **blocks**: Interaction tests for SegmentGroup + RadioGroup
- **blocks**: Interaction tests for Slider
- **blocks**: Interaction tests for Collapsible and Accordion
- **blocks**: Interaction tests for Stepper
- **blocks**: Interaction tests for GuideRef and GuideMention
- **blocks**: Close the GuideMention teardown false-pass found in review
- **blocks**: Interaction tests for LocaleSwitcher
- **blocks**: Interaction tests for CurrencyInput
- **blocks**: Interaction tests for DatePicker
- **blocks**: Close coverage gaps from the component-test review
- **blocks**: Interaction tests for DateRangePicker
- **blocks**: Close DateRangePicker review coverage gaps
- Add visual-regression suite for the ten core primitives
- Gate the visual-regression suite to darwin
- **docs**: Wire the docs package into the test gate

## [6.21.0] - 2026-07-06

### Documentation
- **versioning**: Note apps/* are intentionally out of unified versioning

### Features
- **blocks**: Type ConfirmDialog transitionDuration/transitionEasing

### Miscellaneous
- **table**: Annotate intentional state_referenced_locally captures

## [6.20.2] - 2026-07-06

### Bug Fixes
- **blocks**: Use spec-compliant prefers-contrast: more
- **blocks**: Resolve state_referenced_locally sweep

### Documentation
- **agents**: Note the expected import.meta.env build warning

### Testing
- **auth**: Broaden timing-safe compare length/position coverage

## [6.20.1] - 2026-07-06

### Documentation
- **design**: Reframe settings Tab-vs-Sidebar as a scale-based choice

## [6.20.0] - 2026-07-06

### Bug Fixes
- **blocks**: Migrate Avatar slotClasses.base consumer + harden AVT-3
- **blocks**: Make Avatar ringColor colour the ring, drop dead hover state

### Features
- **blocks**: Add pulse indicator to Avatar status dot

## [6.19.4] - 2026-07-06

### Bug Fixes
- **mcp-server**: Document the info intent + extended neutral ramps in get_css_reference

### Documentation
- **design**: Reconcile the radius anti-pattern across principles + suggest_implementation

## [6.19.3] - 2026-07-06

### Bug Fixes
- **blocks**: Scope mint to the directional box on Checkbox and Toggle

### Miscellaneous
- **docs-gen**: Drop the always-empty getComponentsByCategory emit
- **docs**: Drop unused employees import in table customization page

### Refactoring
- **blocks**: Route CalendarGrid keyboard nav through the shared date-grid handler

## [6.19.2] - 2026-07-06

### Breaking Changes
- **blocks**: Default CurrencyInput locale to the active i18n locale
> **BREAKING:** CurrencyInput's `locale` prop now defaults to `'auto'` (the active i18n locale, `en` without a provider) instead of `'de-DE'`. Consumers relying on the implicit German formatting must pass `locale="de-DE"` or mount an `<I18nProvider locale="de">`.

### Documentation
- Note blocks check/test needs built workspace deps in a fresh worktree

### Features
- **blocks**: Add variant axis to Combobox (outlined/filled/ghost/underline)

### Refactoring
- **docs**: Drop 46 redundant pass-through +layout.svelte files
- Drop dead @typescript-eslint eslint-disable directives

## [6.19.1] - 2026-07-05

### Bug Fixes
- **blocks**: Auto-register default mints on first apply
- **blocks**: I18n the pagination info text
- **table**: Reveal all columns when column visibility is disabled
- **blocks**: Clamp Calendar year/month jumps to minDate/maxDate
- **blocks**: Harden Calendar/date-grid navigator bounds and month-change emission
- **docs-gen**: Repair docs:scaffold template prop names + align with stepper
- **blocks**: Clamp today/focus emit paths + repair Calendar keyboard focus-follow
- **blocks**: Disable Combobox clear button when the field is disabled
- **blocks**: Warn on inverted date-grid min/max bounds in dev
- **docs-gen**: Derive MCP catalog version from root package.json
- **table**: Sync persisted selection on live-delete + honour controlled mode
- **auth**: Harden passkey.updateCounter against concurrent deletion
- **auth**: Default-limit the forgot-password endpoint (secure-by-default)
- **auth**: Fail loud when refreshToken is configured without its repository
- **auth**: Assert refresh-repo invariant inside establishSession too
- **docs-gen**: Stop extracting prose that merely names @example as a code sample

### Documentation
- Align published docs with current codebase (planner, design packages, counts)
- Correct package README references (scope, targets, resources, counts)
- De-publish completed internal plans; add docs index, repair links
- Fix stale DESIGN-MCP doc paths in code comments
- Table to dos
- **table**: Document select-all scope and the new opt-out/controlled props
- Fix pre-commit .svelte-format claim in AGENTS.md
- **auth**: Document the single-brace i18n placeholder convention
- **auth**: Document the Node ≥ 20 / Bun runtime requirement

### Features
- **table**: Opt out of column visibility
- **table**: Controlled searchTerm + onSearchTermChange
- **blocks**: Localize chart a11y tables and stepper optional label
- **table**: Opt-in row-selection persistence via persistSelection

### Miscellaneous
- Remove dead eslint-disable comments after Biome migration
- **i18n**: Remove dead translation keys from blocks and table

### Refactoring
- **blocks**: Drop CalendarDayView dead list-mode branch + day-view eventItem
- **blocks**: Delegate date-form helpers to date core, rename picker I/O helpers
- **blocks**: Drop dead sr-only content slot from Badge dot variant
- **i18n**: Rename inner translate options to callOptions
- **blocks**: Consolidate CompositionBar legend visibility onto showLegend

## [6.19.0] - 2026-07-03

### Breaking Changes
- **auth**: Adapter polish — owner-first scoping, delete cascade, conformance gaps (R20)
- **auth**: Unify API surface, bundle route factories, add redirectTo (R21+R16)
- **auth**: Retire tooling/doc relics and hygiene leftovers (R24, P3)

### Bug Fixes
- **auth**: Close the package-6 review findings — redirect bypass, cascade gap, test pins

### Refactoring
- **auth**: Split the auth.ts and webauthn.ts god-files (R17)

## [6.18.0] - 2026-07-02

### Bug Fixes
- **auth**: Close the package-5 review findings on merge, stores and pages

### Features
- **auth**: Make AuthLocale fully required with a DeepPartial consumer merge
- **auth**: Extract AuthPageShell/FormErrorAlert and close the unstyled leaks
- **auth**: Lift the client stores onto the shared fetch/error infrastructure

## [6.17.0] - 2026-07-02

### Bug Fixes
- **auth**: Close the package-4 review findings on the error contract

### Features
- **auth**: Machine error codes on every handler — one error shape
- **auth**: Localized error mapping in every component, errorMessageFromCode public

### Refactoring
- **auth**: ParseBody preamble helper — one copy of the validation block

## [6.16.0] - 2026-07-02

### Bug Fixes
- **auth**: Wrap webauthn credential-field decodes, pin the unpinned security gates

### Refactoring
- **auth**: One canonical encoding layer for the security-relevant codecs
- **auth**: One duration parser for every TTL-shaped config field
- **auth**: Share the session payload, rotation-outcome policy and no-store header
- **auth**: Shared client utils for http, webauthn codecs and slot classes

## [6.15.0] - 2026-07-02

### Bug Fixes
- **auth**: Project invitation rows through a mapper, no-store the admin list
- **auth**: Isolate notification delivery per recipient, reject duplicate registry keys
- **auth**: Give PushPermissionPrompt an error path instead of silent dismissal
- **auth**: Make push enable outcomes honest end to end (client)
- **auth**: Log per-endpoint push failures — the hook stays optional, the logger is the floor
- **auth**: Reject the legacy recipients 'all' at wiring time, not first send
- **auth**: Close the insert race that bypassed the push-subscription key gate
- **auth**: Surface push-subscription write outcomes, write-strict preference flags

### Build
- **auth**: Exclude tests and stray artifacts from the npm package

### Features
- **auth**: Gate push-subscription owner reassign on key possession
- **auth**: Rate-limit notification endpoints, cap and gate their writes

### Refactoring
- **auth**: Rename notification recipients 'all' to 'online'

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
