<script lang="ts">
  // Visual-regression fixture: thirteen core form/display components rendered in static, deterministic
  // states (no interaction, no open overlays), each in its own `data-testid="vr-<name>"`
  // section so e2e/visual-regression.spec.ts can snapshot them one at a time across
  // light/dark × library/rooms (the docs skin — the spec's third axis is named `rooms`). Props are static — no time, no randomness, no
  // image loads (Avatar uses initials via `name`), Progress always carries a `value`
  // (an omitted value is indeterminate/animated). Prop names verified against source:
  // Progress uses `shape`, Avatar `variant` is a shape, Card has `padding` not `size`
  // and no intent, Input/Alert/Select intents differ per source.
  import {
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Checkbox,
    Input,
    PinInput,
    Progress,
    RadioGroup,
    RadioItem,
    Select,
    TimeInput,
    Toggle
  } from '@urbicon-ui/blocks';

  const selectOptions = [
    { label: 'Germany', value: 'de' },
    { label: 'France', value: 'fr' },
    { label: 'Spain', value: 'es' }
  ];
</script>

<svelte:head>
  <title>Primitive Visual-Regression Fixtures</title>
  <style>
    /* Belt-and-braces with Playwright's animations:'disabled' — kill any transition
       so a snapshot never catches a mid-flight frame. `transition: none` (not just
       duration:0) is deliberate: circular Progress animates stroke-dashoffset on
       mount, and a 0ms transition still fires one frame, which is what made
       progress-*-rooms non-deterministic between identical runs. `none` removes the
       property entirely. */
    *,
    *::before,
    *::after {
      transition: none !important;
      animation: none !important;
    }
  </style>
</svelte:head>

<div class="bg-surface-base min-h-screen w-full p-8" data-testid="primitives-fixtures">
  <div class="mx-auto max-w-3xl space-y-10">
    <!-- Button — Action family: variants × intents -->
    <section data-testid="vr-button" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Button</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="filled" intent="primary">Primary</Button>
        <Button variant="filled" intent="success">Success</Button>
        <Button variant="filled" intent="danger">Danger</Button>
        <Button variant="outlined" intent="primary">Outlined</Button>
        <Button variant="ghost" intent="primary">Ghost</Button>
        <Button variant="text" intent="primary">Text</Button>
        <Button variant="filled" intent="neutral" disabled>Disabled</Button>
        <!-- Loading arm: guards the embedded spinner's geometry/colour (core-extraction sentinel).
             The fixture zeroes animation-duration, so the spinner renders in its 0% keyframe. -->
        <Button variant="filled" intent="primary" loading loadingPlacement="start">Loading</Button>
        <Button variant="outlined" intent="neutral" loading loadingPlacement="overlay"
          >Overlay</Button
        >
      </div>
    </section>

    <!-- Input — Form family: variants, error, disabled -->
    <section data-testid="vr-input" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Input</h2>
      <div class="grid grid-cols-2 gap-4">
        <Input label="Email" value="name@example.com" variant="outlined" />
        <Input label="Search" value="query" variant="filled" />
        <Input label="Amount" value="-12" error="Must be positive" />
        <Input label="Locked" value="read only" disabled />
      </div>
    </section>

    <!-- Checkbox — Form family: checked / unchecked / indeterminate / disabled -->
    <section data-testid="vr-checkbox" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Checkbox</h2>
      <div class="flex flex-wrap items-center gap-6">
        <Checkbox label="Checked" checked intent="primary" />
        <Checkbox label="Unchecked" intent="primary" />
        <Checkbox label="Indeterminate" indeterminate intent="primary" />
        <Checkbox label="Disabled" checked disabled />
      </div>
    </section>

    <!-- Toggle — Form family: variant axis + intents -->
    <section data-testid="vr-toggle" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Toggle</h2>
      <div class="flex flex-wrap items-center gap-6">
        <Toggle label="On" checked intent="success" />
        <Toggle label="Off" intent="primary" />
        <Toggle label="Dot" checked variant="dot" intent="primary" />
        <Toggle label="Disabled" checked disabled />
      </div>
    </section>

    <!-- Badge — Display: variants × intents + dot arm -->
    <section data-testid="vr-badge" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Badge</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Badge variant="filled" intent="primary">Primary</Badge>
        <Badge variant="filled" intent="success">Success</Badge>
        <Badge variant="filled" intent="danger">Danger</Badge>
        <Badge variant="outlined" intent="primary">Outlined</Badge>
        <Badge variant="soft" intent="warning">Soft</Badge>
        <Badge variant="dot" intent="danger" />
        <!-- Removable arm: guards the dismiss affordance's look (core-extraction sentinel).
             filled/danger on purpose: a soft badge's light-on-light pixels stay under the
             suite's maxDiffPixelRatio (0.01) and the comparison swallows the whole badge —
             sentinels must be high-contrast to register at all. -->
        <Badge variant="filled" intent="danger" removable onRemove={() => {}}>Removable</Badge>
      </div>
    </section>

    <!-- Alert — Feedback: soft intents (large tinted surfaces exercise the theme ramp) -->
    <section data-testid="vr-alert" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Alert</h2>
      <div class="space-y-3">
        <Alert intent="info" title="Heads up">A neutral, informational note.</Alert>
        <Alert intent="success" title="Saved">Your changes were saved.</Alert>
        <Alert intent="warning" title="Check this">Something needs your attention.</Alert>
        <Alert intent="danger" title="Failed">The operation could not complete.</Alert>
      </div>
    </section>

    <!-- Card — Container: the four elevation variants -->
    <section data-testid="vr-card" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Card</h2>
      <div class="grid grid-cols-2 gap-4">
        <Card variant="quiet" padding="md">
          <p class="text-text-primary text-sm font-medium">Quiet</p>
          <p class="text-text-secondary text-sm">A flat surface.</p>
        </Card>
        <Card variant="outlined" padding="md">
          <p class="text-text-primary text-sm font-medium">Outlined</p>
          <p class="text-text-secondary text-sm">Bordered surface.</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p class="text-text-primary text-sm font-medium">Elevated</p>
          <p class="text-text-secondary text-sm">Raised with shadow.</p>
        </Card>
        <Card variant="floating" padding="md">
          <p class="text-text-primary text-sm font-medium">Floating</p>
          <p class="text-text-secondary text-sm">Strong elevation.</p>
        </Card>
      </div>
    </section>

    <!-- Avatar — Identity: shapes × intents × sizes (initials, no image load) -->
    <section data-testid="vr-avatar" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Avatar</h2>
      <div class="flex flex-wrap items-center gap-4">
        <Avatar name="Jane Doe" variant="circle" intent="primary" size="lg" />
        <Avatar name="Kai Ort" variant="rounded" intent="success" size="lg" />
        <Avatar name="Mara Ix" variant="square" intent="warning" size="lg" />
        <Avatar name="Sam Roe" variant="circle" intent="neutral" size="md" />
        <Avatar name="Ada Lin" variant="circle" intent="danger" size="sm" />
      </div>
    </section>

    <!-- Progress — Feedback: linear + circular, deterministic values -->
    <section data-testid="vr-progress" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Progress</h2>
      <div class="flex flex-wrap items-center gap-8">
        <div class="w-56 space-y-4">
          <Progress value={65} label="Upload" showValue intent="primary" />
          <Progress value={30} label="Sync" showValue intent="success" />
        </div>
        <Progress shape="circular" value={40} intent="primary" showValue />
      </div>
    </section>

    <!-- Select — Form family: closed (no overlay), variants + error -->
    <section data-testid="vr-select" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Select</h2>
      <div class="grid grid-cols-2 gap-4">
        <Select label="Country" value="de" options={selectOptions} variant="outlined" />
        <Select label="Region" value="fr" options={selectOptions} variant="filled" />
        <Select label="Missing" placeholder="Choose…" options={selectOptions} error="Required" />
        <Select label="Disabled" value="es" options={selectOptions} disabled />
      </div>
    </section>

    <!-- RadioGroup — Form family: the indicator states the intent ladder rides on.
         Was missing from this matrix entirely until v6.42. -->
    <section data-testid="vr-radio-group" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">RadioGroup</h2>
      <div class="grid grid-cols-2 gap-4">
        <RadioGroup label="Plan" value="pro">
          <RadioItem value="free" label="Free" />
          <RadioItem value="pro" label="Pro" description="Best for teams" />
          <RadioItem value="legacy" label="Legacy" disabled />
        </RadioGroup>
        <RadioGroup label="Region" value="" error="Pick one to continue">
          <RadioItem value="eu" label="Europe" />
          <RadioItem value="us" label="Americas" />
        </RadioGroup>
      </div>
    </section>

    <!-- PinInput — Form family: the segmented field frame (shares field-chrome with
         Input). Values are static and complete so no caret/focus state is captured. -->
    <section data-testid="vr-pin-input" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">PinInput</h2>
      <div class="flex flex-col gap-4">
        <PinInput label="Code" value="123456" />
        <PinInput label="Grouped" value="12345678" length={8} separator="-" groupSize={4} />
        <PinInput label="Masked" value="432109" mask />
        <PinInput label="Invalid" value="000000" error="That code has expired" />
        <PinInput label="Locked" value="123456" disabled />
      </div>
    </section>

    <!-- TimeInput — Form family: the segmented field frame in its 12h/24h shapes.
         Fixed values only — no `new Date()`, or the shot would change every run. -->
    <section data-testid="vr-time-input" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">TimeInput</h2>
      <div class="grid grid-cols-2 gap-4">
        <TimeInput label="Start" value="09:30" />
        <TimeInput label="End (12h)" value="17:45" format="12h" />
        <TimeInput label="Precise" value="08:15:30" withSeconds />
        <TimeInput label="Invalid" value="23:59" error="Outside opening hours" />
        <TimeInput label="Locked" value="12:00" disabled />
      </div>
    </section>

    <!-- Interaction states — the layer every section above is blind to.
         Everything else on this page is a resting state, so hover and focus
         styling had no coverage at all: the 2026-07-25 wave changed the hover
         fill of every filled field, the Combobox focus ring and the disabled
         text tone, and moved zero of the 52 shots.

         Each control sits alone in its own `ix-<name>` wrapper, so the spec can
         drive one state at a time and the diff points at a single element. The
         wrapper has padding because a focus ring draws OUTSIDE the control's
         box — a tight wrapper would clip exactly the thing under test.

         `filled` is deliberate on input/select: that variant carries
         `surface-interactive` + `surface-interactive-hover`, the pair that
         silently resolved to the same colour in light mode until it was fixed. -->
    <section data-testid="vr-interaction" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Interaction states</h2>
      <div class="flex flex-wrap items-start gap-6">
        <div data-testid="ix-button" class="p-2">
          <Button variant="filled" intent="primary">Save</Button>
        </div>
        <div data-testid="ix-input" class="p-2">
          <Input label="Filled" value="hover me" variant="filled" />
        </div>
        <div data-testid="ix-select" class="p-2">
          <Select label="Country" options={selectOptions} value="de" variant="filled" />
        </div>
        <div data-testid="ix-checkbox" class="p-2">
          <Checkbox label="Notify me" intent="primary" />
        </div>
        <div data-testid="ix-toggle" class="p-2">
          <Toggle label="Enabled" intent="primary" />
        </div>
      </div>
    </section>
  </div>
</div>
