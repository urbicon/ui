# Mint System 🌿

**Mint** (**M**icro-**int**eractions) is the opt-in layer of decorative feedback effects in
the Urbicon UI library: one polymorphic `mint` prop across every supporting component, a
registry for custom effects, and a shared stylesheet.

Mints are decorative by contract — essential state feedback (hover colors, press cues,
focus rings) lives in the component variants and never depends on this system.

## API

### The polymorphic `mint` prop

```typescript
type MintProp =
  | MintName // single mint
  | { name: MintName; config?: MintConfig & Record<string, unknown> } // with config
  | Array<MintName> // several mints
  | Array<MintName | { name: MintName; config?: MintConfig & Record<string, unknown> }>;
```

`MintName` autocompletes the built-ins (derived from the runtime list
`BUILTIN_MINT_NAMES`) and `'none'`, while staying open for consumer-registered names —
`(string & {})` keeps any string compiling. The `Record<string, unknown>` widening lets
mint-specific config fields (`intensity`, `color`, `opacity`) through without the caller
widening the type.

```svelte
<!-- single mint -->
<Button mint="scale">Hover me</Button>

<!-- several mints -->
<Button mint={['scale', 'glow']}>Layered</Button>

<!-- with config -->
<Button mint={[{ name: 'scale', config: { intensity: 1.1 } }, 'ripple']}>Tuned</Button>

<!-- preset -->
<Button mint={mintPresets['cta-primary']}>Call to action</Button>
```

## Built-in effects

| Mint        | Trigger | Behaviour                                          |
| ----------- | ------- | -------------------------------------------------- |
| `scale`     | hover   | Scales up slightly — **held** while hovered        |
| `translate` | hover   | Lifts the element — held                           |
| `rotate`    | hover   | Tilts the element — held                           |
| `glow`      | hover   | Intent-aware glow — held                           |
| `pulse`     | hover   | Pulses continuously — held                         |
| `bounce`    | click   | One-shot bounce                                    |
| `shake`     | click   | One-shot shake                                     |
| `wiggle`    | hover   | Wiggle animation                                   |
| `ripple`    | click   | Material-style ripple from the pointer position    |
| `composite` | —       | Bundles several mints via `config.mints`           |

### Two behaviour models

- **hover / focus — a held state.** The effect applies on enter and releases on leave.
  Held hover requires `(hover: hover)` (checked live, like Tailwind's `hover:` gating), so
  tap-simulated hover on touch devices never sticks. Focus applies only for
  `:focus-visible` focus — the repo-wide keyboard-only convention — and belongs on
  focusable elements.
- **click / load — a one-shot run.** The class applies and settles on the effect's own end
  event (`animationend`, `animationiteration` for infinite animations, or the declared
  `transitionend` properties), with a fallback timeout as the safety net.

## Configuration

```typescript
interface MintConfig {
  trigger?: 'hover' | 'click' | 'focus' | 'load';
  duration?: number; // ms — actually drives the CSS animation/transition
  delay?: number; // ms before the effect applies
  easing?: string; // CSS easing
  disabled?: boolean;
}

interface MicroInteractionConfig extends MintConfig {
  intensity?: number; // scale factor, `scale` only
}

interface RippleConfig extends MintConfig {
  color?: string;
  opacity?: number;
  size?: number;
}
```

Consumer-configured `duration`/`easing`/`intensity` are written as **per-effect inline
custom properties** (`--blocks-mint-<effect>-duration`/`-easing`,
`--blocks-mint-scale-intensity`) that the stylesheet reads with the theme tokens as
fallback — so config actually changes the animation, per effect, including the exit
transition. With no config, the theme duration/easing tokens stay in charge and remain
the global tuning knobs.

## Presets

```typescript
import { mintPresets } from '@urbicon-ui/blocks';

mintPresets['cta-primary']; // primary call-to-action buttons
mintPresets['interactive-card']; // interactive cards
mintPresets['playful-button']; // playful buttons
mintPresets['subtle-hover']; // subtle hover feedback
mintPresets['error-feedback']; // error feedback
```

## Svelte 5 attachments

On your own markup, attach a mint via `mintAttachment` — the same factory every library
component uses internally:

```svelte
<script>
  import { mintAttachment } from '@urbicon-ui/blocks';
</script>

<div {@attach mintAttachment('scale')}>Hover me</div>

<div {@attach mintAttachment(['scale', 'glow'])}>Layered</div>

<div {@attach mintAttachment({ name: 'bounce', config: { trigger: 'click' } })}>Click me</div>

<!-- Tied to component state: `enabled` false tears the mint down -->
<button {@attach mintAttachment(mint, { enabled: !disabled && !loading })}> Save </button>
```

`mintAttachment` returns `false` when there is nothing to apply (`undefined`, `'none'`,
`enabled: false`) — `{@attach false}` is a no-op, so the call site needs no conditional.
A re-applied mint (enabled flip, prop identity change) re-syncs against the element's
real `:hover`/`:focus-visible` state, so a resting pointer keeps its held effect.

> **Replaces** the previously exported `mint` action and the `useMint` composable. The
> action was a `use:` construct this repo has generally replaced with `{@attach}`;
> `useMint` could never reach its target because it took the element by value and
> `onMount` therefore read the `undefined` state of `bind:this` at init time. Replace
> `use:mint={m}` with `{@attach mintAttachment(m)}`.

## Registering custom mints

```typescript
import { mintRegistry } from '@urbicon-ui/blocks';

mintRegistry.register('my-mint', (config) => ({
  init(el) {
    el.addEventListener('mouseenter', () => {
      el.style.filter = 'blur(1px)';
    });

    el.addEventListener('mouseleave', () => {
      el.style.filter = '';
    });
  },
  destroy(el) {
    // cleanup if needed
  }
}));
```

```svelte
<Button mint="my-mint">Custom mint</Button>
```

## Resolution & tree-shaking (the resolveIcon pattern)

`mintRegistry.apply(el, mint, fallbacks?)` resolves every mint name in this order:

1. **Registry entry** — a consumer `register()` override or an already-loaded built-in
   (always wins, like the IconProvider in `resolveIcon`).
2. **`fallbacks`** — statically imported factories of the caller. Button imports
   `scaleMint` directly (`{ scale: scaleMint }`) so its default ships tree-shaken without
   dragging in the whole built-in set.
3. **Demand-load** — unknown names load the built-in set once via a dynamic
   `import('./presets')` (the chunk is only fetched when a dynamic mint name is actually
   used) and apply the effect afterwards. `<Button mint="ripple">` works without a manual
   `registerDefaultMints()`.

**Demand-load contract (documented):** mint effects are decorative. Interactions inside
the fetch window are NOT replayed — on slow networks the first click for a not-yet-loaded
click-triggered effect (`ripple`, `shake`, …) can be lost for that effect; hover-triggered
effects engage from the next `mouseenter`. Consumer overrides always survive the
demand-load (built-ins only register onto free names — `registerBuiltin`). Apps that need
first-interaction guarantees register the effect statically at startup:
`registerDefaultMints()` or `mintRegistry.register(name, factory)` with a directly
imported factory.

Module layout (load-bearing for chunk assignment): `engine.ts` contains the
micro-interaction engine + `scaleMint` (ships statically with Button);
`micro-interactions.ts` contains ONLY the registrations and is reachable exclusively
through the demand-loaded `presets.ts` chunk. New statically-shipped default effects
belong in `engine.ts` (or their own module), never in `micro-interactions.ts`.

## Accessibility

The mint system respects `prefers-reduced-motion` twice over: the engine skips
initialisation entirely under reduced motion, and `mint/styles.css` neutralises every
effect class inside the media query (ripple checks again at click time, so toggling the
OS setting needs no remount). `prefers-contrast: more` swaps the glow for a solid
`currentColor` outline.
