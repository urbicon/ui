<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { PinInput } from '@urbicon-ui/blocks';

  let otp = $state('');
  let otpStatus = $state('');

  let licenseKey = $state('');

  let twoFactorCode = $state('');
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Six-digit OTP with a completion callback"
      description="bind:value keeps the concatenated string in sync; onComplete fires once the final cell is filled — the moment to kick off verification. Set mask to render each filled cell as a dot — right for standing PINs and passcodes, unnecessary for throwaway SMS codes."
      code={`<script>
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
      description="type=alphanumeric widens the character set to A–Z; uppercase normalises casing as you type; separator + groupSize break a long code into readable groups — here a 4-4 license key."
      code={`<PinInput
  label="License key"
  length={8}
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
        type="alphanumeric"
        uppercase
        separator="-"
        groupSize={4}
        bind:value={licenseKey}
      />
    </CodeExample>

    <CodeExample
      title="Error state"
      description="Passing error colours every cell danger, sets aria-invalid, and shows the message via role=alert — overriding any helper text."
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
      <code>PinInput</code> is purpose-built for the one-time-code step of a two-factor flow. The
      first cell already carries <code>autocomplete="one-time-code"</code>, so iOS surfaces the code
      straight from an incoming SMS as a keyboard suggestion — no extra wiring on your side. Pair it
      with the auth package's <code>TwoFactorManager</code>, feeding the bound value into your
      verify call from <code>onComplete</code>.
    </p>
    <p>
      Give it a visible <code>label</code> and a <code>helper</code> line so the source of the code (authenticator
      app vs. SMS) is never ambiguous.
    </p>
  </div>

  <CodeExample
    title="Authenticator verification field"
    description="A labelled, six-digit field with helper text — the shape TwoFactorManager expects at the challenge step."
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
</Section>

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      Every visual surface is a named slot: <code>root</code> (what <code>class</code> also
      targets),
      <code>label</code>, <code>group</code> (the cell row), <code>cell</code>,
      <code>separator</code>, and <code>message</code>. Pass <code>slotClasses</code> to merge
      classes onto any of them, or <code>unstyled</code> to drop all default <code>tv()</code>
      styles and rebuild from scratch. For a look you reuse across the app, register a
      <code>preset</code>
      once on
      <code>&lt;BlocksProvider&gt;</code> and reference it by name instead of repeating overrides.
    </p>
  </div>

  <CodeExample
    title="Terminal-style cells via slotClasses"
    description="Larger, rounded, monospaced cells built entirely from semantic tokens — no hardcoded colours."
    code={`<PinInput
  label="Access code"
  length={6}
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
        Each cell announces its position — <code>aria-label="Character N of M"</code> — so a screen-reader
        user always knows where the caret sits.
      </p>
    </Note>
    <Note title="Errors are announced">
      <p>
        An <code>error</code> message is exposed via <code>role="alert"</code> and wired to every
        cell through <code>aria-describedby</code>, alongside <code>aria-invalid</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Full keyboard support: typing a valid character auto-advances to the next cell,
        <code>Backspace</code> clears and steps back, the arrow keys plus <code>Home</code> /
        <code>End</code> move between cells, and a paste is distributed across the cells from the caret.
      </p>
    </Note>
  </NoteList>
</Section>
