<script lang="ts">
  // Visual-regression fixture: ten core primitives rendered in static, deterministic
  // states (no interaction, no open overlays), each in its own `data-testid="vr-<name>"`
  // section so e2e/visual-regression.spec.ts can snapshot them one at a time across
  // light/dark × library/editorial. Props are static — no time, no randomness, no
  // image loads (Avatar uses initials via `name`), Progress always carries a `value`
  // (an omitted value is indeterminate/animated). Prop names verified against source:
  // Toggle uses `appearance`, Progress uses `shape`, Avatar `variant` is a shape, Card
  // has `padding` not `size` and no intent, Input/Alert/Select intents differ per source.
  import {
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Checkbox,
    Input,
    Progress,
    Select,
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
       so a snapshot never catches a mid-flight frame. */
    *,
    *::before,
    *::after {
      transition-duration: 0ms !important;
      animation-duration: 0ms !important;
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

    <!-- Toggle — Form family: appearance axis + intents -->
    <section data-testid="vr-toggle" class="space-y-3">
      <h2 class="text-text-primary text-lg font-semibold">Toggle</h2>
      <div class="flex flex-wrap items-center gap-6">
        <Toggle label="On" checked intent="success" />
        <Toggle label="Off" intent="primary" />
        <Toggle label="Dot" checked appearance="dot" intent="primary" />
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
  </div>
</div>
