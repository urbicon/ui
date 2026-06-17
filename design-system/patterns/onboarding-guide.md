# Onboarding & In-App Help

Guide a first-run user and keep help available in context, using the Guide system over one
headless controller — without a modal wizard that blocks the app. Guide is the library's
sequential, system-driven overlay pattern (it decides *when*, *in what order*, and *in what
mode* help appears), unlike the spatial, event-driven overlays (`Dialog`, `Popover`, `Tooltip`).

## Layout

- **Provider:** one `GuideProvider` near the app root, holding one `GuideController` you create yourself for programmatic control.
- **Tour renderer:** one `<Guide />` inside the provider — invisible until a tour starts; it owns the top-layer spotlight + bubble.
- **Help panel:** one `GuidePanel` — non-modal, docks to a screen edge at `--z-sidebar`; the app stays interactive behind it.
- **Entry point:** a `GuideBeacon` placed inline or absolutely over a "new" feature — the gentle, opt-in tour entry. Never auto-start.
- **Targets:** mark each referenced element once with `data-guide="<id>"`; tours, hints, markers, and mentions all resolve through that one namespace.

## Component Selection

| UI Need | Component | Configuration |
|---|---|---|
| First-run walkthrough | `Guide` + a `GuideTour` | Opt-in, 3–5 steps; spotlight each step `target` |
| Gentle tour entry | `GuideBeacon` | `tour={...}`; hides itself once the tour is seen |
| Always-available help | `GuidePanel` + `GuideArticle` | Non-modal; controller-driven `openPanel(article?)` |
| "What does this do?" affordance | `GuideMarker` | `for="<id>"` → opens the panel at the article (UI → guide) |
| Point an article at the UI | `GuideMention` | `for="<id>"` inside an article; highlights on hover **and** focus (guide → UI) |
| One-off contextual nudge | `GuideHint` | `trigger="mount"`, or `"manual"` + `open`; `once` persists "seen" |
| Onboarding analytics | `onStep` / `onComplete` / `onSkip` | On the `GuideTour` — the funnel + drop-off signal |

## Behavioral Rules

- **Helpful, not intrusive.** Default to the callable panel and the waiting hint. The scrim tour is the most aggressive mode and stays opt-in (beacon or explicit button) — never auto-started.
- **One controller, many surfaces.** Create the `GuideController`, pass it to `GuideProvider`, and drive everything (`startTour`, `openPanel`, `hasSeen`) from it.
- **Persist "seen."** Tours and `once` hints mark themselves seen on end, so a returning user is not nagged. `stopTour()` (route change / unmount) deliberately does NOT mark seen and is analytics-silent.
- **Track the funnel.** Wire `onStep` / `onComplete` / `onSkip` — `onStep.via` distinguishes `start` vs `next`/`prev`, and `onSkip.index` is the drop-off step. This is the real business value of onboarding.
- **Cross-route tours are app-driven.** The controller survives client navigation and the renderer re-anchors once the new route's `data-guide` target appears; the app navigates in `tour.onStep` (e.g. `goto(stepRoutes[index])`). Mount `Guide` in the layout — a route-local renderer unmounts mid-tour. Full recipe: `docs/GUIDE.md` §9.
- **Learning-by-doing steps:** `GuideStep.advance: 'action'` (paired with `interactive: true`) disables Next; the user performs the real action and the app advances via `controller.next()`.
- **Content lives in the app**, not the library: steps, article text, and `data-guide` selectors are app-owned (and i18n'd by the app).
- **Reduced motion** is honored automatically (panel slide, beacon pulse, step fade) — no extra work.

## Anti-Patterns

- Do not auto-start a tour on page load. Onboarding that hijacks the screen before the user acts is exactly why product tours earned a bad reputation.
- Do not use a modal `Dialog` / `Drawer` as the help panel. The panel must be non-modal so a `GuideMention` can highlight a UI element while the panel is open (the bidirectional link breaks otherwise).
- Do not build a multi-step **form wizard** with `Guide`. That is a `Stepper` + form pattern; `Guide` overlays *existing* UI, it does not collect input.
- Do not invent `data-guide` ids with `Math.random()` — they are author-chosen, stable strings shared across surfaces.
- Do not duplicate help copy across a tour step and an article; point both at the same `data-guide` topic instead.

## Related

- Recipe: `onboarding-flow` — complete production-ready Guide-system example
- Guide: `docs/GUIDE.md` — full architecture and the cross-route tour recipe (§9)
