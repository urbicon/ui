<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Button,
    EyeIcon,
    EyeOffIcon,
    Input,
    Kbd,
    LockIcon,
    MailIcon,
    SearchIcon
  } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let searchValue = $state('Svelte components');
  let passwordValue = $state('');
  let passwordVisible = $state(false);
  let brandedSearch = $state('Design tokens');

  const takenAddresses = ['ada@example.com'];
  let emailError = $state('');
  let signedUp = $state(false);

  function handleSignup(event: SubmitEvent) {
    event.preventDefault();
    const address = String(new FormData(event.currentTarget as HTMLFormElement).get('email') ?? '');
    emailError = takenAddresses.includes(address) ? 'That address is already registered' : '';
    signedUp = !emailError;
  }
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Search input"
      description="Pair `clearable` with a left search icon. Press Escape or click the clear button to reset."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Input
        clearable
        bind:value={searchValue}
        placeholder="Search anything..."
        aria-label="Search"
      >
        {#snippet leftIcon()}
          <SearchIcon />
        {/snippet}
      </Input>
    </CodeExample>

    <CodeExample
      title="Password with visibility toggle"
      description="Giving an icon a click handler turns it into a real button, which then needs its own `rightIconAriaLabel` or `leftIconAriaLabel` for a name. A right icon and `clearable` share the same corner: while the field holds a value, the clear control takes it."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Input
        type={passwordVisible ? 'text' : 'password'}
        label="Password"
        placeholder="Enter your password"
        bind:value={passwordValue}
        onRightIconClick={() => (passwordVisible = !passwordVisible)}
        rightIconAriaLabel={passwordVisible ? 'Hide password' : 'Show password'}
      >
        {#snippet leftIcon()}
          <LockIcon />
        {/snippet}
        {#snippet rightIcon()}
          {#if passwordVisible}
            <EyeOffIcon />
          {:else}
            <EyeIcon />
          {/if}
        {/snippet}
      </Input>
    </CodeExample>

    <CodeExample
      title="Validated in a form"
      description="`type` and `required` sit on a real input, so the browser checks the address shape and the empty case before the handler runs, while `name` is what puts the value into the `FormData`. `error` covers what only your code knows, an answer from the server for instance, and it overrides `helper` and any `intent` for as long as it is set."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <form class="flex flex-col gap-4" onsubmit={handleSignup}>
        <Input
          type="email"
          name="email"
          label="Email"
          placeholder="name@example.com"
          value="ada@example.com"
          error={emailError}
          helper="We send one confirmation mail and nothing else"
          required
        >
          {#snippet leftIcon()}
            <MailIcon />
          {/snippet}
        </Input>
        <Button type="submit" size="sm" class="self-start">Sign up</Button>
        {#if signedUp}
          <p class="text-success text-xs">Address accepted.</p>
        {/if}
      </form>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Prominent search bar"
      description="The frame belongs to the `container` slot and the text field to `base`, so a treatment on the outside goes on the first while the second gives up its own border and ring."
      isolate
      previewClass="flex flex-col items-center gap-4 max-w-lg w-full mx-auto"
    >
      <Input
        tier="commit"
        size="lg"
        clearable
        bind:value={brandedSearch}
        placeholder="Search components, patterns, tokens..."
        aria-label="Search"
        slotClasses={{
          container:
            'shadow-[var(--blocks-shadow-lg)] ring-2 ring-primary/25 focus-within:ring-primary/50 transition-shadow overflow-hidden',
          base: 'border-transparent bg-transparent focus-visible:ring-0'
        }}
      >
        {#snippet leftIcon()}
          <SearchIcon />
        {/snippet}
      </Input>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A treatment every field should share belongs on a
      <code class="text-text-primary">BlocksProvider</code> instead, as a
      <code class="text-text-primary">defaults</code> entry for
      <code class="text-text-primary">Input</code> and the same one for
      <a href={resolve('/blocks/primitives/select')} class="text-primary hover:underline">Select</a>
      and
      <a href={resolve('/blocks/primitives/textarea')} class="text-primary hover:underline"
        >Textarea</a
      >. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for that and for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code> and
      <code class="text-text-primary">preset</code>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Labels and messages">
      <p>
        The <code class="text-text-primary">label</code> links to the field via
        <code class="text-text-primary">for</code>/<code class="text-text-primary">id</code>.
        <code class="text-text-primary">helper</code> and
        <code class="text-text-primary">error</code> text is announced through
        <code class="text-text-primary">aria-describedby</code>, and an
        <code class="text-text-primary">error</code> also sets
        <code class="text-text-primary">aria-invalid</code> on the input.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" /> focuses the field. On a
        <code class="text-text-primary">clearable</code> field that holds a value,
        <Kbd keys="Escape" /> clears it and puts focus back in the input, which is also the one case where
        a field inside a dialog keeps that Escape to itself. An icon with a click handler is a real
        <code class="text-text-primary">&lt;button&gt;</code>
        with its own
        <Kbd keys="Tab" /> stop, before the field on the left and after it on the right, and the clear
        control is another one.
      </p>
    </Note>
    <Note title="Colour is not the only signal">
      <p>
        An <code class="text-text-primary">intent</code> tints the field's frame and nothing else,
        so a state carried by it wants <code class="text-text-primary">helper</code> text saying the
        same thing in words. An <code class="text-text-primary">error</code> arrives with its message
        already attached.
      </p>
    </Note>
  </NoteList>
</Section>
