<!--
  LoginPage-Playground — die einzige Auth-Komponente mit ableitbaren Achsen
  (`mode` schaltet zwischen Passwort, Passkey und beidem). Der Rest der
  Auth-Familie hat keine Varianten, sondern API-Pfade und Callbacks; dort bleibt
  das statische `examples/Basic.svelte` das geteilte Beispiel.

  Zwei Konsumenten: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { LoginPage } from '@urbicon-ui/auth';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const controls = deriveControls(componentData, {
    pick: ['mode', 'rememberMe'],
    overrides: {
      rememberMe: { label: 'Remember Me', defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="LoginPage"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: [
      "import { LoginPage } from '@urbicon-ui/auth';",
      "import { goto } from '$app/navigation';"
    ],
    consts: {
      onSuccess: { raw: "() => goto('/')" },
      passkeyApiPath: '/api/auth/passkey'
    },
    bind: ['onSuccess', 'passkeyApiPath']
  }}
>
  {#snippet children(values)}
    <div class="mx-auto w-full max-w-md">
      <!--
        Die Doku-Site hat keine /auth/register- und /auth/forgot-password-Route,
        also zeigen die Links hier auf die Doku-Seiten der Geschwister statt auf
        einen 404 — sie sind Site-Beiwerk und stehen deshalb nicht im Schnipsel.
        Was dort steht, ist das, was die Komponente benutzbar macht:
        `onSuccess` und `passkeyApiPath`, wie in `examples/Basic.svelte`.
      -->
      <LoginPage
        mode={values.mode}
        rememberMe={values.rememberMe}
        onSuccess={() => goto(resolve('/'))}
        passkeyApiPath="/api/auth/passkey"
        registerUrl={resolve('/auth/components/register-page')}
        forgotPasswordUrl={resolve('/auth/components/forgot-password-page')}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
