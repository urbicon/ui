# Changelog

All notable changes to this project will be documented in this file.
This changelog is automatically generated from [Conventional Commits](https://www.conventionalcommits.org).


## [6.50.0] - 2026-08-02

### Bug Fixes
- **design**: Stop nudging projects that decided shape at the tier
- **blocks**: Move the Drawer panel onto the contain tier
- **blocks**: Default purpose="tag" badges to the neutral intent
- **docs-gen**: Point the llms-full install at the public npm registry
- Drop the unfounded @sveltejs/kit peer dependency
- **blocks**: Render the tooltip panel as a span so it is legal inline
- **blocks,docs**: Answer the adversarial review of the tooltip span fix
- **blocks,docs**: Close the three ways past the display guard
- **blocks,docs**: The guard promised a lint that does not cover this
- **table,i18n**: Let the table cells follow the app's locale, not the host's
- **table,i18n**: Format the default Date column through the app's locale too
- **blocks,docs**: Correct the emitted-CSS guard's false positive and two false claims
- **blocks**: Close the two escaping and canary holes the re-review found

### Build
- Keep the incremental type-check cache out of the tarballs
- Stop the publish scripts writing into the tracked LICENSE files

### CI/CD
- Wait for CI instead of losing the e2e skip by seconds

### Documentation
- Correct the publishing facts, record the token-only theme contract
- Link back to urbicon.de from the landing footer
- Correct the bridge contract, the tier prop and two false family claims
- **blocks**: Give the package README a consumer install path
- Lead the install path with the sv add-on
- **docs-app**: Let the add-on path skip ahead to step 03
- Draw the SvelteKit boundary where it actually runs
- **table**: Correct two claims the round-3 review measured as wrong

### Features
- **design-engine**: Rank radius by role in the rubric, rename the ux axis
- **design-engine**: Ship the radius tiers and the category-vs-status rule
- **blocks**: Give Card a container tier for small content surfaces
- **blocks**: Guard every namespace by asking the compiler, not a model

### Miscellaneous
- Re-baseline bundle sizes for the Svelte 5.56.8 / Vite 8.2.0 bump

### Performance
- **table**: Resolve the cell locale once per table, not once per cell

### Testing
- **blocks**: Read the config and ask the compiler, not a list
- **blocks**: Give the display probe a positive control
- **blocks**: Assert every GLOB root reaches the emitted-CSS guard
- **blocks**: Reuse the escaper that already knows the two hard cases

## [6.49.0] - 2026-08-02

### Bug Fixes
- **design**: Deliver the context block to Claude Code

### CI/CD
- Silence the Node 20 deprecation, cut the release gate's e2e time
- Revert the worker bump — measured slower and flaky
- Shard the e2e suite, and stop re-running it on an already-green tag
- Unchain the build job, split the slow e2e slice four ways
- Give every CI job its own permissions block
- Deploy from Actions once the pipeline is green

### Documentation
- **design**: Group --help by purpose, knowledge first
- **design-engine**: Teach landmarks and the text-*-emphasis rung

### Features
- **mcp-server**: Bind loopback by default, add --host
- **design**: Get-component takes a batch of slugs

## [6.48.1] - 2026-08-01

### Bug Fixes
- **auth**: Stop accepting P2023, and never let classification throw
- **deps**: Unblock the release lint gate after the Biome 2.5.6 upgrade
- **design**: Make the installed hook actually run, and name the real stylesheet
- **blocks,table**: Give the table toolbar and pagination arrows accessible names
- **deps**: Make trust-publishers.sh actually run

### CI/CD
- **deps**: Split the release into gate + publish, on OIDC instead of a token
- **deps**: Hand packages over to OIDC one at a time, not all at once
- **deps**: Add a script to register the trusted publishers

### Miscellaneous
- Reformat the three files biome 2.5.6 wants differently

### Styling
- **design**: Keep the tailwindSteps doc comment on tailwindSteps

### Testing
- **blocks**: Refresh the Toggle pixel baselines after the shrink-0 fix

## [6.48.0] - 2026-08-01

### Bug Fixes
- **auth**: Make the Prisma adapter answer misses instead of throwing
- **auth**: Say "revoke all" outright instead of keeping an empty family
- **auth**: Guard the Prisma client through a proxy, not a copy
- **auth**: Narrow the id guard to the error it claims to catch
- **blocks**: Keep the Toggle track at its nominal width
- **blocks**: Stop the month name from setting the calendar's width
- **docs-app**: Hide the tile scroller arrows on touch, not by width

### Documentation
- Add a step 00 and align the app.css story across surfaces
- **auth**: Say which id column types an adapter may use

### Features
- **design**: Version-stamp the context block, content-based staleness
- **sv**: Add the @urbicon-ui/sv Svelte-CLI community add-on (beta)
- **auth**: Make the adapter conformance suite runnable for third-party adapters (#71)
- **auth**: Pin what an adapter does with an id it cannot represent
- **table**: Collapse mobile cards, fold the filter tools into one menu

### Miscellaneous
- Add the sv scope to the commitlint enum
- Upgrade dependencies

## [6.47.2] - 2026-07-31

### Bug Fixes
- **design-engine,docs-gen**: Close masked regions the way a parser does

## [6.47.1] - 2026-07-31

### Bug Fixes
- **artifact-studio**: Derive session ids from a CSPRNG
- **docs-gen**: Escape YAML scalars fully, match script tags exactly
- **design-engine**: Scan masked regions linearly, fix two silent mis-masks
- **design-engine**: Keep the heading and frontmatter gap on one line

### CI/CD
- Scope the GITHUB_TOKEN to contents: read

### Testing
- Escape regex metacharacters, tighten the URL assertion

## [6.47.0] - 2026-07-31

### Bug Fixes
- **blocks**: Let the date components follow the app's locale
- **blocks**: Verify the provider locale before it reaches Intl
- **blocks**: Give the intent fills their own on-colour token
- **table**: Move the whole intent ladder, not just its base
- **blocks**: Give Popover a phrasing-content mode so citation chips stop breaking SSR
- **table**: Let a column's capabilities follow its configuration, not its name
- **table**: Keep the row count, and make the declared grouping key stay in the menu
- **blocks**: Give the selection controls their own radius, and read initials under the overlap
- **blocks**: Keep the checkbox on its tier, and gate the packages that carry the design loop

### Documentation
- Catch the surfaces the five fixes left behind

### Testing
- **e2e**: Re-capture the four rooms baselines the on-fill split moves (darwin)
- **blocks**: Prove the inline panel comes back, and read the paragraph rule from Svelte

## [6.46.0] - 2026-07-31

### Bug Fixes
- **build**: Build packages in dependency order, and catch `any`-typed variants
- **docs-app**: Let room-accent subtle surfaces flip with the scheme

### CI/CD
- Arm the workflows for GitHub and keep the pixel suite out of them

### Documentation
- Prepare the repo surface for a public audience
- Record the settled half of the publisher-ownership entry
- Move the review plan into the local archive
- **technical-debt**: Log the Codeberg build-time dependency the move exposed
- Move the debt log to GitHub issues and leave a pointer
- Make the README sell the library, not the monorepo

### Features
- **docs-app**: Polish the landing tiles for launch
- **docs-app**: Complete the specimen book, drop the styling island
- **docs-app**: Retell getting started in five steps, latched
- **docs-app**: Scale the salon fiction to a four-house group

### Miscellaneous
- Strip agent-session trailers from the history before the GitHub move
- Point every repo reference at GitHub
- Untrack prototypes/_archiv, so the ignore rule actually holds
- Move dev harness to the @urbicon-ui scope on npm
- Drop the unused chokidar devDependency from both docs packages

## [6.45.0] - 2026-07-30

### Bug Fixes
- **design-engine**: Accept `z-index` as an alias for the shadows section
- **design**: Answer the question that was asked, not the whole manual
- **blocks**: Make Scroller dots reachable, and scale emphasis
- **blocks**: Warn when a centred Scroller is too narrow to work
- **mcp-server**: Stop leaking a server instance per HTTP session
- **sveltekit-utils**: Make URL-param reads prerender-safe
- **design**: Sweep the CLI for silent wrong answers, and make the ADR log mean what it says
- **docs-gen**: Resolve Pick<> in an extends clause, and stop @related from swallowing prose
- **docs**: Connect ApiReference, TypesReference and DocsLayout to the translations they ship
- **blocks**: Stop SegmentGroup oscillating between its two layouts
- **table**: Take the table's own intents off solid grounds
- **docs-gen**: Destructuring a split() result is not a checked index
- **docs-app**: Put the stage shadow on the stage
- **docs-app**: Give the breadcrumb pill the emphasis step, not the text step

### Build
- Add the two app scopes commitlint never knew about

### Documentation
- Note the `init --with-primer` split in the CLI overview
- Log the ADR-log defects, ignore the artifact workbench
- Log the CLI silent-answer pattern as one audit, not a fifth fix
- Radius/technical debt
- Log on-primary-as-universal-on-colour token debt
- Log table grouping-menu gap for non-column group keys
- Log the unreproduced Scroller reports and the Tailwind 4 transition caveat
- **blocks**: Fix the @example blocks that never compiled
- **docs-app**: Describe the third channel step in the generator header

### Features
- **artifact-studio**: Add the local artifact studio
- **design**: Teach layout markup in the primer
- **blocks**: Add Scroller — a row that scrolls only when it must
- **docs-app**: Add landing journey-v2 prototype route (stage 1)
- **docs**: Port the flap board to Svelte with a live specimen panel
- Landing hero, the playground wave, and the gates that keep them honest
- **docs-app**: Landing journey stage 2 — livery + live tile content
- **docs-app**: Landing journey row 2 — the hero inventory, one row tall
- **docs-app**: Row 2 inherits the selected component's channel
- **docs-app**: Generated channel register — one wheel, two levels
- **docs-app**: Landing journey row 3 — getting started, step 3 is the agent
- **docs-app**: Port the salon livery showcase from chat-demo
- **docs-app**: Journey row 1 — salon-universe tiles, mandatory snap, agent replay
- **docs-app**: The journey replaces the landing page
- **docs-app**: Gate the three docs registries against silent drift
- **docs-gen**: Type-check every @example block, and widen the i18n audit to packages/docs
- **table**: Warn when a summary aggregates nothing numeric
- **docs-app**: Landing polish — name tile, tile widths, row 2 legibility
- **docs-app**: Give each channel an accent step, and lift the stage
- **table**: Make the filter bar read as one control surface
- **docs-app**: Colour the docs rooms by component family
- **docs-app**: One open group, a rail instead of a staircase
- **docs-app**: Give each channel a text step, so the accent can stay fresh
- **docs-app**: Retell the getting-started row, and give the landing a footer

### Miscellaneous
- Add split-flap board prototype for the landing rework
- **docs**: Retire the split-flap board direction
- Retire the chat-demo app — the salon showcase lives in docs-app

### Refactoring
- **design**: Make the primer step true in both paths, not contradicted in one
- **design**: Move the primer step out of the template and into `init`
- **docs**: Make flap cells autonomous so the real Table can drive the board
- **design**: Rename the second score axis from slop to craft

### Testing
- **artifact-studio**: Prove the sandbox CSP actually blocks
- Exclude fixtures
- **e2e**: Re-baseline the rooms shots the channel wave moved

## [6.44.0] - 2026-07-26

### Bug Fixes
- **i18n**: Drop the setup warm-up, keep one timeout where the work happens
- **blocks,table**: Move the hover idiom off surface-subtle
- **design**: Reject unknown CLI flags instead of answering a question nobody asked
- **table**: Stop persisting a controlled searchTerm

### Documentation
- Note that a deploy.env edit needs a service restart to take effect
- Narrow the surface-subtle entry to the token's own role
- Close the VR interaction-state entry with what pixels cannot prove
- Quantify what the i18n catalog actually costs
- Record the hold on the i18n catalog split
- Withdraw the z-index debt entry — the reference does teach them
- **docs-gen**: Rewrite both architecture diagrams against the sources
- Close the four debt entries this wave resolved

### Features
- **docs-gen,docs**: Carry `@see` through type declarations, not just props
- **design**: Add `urbicon primer` — the always-needed knowledge in one call

### Refactoring
- **blocks**: Extract the field message into an internal core
- **blocks**: Finish the field-message extraction across the Form family

### Testing
- **e2e**: Run the suite in parallel — 310s to 66s
- **e2e**: Make the visual matrix actually see interaction states and small elements
- **blocks**: Guard interaction steps against every reading surface
- **e2e**: Cover interaction states, by pixels and by resolved colour
- **e2e**: Wait for the interaction state, not for two frames
- **docs-gen**: Run the two suites that sat outside the include pattern

## [6.43.2] - 2026-07-26

### Bug Fixes
- **blocks**: Put the ChatMessage bubble on the bridge radius tier
- **blocks**: Hang the ChatMessage footer off the bubble's own column
- **blocks,table**: Spread the light surface ladder at the ramp
- **blocks**: Let the message timestamp keep the bubble's edge on both sides
- **docs**: Reconcile the typography counts after merging the surface-ladder work

### Documentation
- Record the baseline-hygiene lesson in the CI entry

### Refactoring
- **blocks**: Stop stacking a framed card inside ToolCallCard
- **blocks**: Share one clipboard state machine across the copy affordances
- **blocks**: Render the chat icon controls through CoreIconButton

### Testing
- **e2e**: Re-baseline darwin after the surface-ladder change
- **e2e**: Regenerate the Linux baselines from the merged tree

## [6.43.1] - 2026-07-24

### Bug Fixes
- **blocks,docs**: Give interaction fills a real hover step and disabled text a legible tone
- **table**: Wire keyboard navigation through groups, split the mobile state snippets
- **design-engine,blocks,docs**: Finish rolling out the interaction-fill hover rung

### Documentation
- Trim AGENTS.md to gotchas, move procedures into skills

### Refactoring
- **design**: Slim the consumer context block to an entry point

### Styling
- **e2e**: Drop the unused page parameter from the geometry helper

### Testing
- **e2e**: Pin the Chromium channel and refresh the stale floating/guide baselines
- **e2e**: Make the "opens below" tests actually assert it, drop the disproven renderer story
- **i18n**: Stop the audit-scanner suites timing out on loaded hardware
- **e2e**: Drop the darwin-only gate on the visual-regression suite
- **e2e**: Add the Linux visual baselines, generated on the deploy host

## [6.43.0] - 2026-07-24

### Bug Fixes
- **blocks**: Harden the data-schema against the W3 review findings
- **blocks**: Give the Slider and Progress track a visible fill

### Documentation
- **blocks**: Note the opt-in Urbicon A2UI catalog in the A2UIView description
- **blocks**: Ship the A2UI guide and an agent-generated-UI recipe
- Refresh the typography `uses` counts after the merge

### Features
- **blocks**: Add the Urbicon-native A2UI catalog (opt-in second catalog)
- **blocks**: Wire the Urbicon A2UI prompt, data schema and demo/docs surfaces
- **blocks**: Let an A2UI surface outlive the reply that created it

### Miscellaneous
- Merge the AI-kit branch (A2UI multi-step surfaces, transport, guide)

### Refactoring
- **blocks**: Thread an A2UI catalog abstraction through the engine

## [6.42.0] - 2026-07-24

### Bug Fixes
- **blocks,design-engine**: Drop `info` from the Tooltip palette
- **blocks**: Make `error` beat `intent` structurally, give Combobox an error frame
- **blocks,table**: Transition lists must name Tailwind 4's discrete transform properties
- **blocks,table**: Address the W5 adversarial-review findings

### Documentation
- Give form validation a normative rule, correct the intent palette list
- Reconcile technical-debt after W5 form-family

### Features
- **blocks**: Roll the interaction vocabulary out to Toggle and RadioGroup

### Testing
- **e2e**: Add RadioGroup, PinInput and TimeInput to the VR + dark-axe matrix

## [6.41.0] - 2026-07-24

### Bug Fixes
- **table**: Make date filters work for ISO strings and Date values
- **table,blocks**: Tell "stored empty" apart from "nothing stored"
- **table,blocks**: Address the W4 adversarial-review findings
- **docs-gen,mcp-server**: Split capital runs in toSlug, migrate the two affected slugs
- **docs-gen,docs,shared-types**: Keep prose @see out of the seeAlso link field
- **docs-gen**: Keep inline {@link …} out of the void in extracted prose

### Documentation
- **table**: Document row-click selection and the data-column slot contract
- Reconcile technical-debt after W4 table-api
- Reconcile technical-debt after W6 docs-gen-cleanup
- Record the VR fallout of the tightened tolerance

### Features
- **table**: Loading/error state props, row-click selection, onReady context

### Miscellaneous
- **docs-gen,shared-types,docs-app**: Prune the dead docsConfig + config surface

## [6.40.4] - 2026-07-24

### Bug Fixes
- **auth**: Distinguish passkey delete-race from counter regression
- **blocks,docs,docs-gen**: Six small debt fixes (W7 polish sweep)
- **blocks,docs,auth**: Address W7 adversarial-review findings

### Documentation
- Reconcile technical-debt after W7 polish + auth-micro

## [6.40.3] - 2026-07-24

### Bug Fixes
- **docs**: Mark bilingual chrome subtrees with their active locale
- **docs**: Scope TOC lang to kicker spans, not the whole aside

## [6.40.2] - 2026-07-24

### Documentation
- Reconcile technical-debt after W2 gate-harden

### Testing
- **e2e**: Add dark-mode axe gate + scan playground stages
- **e2e**: Tighten VR tolerance, make fixtures deterministic, re-baseline
- **e2e**: Document the dark-axe gate's fixture scope

## [6.40.1] - 2026-07-24

### Bug Fixes
- **blocks**: Guard informative-text contrast; quaternary is mark-only
- **docs**: Raise Shiki punctuation to WCAG AA + add contrast guard
- **docs-app**: Darken Rooms accent + soft text to clear WCAG AA
- **docs-app**: Sync Rooms palette docs to new accent; harden W1 tests

### Documentation
- Mark the A2UI DateTimeInput debt entry as shipped, keep Tabs
- Stamp technical-debt decision-pass verdicts
- Reconcile technical-debt after W1 (5 resolved, 1 new)

## [6.40.0] - 2026-07-24

### Bug Fixes
- **chat-demo**: Buffer pretty-printed multi-line a2ui envelopes in the splitter
- **blocks**: Demand compact single-line envelopes in the a2ui prompt
- **blocks**: Make the A2UI streaming wait visible with a skeleton pulse
- Harden the wave against the adversarial review findings (7 PROVEN)

### Documentation
- Log the A2UI DateTimeInput/Tabs catalog gap in the debt log
- **blocks**: Un-hardcode the A2UI subset count, document the new mapping

### Features
- **chat-demo**: Ground the demo agent with a mock salon tool
- **sveltekit-utils**: Add streamSse, a zero-dep SSE reader for POST streams
- **blocks**: Render A2UI DateTimeInput through DatePicker and TimeInput
- **chat-demo**: Stream via streamSse, render ToolCallCards and action chips

### Miscellaneous
- Add a root chat script for the a2ui demo dev server

## [6.39.0] - 2026-07-24

### Bug Fixes
- **blocks**: Harden A2UIView against adversarial review findings
- **chat-demo**: Make the a2ui fence splitter markdown-aware
- **docs**: Correct A2UIView urlPolicy example and playground stop

### Documentation
- **docs-app**: Add A2UIView docs page, specimen and playground reply
- **docs-app**: Refresh typography usage counts for A2UIView

### Features
- **docs**: Render prev/next from the layout instead of per page
- **blocks**: Add A2UIView — trusted-catalog A2UI v0.9.1 renderer
- **chat-demo**: Local Anthropic A2UI chat demo (prompt-first JSONL)

### Miscellaneous
- **docs**: Delete the dead docs-theme.css token file
- **blocks**: Record A2UIView in the bundle-size baseline

## [6.38.0] - 2026-07-23

### Documentation
- **docs-app**: Add prev/next navigation to the Table documentation pages
- **tokens**: Refresh typography usage counts for the new components

### Features
- **blocks**: Add Kbd, CopyButton and AvatarGroup components

### Miscellaneous
- **blocks**: Record Kbd, CopyButton and AvatarGroup in the bundle-size baseline

## [6.37.2] - 2026-07-23

### Bug Fixes
- **docs**: Render route-relative seeAlso as internal ApiReference links

### Documentation
- Refresh technical-debt after the field-chrome dedup wave
- **docs-app**: Sync typography-uses counts after field-chrome dedup

### Miscellaneous
- **docs**: Drop dead docs-theme intent tokens and unused fonts

### Refactoring
- **blocks**: Dedupe field chrome into shared style fragments

## [6.37.1] - 2026-07-23

### Bug Fixes
- **blocks**: Re-arm PinInput onComplete after an external value reset
- **blocks**: Announce the TimeInput meridiem state via spinbutton semantics
- **blocks**: Pin a light color-scheme on the QRCode card frame

### Documentation
- Log the field-chrome duplication across the form components

### Miscellaneous
- **blocks**: Record the component trio in the bundle-size baseline

## [6.37.0] - 2026-07-23

### Documentation
- **tokens**: Refresh typography usage counts for the component trio

## [6.36.0] - 2026-07-23

### Bug Fixes
- **table**: Seed initialGroupBy/initialSummaryConfigs in the store constructor
- **docs-gen**: Skip family barrels in discovery; measure family members in bundle-size
- **blocks**: Teach imports-lint to scan family subdirectories
- **blocks**: Review-hardening for the P3 agent surfaces and docs

### Documentation
- Remove docs theme toggle
- Claim table initial* seeding debt (worktree table-initial-seed)
- Close the table initial* seeding debt entry
- Add the ai JSDoc tag to the taxonomy, refresh typography use counts

### Features
- **blocks**: Bundle-size --entry — ad-hoc combined measurement for marginal cost
- **blocks**: Add PinInput, TimeInput and QRCode components
- **blocks**: Streaming-markdown parser core (AI-Kit P0 spike)
- **blocks**: Add SplitPane primitive (resizable two-pane layout)
- **blocks**: Streaming markdown renderer, CodeBlock, CitationChip (AI-Kit P1)
- **docs**: Add streaming-markdown playground with live fixture replay
- **blocks**: Extract shared file-intake core, refactor FileUpload onto it
- **blocks**: Add chat conversation surfaces (AI-Kit P2)
- **docs**: Add chat playground and scroll-engine e2e coverage
- **blocks**: Add ToolCallCard and ReasoningDisclosure, wire them into ChatMessage
- **docs**: Document the AI family — ten component pages, specimen chapter, recipe, pattern

### Testing
- **e2e**: Gate split-pane through the a11y scan; record the AI-family size baseline
- **blocks**: Make the file-intake type-echo assertion runtime-tolerant

## [6.35.0] - 2026-07-23

### Breaking Changes
- **blocks**: Extract a layer-0 core — public components stop importing each other

### Documentation
- **blocks**: Pin three mint-registry contract notes from the review
- Document the layer-0 core, close five debt entries, refresh the size baseline

### Features
- **i18n**: Make the blocks de catalog lazy, with an eager SSR escape hatch
- **blocks**: Strip tv() diagnostic strings from prod bundles via error codes
- **blocks**: Imports-lint — allowlisted cross-component import guard

### Refactoring
- **blocks**: Move the remaining trivial embeds onto the layer-0 cores

### Testing
- **e2e**: Add loading and removable sentinels to the VR primitives fixture

## [6.34.0] - 2026-07-22

### Bug Fixes
- **docs-app**: Point the clickable-card recipe at a real mint

### Documentation
- Mark debt-fix-wave-4 entries as in progress
- **docs-app**: Move misfiled usage demos out of Customization (XC-6)
- **docs**: Add the missing package README, drop dead generator scripts
- Close the debt-fix-wave-4 entries and log the follow-up findings

### Features
- **blocks**: Tree-shake the mint registry via the resolveIcon pattern
- **table**: Add initialSort, initialFilters and initialSelectedIds seeds
- **docs-app**: Add live async-search and server-mode table demos

## [6.33.0] - 2026-07-22

### Breaking Changes
- **table**: Rename the appearance prop to variant
> **BREAKING:** the Table prop appearance is now variant (flush | surface | framed unchanged).

### Bug Fixes
- **blocks**: Migrate ButtonGroup and Toolbar containers to the restProps-first contract
- **blocks**: Gate calendar day/agenda arrow-key navigation at the date bounds
- **docs-app**: Name the combobox demos, fix badge warning contrast, defuse the LiveFeed ghost import
- **docs**: Wake slotClasses.helpToggle and localize the playground reset/hints labels

### Documentation
- Mark debt-fix-wave-3 entries as in progress
- Close the debt-fix-wave-3 entries and log the follow-up findings

## [6.32.0] - 2026-07-22

### Documentation
- Log the four bundle-composition findings from the size breakdown

### Features
- **blocks**: Add per-component bundle-size measurement + baseline gate
- **blocks**: Sourcemap byte attribution for bundle-size (--breakdown)

## [6.31.0] - 2026-07-22

### Breaking Changes
- **blocks**: Unify the style-axis vocabulary — appearance becomes variant, separated becomes card
> **BREAKING:** SegmentGroup/Toggle/Slider `appearance` prop is now `variant`; Accordion `variant="separated"` is now `variant="card"`.

### Bug Fixes
- **blocks**: Migrate Button to the restProps-first contract via conditional ARIA merges
- **blocks**: Repair Calendar bind:value write-back and direction-gate view swipes

### Documentation
- Record Button's conditional-merge pattern as the restProps reference
- Log two follow-up findings from the wave reviews in technical-debt
- Re-measure the tokens-page uses column after the XC-9 rhythm sweep

### Features
- **blocks**: Unify the listbox item rhythm across Select/Combobox/Menu/CommandPalette (XC-9)
- **design-engine**: Scope deterministic lint rules to code and add a visible exemption mechanism

### Testing
- **e2e**: Scope the floating-spec tooltip locator, re-baseline the menu shot

## [6.30.1] - 2026-07-21

### Testing
- **e2e**: Add recipe live-preview coverage + a hydration marker
- **e2e**: Add Calendar interaction spec on a fixed-month fixture
- **e2e**: Align the auth spec with PORT isolation and the rotation grace

## [6.30.0] - 2026-07-21

### Bug Fixes
- **blocks**: Keep consumer-placed focus when an overlay opens
- **blocks**: Forward a consumer-passed native onchange on Checkbox
- **blocks**: Resolve ButtonGroup roving radios by value, not position
- **docs**: Round-trip typed values in the playground SegmentGroup branch

### Documentation
- Reconcile the restProps-ordering contract with the code

### Features
- **blocks**: Add Combobox seedOptions - label seed for pre-selected values

### Testing
- **blocks**: Discover contrast drift-guard variant sources by glob
- **docs-app**: Add the en/de translation-parity gate + typed nav keys

## [6.29.2] - 2026-07-21

### Documentation
- **auth**: Harden the CSRF guidance at the seams found by adversarial review

## [6.29.1] - 2026-07-21

### Documentation
- **auth**: Restore trustedOrigins ['*'] as the kernel-CSRF off-switch

## [6.29.0] - 2026-07-21

### Bug Fixes
- **docs-gen**: Satisfy noUncheckedIndexedAccess in guide-injection

### Documentation
- Log the lost-webhook symptom on the publisher debt entry
- Move consumer guides into their packages (GUIDE, MIGRATION-v5, STICKY-PINNING)
- Declare the completed consumer-knowledge-surface migration

### Features
- **docs-gen**: Extract package guides into llms-full + design-content bundle
- **design**: Urbicon guide command over bundled package guides
- **docs-app**: Render the shipped AUTH.md at /auth/guide + absolute README links

## [6.28.0] - 2026-07-20

### Documentation
- Declare the documentation taxonomy (DOCS-SURFACES.md)

### Features
- **docs-gen**: Distribute guide documents into the LLM output

### Miscellaneous
- Ignore the generated guide copies under static

## [6.27.1] - 2026-07-20

### Documentation
- **auth**: Ship the canonical AUTH.md inside the package
- Record the knowledge-surface debt and the public/internal rule

## [6.26.3] - 2026-07-20

### Documentation
- Log that the Buny deploy is the effective npm publisher

### Miscellaneous
- Vendor the LICENSE into every published package

## [6.26.2] - 2026-07-20

### CI/CD
- Gate packed tarballs before publish

## [6.26.1] - 2026-07-20

### Bug Fixes
- **blocks**: Clickable Card kept the UA button font — font-inherit is not a Tailwind utility
- **docs-gen**: Fail loud when the global llms.txt aggregator write fails
- **docs-gen**: Thread typescript.configPath through updateConfig like the constructor
- **blocks**: Dedupe the Select orphan-value dev warn per value
- **blocks**: Warn when an explicit Pagination showFirstLast is inert
- **docs**: Playground Select controls keep the control's real value type
- **auth**: Fold in the third-pass federated-JWKS follow-ups
- **table**: Route selection checkboxes through onCheckedChange, not onchange
- **docs**: Pair the remaining bare meta-marker kickers

### Build
- Upgrade @sveltejs/kit to 2.70.1 across the workspace catalog

### Documentation
- **docs-gen**: Close the JSDoc coverage gap on the config surface
- **app**: Close the XC-4 customization coverage gap on all 36 primitive pages
- Reconcile technical-debt after the qa-polish-wave
- Log the e2e-surfaced findings (Checkbox onchange footgun, server-mode demo gap)
- **auth**: Correct the kernel-CSRF off-switch to checkOrigin:false
- Log the v6.26.0 review findings in technical-debt
- **auth**: Scope the kernel-CSRF availability note to Kit versions
- Log the validateCsrf Origin-less-browser trade-off
- **auth**: Drop the pre-2.70 kernel-CSRF caveats

### Features
- **blocks**: Variants:lint now verifies theme-key existence for scale-suffixed classes
- **blocks**: Surface Combobox queryFn failures via onError
- **auth**: Purpose-bound signed tokens, verifier input caps, per-config logging, unlink

### Miscellaneous
- Ship LICENSE and drop tsbuildinfo in published tarballs

### Refactoring
- **docs-gen**: Drop the dead typeAnchor/typePreview emission
- **docs**: Drop the dead ApiProp.typeAnchor/typePreview fields
- Tokenise the remaining sub-xs type sites outside blocks

### Testing
- **e2e**: Make the port overridable and cover table grouping/selection/reorder/remote

## [6.26.0] - 2026-07-20

### Bug Fixes
- **docs**: Declare shiki as a peer dependency
- **mcp-server**: Trim the npm tarball to the served source
- **shared-types**: Point subpath exports at real emits
- **blocks**: Give filled warning surfaces their own on-colour
- **blocks**: Focus the overlay panel when nothing else is focusable
- **docs**: Pair the bare meta-marker kickers with utility fallbacks
- **table**: Use null as the summary menu's empty selection
- **auth**: Harden the federated identity surface (adversarial review)

### CI/CD
- Publish with bun so catalog:/workspace: specifiers resolve

### Documentation
- Reconcile technical-debt after the sso-debt wave

### Features
- **auth**: Federated identity (SSO) between Urbicon apps

### Miscellaneous
- **debt**: Claim entries for the sso-debt wave (in-progress markers)
- Exclude co-located tests from published tarballs

### Refactoring
- **docs**: Drop the dead CodeExample workaround on the guide page

## [6.25.0] - 2026-07-14

### Bug Fixes
- **blocks**: Tokenise the avatar palette, delete the dead ripple rule
- **docs-gen**: Emit the slots field in the generated API interface
- **docs-app**: Retire the prerender tolerance list, point demos at real routes
- **docs**: Honour system dark mode; announce copy and modified count
- **docs-app**: Unify breadcrumbs, wire type links on the pages that have types
- **blocks**: Stop a consumer handler from silently disabling Dialog/Drawer dismissal
- **docs**: Extract CodeExample code via the Svelte parser, not a regex
- **blocks**: Honour a consumer `id` on Input and Textarea, and make labels reach the control
- **blocks**: Drop aria-orientation from ButtonGroup's multi-selection arm
- **blocks**: Make text-on-primary mode-aware so dark-mode fills clear AA
- **blocks**: Make the Tooltip fade actually play in top-layer mode
- **docs-gen**: Declare slots on the emitted ComponentAPIInfo interface
- **blocks**: Swallow pointer events on the fading popover panel
- **blocks**: Inert the popover panel while closed
- **blocks**: Harden Guide cross-route touring against async false-stops
- **blocks**: Clamp range navigation span-preserving to minDate/maxDate
- **docs-gen**: Drop the duplicated slots member from the emitted interface
- **docs**: Make the search index find what the docs actually say
- **docs**: Correct the false and stale claims the theming pass introduced
- **docs**: Scope playground share links to the playground that minted them

### Build
- Gate releases on complete declaration emit

### Documentation
- Reconcile the debt log and document the restProps contract
- Log the publish-m3 wave findings
- Reconcile the debt log after the Opus quality wave
- Retire the text-on-primary entry, log what landing it revealed
- Resolve XC-7 with a form-input disambiguation matrix
- Split the overlay-motion contract into modal and anchored halves
- **blocks**: Document the optimistic controlled contract for open-state primitives
- **blocks**: Fix Menu catalog JSDoc and close CommandPalette related-loop
- Reconcile the debt log after the fable-debt-wave
- **customization**: Stop the docs contradicting the theming truth
- Log what the M3 wave surfaced but deliberately did not fix

### Features
- **docs-app**: Give every recipe card a tailored preview
- **docs**: Link API types to their definitions, revive dead rendering
- **blocks**: Add CSS-native enter/exit motion to Popover and Menu
- **blocks**: Contain ConfirmDialog onConfirm rejections via onError
- **blocks**: Dedicated --color-live token for the now indicator
- **docs-gen**: Wire the ts.Program for cross-file type resolution
- **docs**: Name the section prev/next leads into
- **docs**: Add share links to the playground configurator
- **docs**: Index docs content for full-text search

### Refactoring
- **docs-gen**: Fold docsConfig off the AST instead of eval-ing it
- **blocks**: Tokenise the sub-xs type floor as --text-2xs/--text-3xs

### Styling
- Default offset for sticky table header

### Testing
- **blocks**: Audit every intent contrast pair, fix two sub-AA tokens
- **e2e**: Scan the docs code panel for a11y, and make the baseline a ratchet
- **blocks**: Cover the in-place exit lag and unmount-during-lag paths
- **docs-gen**: Guard the emitted api.ts interface against data drift

## [6.24.0] - 2026-07-14

### Bug Fixes
- **sveltekit-utils**: Route non-2xx cron responses to onError
- **table**: Route slotClasses through the tv() conflict fold
- **docs**: Name the code textbox and lift Shiki comment tokens to WCAG AA
- **blocks**: Let internal ARIA win over restProps in form primitives
- **blocks**: Open ConfirmDialogProps to native/data attribute pass-through
- **docs-gen**: Surface real tv() slot names + gate llms.txt index
- **design-engine**: Teach slop heuristics about Section headings + example code
- **blocks**: Announce interactive Badge as a button, guard purpose="dot"
- **blocks**: Unify Pagination edge policy to disabled-but-visible
- **blocks**: Harden Toast hover-pause, reduced-motion and promise-settle a11y

### Documentation
- Mark 7 debt entries as in-progress for the opus debt-sweep wave
- Resolve six debt entries and log four follow-ups (Opus debt-sweep)
- Retire the three debt entries resolved by this wave
- Reconcile technical-debt after the primitives-debt wave

### Features
- **blocks**: Add Sparkline fluid prop for responsive rendering

## [6.23.0] - 2026-07-13

### Bug Fixes
- **blocks**: Key calendar weekday header by column position
- **docs-gen**: Correct generated cross-reference links (route base + urbicon type anchors)
- **docs-gen**: Carry the group segment into per-scope llms.txt index links
- **blocks**: Harden Select/Combobox a11y and grouped keyboard-nav
- **blocks**: Merge consumer aria-describedby across the form family

### Documentation
- **recipes**: Audit help-tooltip, stat-tile, clickable-card, unsaved-changes-guard
- **recipes**: Add filter-sidebar layout recipe
- **recipes**: Lift slop on login, onboarding-flow, pricing, page-header
- Reconcile technical-debt after the primitives-hardening wave
- Retire the dead Lighter plan codename from source comments
- Add JSDoc coverage to sveltekit-utils and mcp-server APIs
- Log cron onError and docs-gen slot-extraction gaps as debt
- Log the two docs-link / recipe-sweep findings as debt

### Features
- **blocks**: Pause Toast auto-dismiss on hover and focus
- **blocks**: Add roving tabindex to ButtonGroup single-select

### Testing
- **blocks**: Cover DatePicker/DateRangePicker typed-empty clear and iso serialization
- **docs-gen**: Make llm.txt link-existence check runtime-agnostic

## [6.22.0] - 2026-07-13

### Bug Fixes
- **mcp-server**: Drop broken bin entry and declare the bun engine requirement
- **table**: Make live-update and column-visibility sets actually reactive
- **blocks**: Deliver consumer aria-describedby to the focusable element
- **docs**: Stop playground anchor drift and wire control hints for AT
- **blocks**: Calendar mini-month navigation, interactive-chart a11y, drag teardown

### Documentation
- **table**: Build out the live-updates page with a working demo
- Log wave-1 debt findings, drop stale semantic-radii noindex entry
- Update debt log after the wave-2 packages
- **blocks**: Add narrative help-panel demos to the guide page
- Reconcile debt log with the wave-3 results

### Features
- **sveltekit-utils**: Add opt-in TableQuery URL sync for server-mode tables
- **blocks**: Give the checkbox a stroke draw-in and a real interaction layer

### Refactoring
- **docs-gen**: Remove the dead prop-category scaffolding

### Testing
- **e2e**: Add modal, number-input, table-core and token-smoke guards

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
