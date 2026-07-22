# Mint System 🌿

Das **Mint-System** ist ein flexibles und erweiterbares Framework für Micro-Interactions in der Urbicon UI-Library. Es bietet eine elegante
polymorphe API und optimale Performance.

## Konzept

"Mint" steht für **M**icro-**int**eractions und umfasst alle subtilen Animationen und Feedback-Effekte, die eine Benutzeroberfläche lebendig
und responsiv machen.

## Features

- ✨ **Polymorphe API**: Eine einzige `mint`-Property für alle Anwendungsfälle
- 🎯 **Type-Safe**: Vollständig typisiert mit TypeScript
- 🚀 **Performance**: Optimiert für 60fps mit Web Animations API
- ♿ **Accessibility**: Respektiert `prefers-reduced-motion`
- 🔧 **Erweiterbar**: Einfache Registrierung neuer Mints
- 🎨 **Komposition**: Kombiniere mehrere Effekte

## API

### Polymorphe `mint`-Property

```typescript
type MintProp =
  | string // Einzelner Mint
  | { name: string; config?: MintConfig & Record<string, unknown> } // Einzelner Mint mit Config
  | Array<string> // Mehrere Mints
  | Array<string | { name: string; config?: MintConfig & Record<string, unknown> }>; // Gemischte Liste mit Configs
```

Die `config`-Erweiterung mit `Record<string, unknown>` lässt mint-spezifische
Felder durch (`intensity`, `transformOrigin`, `color`, `opacity`), ohne dass
der Caller den Typ aufweiten muss.

### Grundlegende Verwendung

```svelte
<!-- Einzelner Mint -->
<Button mint="scale">Hover mich</Button>

<!-- Mehrere Mints -->
<Button mint={['scale', 'glow']}>Multi-Effekt</Button>

<!-- Mit Konfiguration -->
<Button mint={[{ name: 'scale', config: { intensity: 1.1 } }, 'ripple']}>Konfiguriert</Button>

<!-- Preset verwenden -->
<Button mint={mintPresets['cta-primary']}>Call to Action</Button>
```

## Eingebaute Mints

### Micro-Interactions

| Mint        | Trigger | Beschreibung                     |
| ----------- | ------- | -------------------------------- |
| `scale`     | hover   | Skaliert das Element leicht hoch |
| `translate` | hover   | Bewegt Element nach oben         |
| `rotate`    | hover   | Rotiert Element leicht           |
| `glow`      | hover   | Fügt einen Glüheffekt hinzu      |
| `bounce`    | click   | Springende Animation             |
| `pulse`     | hover   | Pulsierender Effekt              |
| `shake`     | click   | Schüttel-Animation               |
| `wiggle`    | hover   | Wackel-Effekt                    |

### Spezial-Effekte

| Mint     | Beschreibung                  |
| -------- | ----------------------------- |
| `ripple` | Material Design Ripple-Effekt |
| `fade`   | Opacity-Übergang              |
| `slide`  | Slide-Transformation          |

## Konfiguration

```typescript
interface MintConfig {
  trigger?: 'hover' | 'click' | 'focus' | 'load';
  duration?: number;
  delay?: number;
  easing?: string;
  disabled?: boolean;
}

interface MicroInteractionConfig extends MintConfig {
  intensity?: number; // Stärke des Effekts
  transformOrigin?: string; // Transform-Ursprung
}

interface RippleConfig extends MintConfig {
  color?: string; // Ripple-Farbe
  opacity?: number; // Ripple-Transparenz
  size?: number; // Ripple-Größe
}
```

## Presets

```typescript
import { mintPresets } from '@urbicon-ui/blocks';

// Verfügbare Presets
mintPresets['cta-primary']; // Für primäre Call-to-Action Buttons
mintPresets['interactive-card']; // Für interaktive Karten
mintPresets['playful-button']; // Für spielerische Buttons
mintPresets['subtle-hover']; // Für subtile Hover-Effekte
mintPresets['error-feedback']; // Für Fehler-Feedback
```

## Svelte 5 Attachments

```svelte
<script>
  import { mintRegistry } from '@urbicon-ui/blocks';

  // {@attach} factory — mintRegistry.apply returns the cleanup the attachment needs
  const mint = (mints) => (element) => mintRegistry.apply(element, mints);
</script>

<!-- Einzelner Mint -->
<div {@attach mint('scale')}>Hover mich</div>

<!-- Mehrere Mints -->
<div {@attach mint(['scale', 'glow'])}>Multi-Effekt</div>

<!-- Mit Konfiguration -->
<div {@attach mint({ name: 'bounce', config: { trigger: 'click' } })}>
  Click mich
</div>
```

## Eigene Mints registrieren

```typescript
import { mintRegistry } from '@urbicon-ui/blocks';

// Einfacher Mint
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
    // Cleanup wenn nötig
  }
}));

// Verwenden
<Button mint="my-mint">Custom Mint</Button>
```

## Performance-Optimierungen

- **Web Animations API**: Nutzt native Browser-Animationen
- **will-change**: Optimiert GPU-Beschleunigung
- **Throttling**: Verhindert Spam bei schnellen Interaktionen
- **Cleanup**: Automatische Bereinigung bei Component-Unmount

## Auflösung & Tree-Shaking (resolveIcon-Muster)

`mintRegistry.apply(el, mint, fallbacks?)` löst jeden Mint-Namen in dieser
Reihenfolge auf:

1. **Registry-Eintrag** — Consumer-`register()`-Override oder bereits geladene
   Built-ins (gewinnt immer, wie der IconProvider bei `resolveIcon`).
2. **`fallbacks`** — statisch importierte Factories des Aufrufers. Button
   importiert `scaleMint` direkt (`{ scale: scaleMint }`), damit sein Default
   tree-shaken mitkommt, ohne das gesamte Built-in-Set zu ziehen.
3. **Demand-Load** — unbekannte Namen laden das Built-in-Set einmalig per
   dynamischem `import('./presets')` nach (Chunk wird nur gefetcht, wenn
   tatsächlich ein dynamischer Mint-Name verwendet wird) und wenden den Effekt
   danach an. `<Button mint="ripple">` funktioniert also weiterhin ohne
   manuelles `registerDefaultMints()`.

**Kontrakt Demand-Load (dokumentiert):** Mint-Effekte sind dekorativ.
Interaktionen im Fetch-Fenster werden NICHT nachgespielt — auf langsamen
Netzen kann der erste Klick für einen noch nicht geladenen click-getriggerten
Effekt (`ripple`, `shake`, …) verloren gehen; hover-getriggerte Effekte
greifen ab dem nächsten `mouseenter`. Consumer-Overrides überleben den
Demand-Load immer (die Built-ins registrieren sich nur auf freie Namen —
`registerBuiltin`). Wer First-Interaction-Garantien braucht, registriert den
Effekt statisch beim App-Start: `registerDefaultMints()` oder
`mintRegistry.register(name, factory)` mit direkt importierter Factory.

Modul-Layout (load-bearing für die Chunk-Zuordnung): `engine.ts` enthält die
Micro-Interaction-Engine + `scaleMint` (schifft statisch mit Button);
`micro-interactions.ts` enthält NUR die Registrierungen und ist ausschließlich
über den demand-geladenen `presets.ts`-Chunk erreichbar. Neue statisch
verschiffte Default-Effekte gehören in `engine.ts` (oder ein eigenes Modul),
niemals in `micro-interactions.ts`.

## Accessibility

Das Mint-System respektiert automatisch `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .blocks-mint-* {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
```

## Erweiterte Beispiele

### Komposite Mints

```typescript
// Mehrere Effekte kombinieren
const complexMint = [
  { name: 'scale', config: { intensity: 1.05, duration: 200 } },
  { name: 'glow', config: { duration: 300 } },
  { name: 'rotate', config: { trigger: 'click' } }
];

<Button mint={complexMint}>Komplex</Button>
```

### Bedingte Mints

```svelte
<script>
  let isPlayful = $state(false);
</script>

<Button mint={isPlayful ? 'bounce' : 'scale'}>
  {isPlayful ? 'Playful' : 'Professional'}
</Button>
```

### Custom Mint Bundle

```typescript
import { registerPlayfulMints, registerBusinessMints } from '@urbicon-ui/blocks';

// Je nach App-Kontext
if (appTheme === 'playful') {
  registerPlayfulMints();
} else {
  registerBusinessMints();
}
```
