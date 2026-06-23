# Changelog

All notable changes to this project will be documented in this file.
This changelog is automatically generated from [Conventional Commits](https://www.conventionalcommits.org).


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
