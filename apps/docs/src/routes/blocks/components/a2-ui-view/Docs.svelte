<script lang="ts">
  import { CodeExample, InfoCard, Note, NoteList, Section } from '@urbicon-ui/docs';
  import LiveDemo from './examples/LiveDemo.svelte';
  import UrbiconDemo from './examples/UrbiconDemo.svelte';
  import BrokenPayload from './examples/BrokenPayload.svelte';

  import liveDemoCode from './examples/LiveDemo.svelte?raw';
  import urbiconDemoCode from './examples/UrbiconDemo.svelte?raw';
  import brokenPayloadCode from './examples/BrokenPayload.svelte?raw';

  const wiringCode = `<script lang="ts">
  import {
    ChatMessageList,
    A2UIView,
    type ChatMessageData,
    type MarkdownUrlPolicy
  } from '@urbicon-ui/blocks';

  let messages: ChatMessageData[] = $state([]);

  // Strict by default: external images are blocked unless a prefix is
  // allowlisted; links keep the safe default protocols. Keep the object stable.
  const urlPolicy: MarkdownUrlPolicy = { allowedImagePrefixes: ['https://cdn.example.com/'] };

  function sendUserTurn(text: string) {
    messages = [...messages, { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] }];
  }
<\/script>

<!-- A2UIView is NOT a default ChatMessage renderer — opt in per surface so it
     stays out of the base bundle. ChatMessageList forwards partRenderers to
     each ChatMessage. -->
<ChatMessageList {messages} partRenderers={{ a2ui: a2uiPart }} />

{#snippet a2uiPart(part)}
  <A2UIView
    payload={part.payload}
    streaming={/* couple to the message status */ true}
    {urlPolicy}
    onAction={(event) => sendUserTurn(\`[ui-action] \${JSON.stringify(event)}\`)}
    onValidationError={(issues) => {
      // Relay error-severity issues back to the agent as an A2UI \`error\` message.
      for (const issue of issues) if (issue.severity === 'error') reportToAgent(issue);
    }}
  />
{/snippet}`;

  const promptCode = `// Server / agent side — no DOM needed. The prompt is rendered from the SAME
// registry that validates the payload, so the two can never drift.
import { a2uiSystemPrompt } from '@urbicon-ui/blocks';

const system = [
  a2uiSystemPrompt(),
  // Append your app-specific TRANSPORT section (how envelopes reach the client),
  // e.g. a fenced \`\`\`a2ui JSONL block. a2uiSystemPrompt() deliberately omits it.
  TRANSPORT_INSTRUCTIONS
].join('\\n\\n');`;
</script>

<Section marker id="concept" title="How it works">
  <div class="space-y-6">
    <p class="text-text-secondary max-w-3xl leading-relaxed">
      A2UI (Agent-to-UI) lets an agent describe an interface as <strong>data</strong>, not
      executable code. The agent emits JSONL <em>envelopes</em> that reference a
      <strong>trusted catalog</strong> your app already ships, rather than markup or scripts of its
      own. A2UIView renders the Urbicon subset of A2UI <code>v0.9.1</code>
      <code>basic</code>: it maps the catalog components onto real Urbicon primitives and renders
      them live and interactive.
    </p>

    <div class="grid gap-4 sm:grid-cols-3">
      <InfoCard title="Data, not code">
        Envelopes are inert JSON. Only the mapped components and their declared props reach the DOM,
        so nothing in the payload can execute.
      </InfoCard>
      <InfoCard title="Catalog-only">
        Unknown components, unknown props, prototype-pollution keys and function-call bindings are
        rejected, never rendered.
      </InfoCard>
      <InfoCard title="Errors are reported">
        Every rejection is reported as a spec-compatible issue through
        <code>onValidationError</code>, which a consumer can relay to the agent verbatim.
      </InfoCard>
    </div>

    <NoteList>
      <Note title="Why an untrusted payload is safe">
        <p>
          The payload only references a catalog <em>you</em> control, so nothing in it executes. A
          component name the registry does not know renders a fault chip; a prop the registry does
          not declare is dropped before it reaches a Svelte component; a
          <code>{'{ call }'}</code> function binding does nothing. The payload never reaches
          <code>{'{@html}'}</code>, a dynamic import, or a <code>restProps</code> spread.
        </p>
      </Note>
      <Note title="Incremental & two-way">
        <p>
          The payload is the <em>accumulated</em> envelope array: stream by extending it immutably (<code
            >{'[...prev, envelope]'}</code
          >). A2UIView applies only the newly appended envelopes, so local input edits survive a
          mid-stream update. Inputs write straight into the view's data model, bound text updates
          live, and the model syncs to the agent only on an action.
        </p>
      </Note>
      <Note title="Policy-gated media">
        <p>
          <code>Image</code> sources and <code>Text</code> markdown links pass the same
          strict-by-default <code>urlPolicy</code> as StreamingMarkdown. Every external image is
          blocked unless its prefix is allowlisted; a blocked image shows a labelled placeholder (<code
            >blockedImageLabel</code
          >) instead.
        </p>
      </Note>
    </NoteList>
  </div>
</Section>

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Golden-file replay — progressive rendering"
      description="The agent's envelopes arrive one JSONL line at a time; the consumer only extends the payload array. While streaming, a reference to a not-yet-defined child renders a skeleton placeholder, and each component fills in as its envelope lands. Clicking the button dispatches an action event."
      code={liveDemoCode}
    >
      <LiveDemo />
    </CodeExample>

    <CodeExample
      title="Urbicon catalog"
      description="The same engine against the opt-in Urbicon-native catalog (pass it via `catalogs`): intents and variants, a Section structure layer, RichText (markdown) alongside plain Text, a Select / RadioGroup / DatePicker form, an Accordion, and a data schema that type-checks every model write. Basic stays the default; the Urbicon catalog is tree-shaken out unless you import it."
      code={urbiconDemoCode}
    >
      <UrbiconDemo />
    </CodeExample>

    <CodeExample
      title="A broken payload becomes a fault chip"
      description="Video is not in the basic subset. Rather than render a component the catalog does not define, A2UIView shows a visible fault chip in its place and reports the fault through onValidationError as a spec-compatible issue the consumer can relay to the agent."
      code={brokenPayloadCode}
    >
      <BrokenPayload />
    </CodeExample>
  </div>
</Section>

<Section marker id="integration" title="Integration">
  <div class="space-y-10">
    <div>
      <h3 class="text-text-primary mb-2 text-base font-semibold">
        Wire it in via <code>partRenderers.a2ui</code>
      </h3>
      <p class="text-text-secondary mb-4 max-w-3xl text-sm leading-relaxed">
        A2UIView is <strong>not</strong> a default ChatMessage part renderer, so it stays out of the
        base conversation bundle until you opt in. Register it as the
        <code>a2ui</code> renderer; <code>ChatMessageList</code> forwards
        <code>partRenderers</code> to every <code>ChatMessage</code>. Couple the part's
        <code>streaming</code> flag to the owning message's status, so dangling references show as placeholders
        while the reply is in flight and become faults once it settles.
      </p>
      <CodeExample title="ChatMessage wiring" code={wiringCode} language="svelte" preview={false} />
    </div>

    <div>
      <h3 class="text-text-primary mb-2 text-base font-semibold">Generate the agent prompt</h3>
      <p class="text-text-secondary mb-4 max-w-3xl text-sm leading-relaxed">
        Never hand-roll the catalog description. <code>a2uiSystemPrompt()</code> renders the
        envelope rules, the component subset (props, required flags, enums), the binding forms (<code
          >{'{ path }'}</code
        >
        only; function calls are forbidden), the
        <code>root</code> rule, <code>child</code>-vs-<code>children</code>, the template form and
        the action rules, straight from the registry that validates the payload. It omits the
        transport: how envelopes reach the client is app-specific, so append that yourself.
      </p>
      <CodeExample title="System prompt" code={promptCode} language="ts" preview={false} />
    </div>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Controls come from real primitives">
      <p>
        Each component in the basic catalog maps onto a Urbicon primitive: <code>TextField</code> to
        Input/Textarea, <code>CheckBox</code> to Checkbox, <code>ChoicePicker</code> to RadioGroup,
        <code>Slider</code>
        to Slider, <code>DateTimeInput</code> to DatePicker/TimeInput. So labels, roles and keyboard
        behaviour come from the library rather than ad-hoc markup, and a component's
        <code>accessibility.label</code> becomes an <code>aria-label</code>.
      </p>
    </Note>
    <Note title="Streaming placeholders">
      <p>
        While <code>streaming</code>, a not-yet-defined reference renders a
        <code>Skeleton</code> with an <code>sr-only</code> label (<code>pendingLabel</code>), so
        assistive tech announces a loading state rather than an empty gap.
      </p>
    </Note>
    <Note title="Faults are text">
      <p>
        A rejected component renders a fault chip with a readable label (<code
          >unsupportedLabel</code
        >) next to its danger icon, so the reason is conveyed as text and not by colour alone.
        Envelope-level faults render in a danger <code>Alert</code> with its
        <code>errorTitle</code>.
      </p>
    </Note>
  </NoteList>
</Section>
