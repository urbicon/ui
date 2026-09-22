<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { PinInput } from '@urbicon-ui/blocks';

  let otp = $state('');
  let otpStatus = $state('');

  let licenseKey = $state('');

  let twoFactorCode = $state('');

  // The retry demo accepts one code and rejects every other, so the reject path
  // is the one a reader hits first.
  const DEMO_CODE = '246810';
  let retryCode = $state('');
  let retryError = $state('');
  let retryStatus = $state('');
  let retryPin: ReturnType<typeof PinInput> | undefined = $state();

  function verifyDemo(v: string) {
    if (v === DEMO_CODE) {
      retryError = '';
      retryStatus = 'Verified.';
      return;
    }
    retryError = 'Incorrect code — try again.';
    retryStatus = '';
    retryCode = '';
    retryPin?.focus();
  }
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Six-digit OTP with a completion callback"
      description="bind:value keeps the concatenated string in sync; onComplete fires each time the row becomes complete — so a corrected code fires it again, which is the normal case for a mistyped one."
      code={`<script>
  import { PinInput } from '@urbicon-ui/blocks';
  let code = $state('');
  let status = $state('');
<\/script>

<PinInput
  label="One-time code"
  length={6}
  bind:value={code}
  onComplete={(v) => (status = 'Verifying ' + v + '…')}
/>
{#if status}
  <p>{status}</p>
{/if}`}
      language="svelte"
    >
      <div class="space-y-3">
        <PinInput
          label="One-time code"
          length={6}
          bind:value={otp}
          onComplete={(v) => (otpStatus = `Verifying ${v}…`)}
        />
        {#if otpStatus}
          <p class="text-text-secondary text-sm" role="status">{otpStatus}</p>
        {/if}
      </div>
    </CodeExample>

    <CodeExample
      title="Alphanumeric with a grouped separator"
      description="type=alphanumeric accepts letters as well as digits, in either case; uppercase normalises them as you type; separator + groupSize break a long code into readable groups, here a 4-4 license key."
      code={`<script>
  import { PinInput } from '@urbicon-ui/blocks';
  let licenseKey = $state('');
<\/script>

<PinInput
  label="License key"
  length={8}
  size="sm"
  type="alphanumeric"
  uppercase
  separator="-"
  groupSize={4}
  bind:value={licenseKey}
/>`}
      language="svelte"
    >
      <PinInput
        label="License key"
        length={8}
        size="sm"
        type="alphanumeric"
        uppercase
        separator="-"
        groupSize={4}
        bind:value={licenseKey}
      />
    </CodeExample>

    <CodeExample
      title="Error state"
      description="Passing error colours every cell danger, sets aria-invalid, and shows the message via role=alert, overriding any helper text."
      code={`<PinInput label="Security code" length={6} value="12" error="Incorrect code" />`}
      language="svelte"
    >
      <PinInput label="Security code" length={6} value="12" error="Incorrect code" />
    </CodeExample>
  </div>
</Section>

<Section marker id="two-factor" title="Two-factor / OTP">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      <code>PinInput</code> fits the one-time-code step of a two-factor flow. The first cell carries
      <code>autocomplete="one-time-code"</code>, so iOS offers the code from an incoming SMS as a
      keyboard suggestion. Send the bound value from <code>onComplete</code> to your verify endpoint
      — with the auth package, that is <code>createTwoFactorHandlers</code>'s
      <code>verify</code> group behind <code>POST /api/auth/2fa/verify</code>.
    </p>
    <p>
      An autofilled code lands in the first cell and is distributed across the row, exactly like a
      paste. Give it a visible <code>label</code> and a <code>helper</code> line so the source of the
      code (authenticator app vs. SMS) is never ambiguous.
    </p>
    <p>
      A rejected code is the normal case, not the exception. Clear the bound value, then call
      <code>focus()</code> on the instance (<code>bind:this</code>) and the caret is back in the
      first cell — <code>autoFocus</code> alone cannot do this, it runs once on mount. The order
      matters: <code>focus()</code> reads the value, so clear first.
    </p>
  </div>

  <CodeExample
    title="Authenticator verification field"
    description="A labelled, six-digit field with helper text for the second login step."
    code={`<PinInput
  label="Verification code"
  helper="Enter the 6-digit code from your authenticator app."
  length={6}
  bind:value={code}
  onComplete={(v) => verifyTwoFactor(v)}
/>`}
    language="svelte"
  >
    <PinInput
      label="Verification code"
      helper="Enter the 6-digit code from your authenticator app."
      length={6}
      bind:value={twoFactorCode}
    />
  </CodeExample>

  <CodeExample
    title="Retry after a rejected code"
    description="The verify callback rejects, sets the error, clears the value and calls focus() on the instance — the caret returns to the first cell without a click. Typing again clears the error. This demo accepts only 246810."
    code={`<script>
  import { PinInput } from '@urbicon-ui/blocks';
  let code = $state('');
  let error = $state('');
  let pin;

  async function verify(v) {
    if (await verifyTwoFactor(v)) return;
    error = 'Incorrect code — try again.';
    code = '';
    pin.focus();
  }
<\/script>

<PinInput
  bind:this={pin}
  bind:value={code}
  label="Verification code"
  helper="Enter the 6-digit code from your authenticator app."
  length={6}
  {error}
  onComplete={verify}
  onValueChange={() => (error = '')}
/>`}
    language="svelte"
  >
    <div class="space-y-3">
      <PinInput
        bind:this={retryPin}
        bind:value={retryCode}
        label="Verification code"
        helper="Enter the 6-digit code from your authenticator app. This demo accepts 246810."
        length={6}
        error={retryError}
        onComplete={verifyDemo}
        onValueChange={() => (retryError = '')}
      />
      {#if retryStatus}
        <p class="text-text-secondary text-sm" role="status">{retryStatus}</p>
      {/if}
    </div>
  </CodeExample>
</Section>

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      Every visible part is a named slot: <code>root</code> (what <code>class</code> also targets),
      <code>label</code>, <code>group</code> (the cell row), <code>cell</code>,
      <code>separator</code>, and <code>message</code>. Pass <code>slotClasses</code> to merge
      classes onto any of them, or <code>unstyled</code> to drop every default class and rebuild
      from scratch. For a look you reuse across the app, register a
      <code>preset</code>
      once on
      <code>&lt;BlocksProvider&gt;</code> and reference it by name instead of repeating overrides.
    </p>
  </div>

  <CodeExample
    title="Terminal-style cells via slotClasses"
    description="Rounded, monospaced cells in a bigger type size, built from semantic tokens. The cell box keeps its own size — text-2xl grows the glyph, not the square."
    code={`<PinInput
  label="Access code"
  length={6}
  value="4711"
  slotClasses={{
    group: 'gap-3',
    cell: 'rounded-lg bg-surface-subtle border-border-default font-mono text-2xl text-primary'
  }}
/>`}
    language="svelte"
  >
    <PinInput
      label="Access code"
      length={6}
      value="4711"
      slotClasses={{
        group: 'gap-3',
        cell: 'rounded-lg bg-surface-subtle border-border-default font-mono text-2xl text-primary'
      }}
    />
  </CodeExample>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Group semantics">
      <p>
        The cell row is a <code>role="group"</code>, named by <code>aria-labelledby</code> when a
        visible <code>label</code> is set, or by <code>aria-label</code> otherwise.
      </p>
    </Note>
    <Note title="Each cell announces its position">
      <p>
        Each cell carries <code>aria-label="Character N of M"</code>, so a screen-reader user always
        knows where the caret sits.
      </p>
    </Note>
    <Note title="The error reaches every cell">
      <p>
        <code>aria-describedby</code> is set on each cell individually, not just on the group — so the
        message is read wherever the caret sits, not only on entering the field.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Typing a valid character auto-advances to the next cell. <code>Backspace</code> clears the
        current cell, or — when that one is already empty — steps back and clears the previous one;
        <code>Delete</code> clears without moving. The arrow keys plus <code>Home</code> /
        <code>End</code> move between cells, and a paste is distributed across the cells from the caret.
      </p>
    </Note>
  </NoteList>
</Section>
