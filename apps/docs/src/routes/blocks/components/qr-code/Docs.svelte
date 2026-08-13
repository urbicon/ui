<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { QRCode, Textarea } from '@urbicon-ui/blocks';

  const eclLevels = ['L', 'M', 'Q', 'H'] as const;
  const sizes = [120, 160, 220];

  // A TOTP enrolment URI — kept in a const so the `&` params never round-trip
  // through markup entity parsing. The secret here is an RFC 6238 test value.
  const otpauthUri =
    'otpauth://totp/Urbicon:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Urbicon&period=30';

  // Interactive capacity demo — type past the maxVersion bound to see the fallback.
  let payload = $state('https://ui.urbicon.de/docs');
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Basic — encode a URL"
      description="Pass any string to value. The card frame keeps the code on a light background so it scans reliably in any theme."
      code={`<QRCode value="https://ui.urbicon.de" frame="card" />`}
      language="svelte"
    >
      <QRCode value="https://ui.urbicon.de" frame="card" />
    </CodeExample>

    <CodeExample
      title="Error-correction levels"
      description="L≈7%, M≈15%, Q≈25%, H≈30% of the code can be damaged or occluded and still decode. Higher recovery uses more modules, so the pattern grows denser from L to H."
      code={`{#each ['L', 'M', 'Q', 'H'] as level}
  <QRCode value="https://ui.urbicon.de" errorCorrection={level} size={120} frame="card" />
{/each}`}
      language="svelte"
    >
      <div class="flex flex-wrap items-end gap-4">
        {#each eclLevels as level (level)}
          <div class="flex flex-col items-center gap-2">
            <QRCode value="https://ui.urbicon.de" errorCorrection={level} size={120} frame="card" />
            <span class="text-text-tertiary text-xs">{level}</span>
          </div>
        {/each}
      </div>
    </CodeExample>

    <CodeExample
      title="Sizes"
      description="size is the rendered edge length in pixels. The code is a single SVG path, so it stays crisp at any size."
      code={`{#each [120, 160, 220] as px}
  <QRCode value="https://ui.urbicon.de" size={px} frame="card" />
{/each}`}
      language="svelte"
    >
      <div class="flex flex-wrap items-end gap-6">
        {#each sizes as px (px)}
          <div class="flex flex-col items-center gap-2">
            <QRCode value="https://ui.urbicon.de" size={px} frame="card" />
            <span class="text-text-tertiary text-xs">{px}px</span>
          </div>
        {/each}
      </div>
    </CodeExample>

    <CodeExample
      title="Custom colours"
      description="foreground and background accept any CSS colour string. Keep a high-contrast dark-on-light pairing so scanners stay reliable."
      code={`<QRCode
  value="https://ui.urbicon.de"
  foreground="#1e3a5f"
  background="#f8fafc"
  frame="card"
/>`}
      language="svelte"
    >
      <QRCode
        value="https://ui.urbicon.de"
        foreground="#1e3a5f"
        background="#f8fafc"
        frame="card"
      />
    </CodeExample>
  </div>
</Section>

<Section marker id="auth-2fa" title="2FA & auth">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      Pass a TOTP enrolment URI straight to <code>&lt;QRCode&gt;</code> and an authenticator app
      (Google Authenticator, 1Password, …) scans it to register the shared secret. This replaces an
      external QR library in <code>TwoFactorManager</code>'s <code>qr</code> snippet.
    </p>
    <p>
      Use <code>errorCorrection="H"</code> here: the extra recovery data keeps the code readable
      when it is scanned at an angle or across a second device. Never echo the secret into
      <code>aria-label</code>: the visible code already contains it, and the label is read aloud and
      exposed in the accessibility tree.
    </p>
  </div>

  <CodeExample
    title="Encode an otpauth:// enrolment URI"
    description="High error correction and the card frame keep this reliable to scan from a second device during setup."
    code={`<QRCode
  value="otpauth://totp/Urbicon:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Urbicon&period=30"
  errorCorrection="H"
  size={200}
  frame="card"
/>`}
    language="svelte"
  >
    <QRCode value={otpauthUri} errorCorrection="H" size={200} frame="card" />
  </CodeExample>
</Section>

<Section marker id="encoding" title="Encoding capacity & errors">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      The smallest QR version (1–40) that fits your data is chosen automatically, along with the
      most efficient mode for it (numeric, alphanumeric, or UTF-8 byte). You do not pick a version
      yourself.
    </p>
    <p>
      Bound the size with <code>maxVersion</code> when a code has to stay physically small. Data
      that overflows that bound calls <code>onError</code> and renders a visible fallback in place
      of the code, so the surrounding page keeps rendering. Type past the
      <code>maxVersion={4}</code> capacity below to see the fallback.
    </p>
  </div>

  <CodeExample
    title="Live capacity demo"
    description="The bound value is encoded on every change. When it overflows maxVersion={4}, onError fires and the fallback shows in place of the code."
    code={`<` +
      `script>
  let payload = $state('https://ui.urbicon.de/docs');
<` +
      `/script>

<Textarea label="Payload" bind:value={payload} />
<QRCode value={payload} maxVersion={4} frame="card" onError={(e) => console.warn(e.message)} />`}
    language="svelte"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div class="w-full sm:max-w-xs">
        <Textarea label="Payload to encode" bind:value={payload} rows={4} />
      </div>
      <QRCode
        value={payload}
        maxVersion={4}
        size={160}
        frame="card"
        onError={(e) => console.warn(e.message)}
      />
    </div>
  </CodeExample>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="One named image">
      <p>
        Renders as <code>role="img"</code> with an <code>aria-label</code> that defaults to a localized
        "QR code" and is overridable per instance.
      </p>
    </Note>
    <Note title="Never echo a sensitive payload">
      <p>
        <strong>Never echo sensitive payloads</strong> (a 2FA secret, a signed token) into
        <code>aria-label</code>: it is announced aloud and exposed in the accessibility tree.
      </p>
    </Note>
    <Note title="Contrast and scannability">
      <p>
        For guaranteed scannability keep high-contrast <strong>dark-on-light</strong> modules.
        <code>frame="card"</code> supplies the light ground; the default <code>foreground</code> is
        <code>currentColor</code>, so an unframed code inherits the surrounding text colour.
      </p>
    </Note>
    <Note title="The failure state stays labelled">
      <p>
        When encoding fails, the visible fallback also carries <code>role="img"</code> with the same label,
        so assistive tech is never left with an empty region.
      </p>
    </Note>
  </NoteList>
</Section>
