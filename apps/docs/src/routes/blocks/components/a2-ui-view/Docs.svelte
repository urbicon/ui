<script lang="ts">
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import LiveDemo from './examples/LiveDemo.svelte';
  import BrokenPayload from './examples/BrokenPayload.svelte';

  import liveDemoCode from './examples/LiveDemo.svelte?raw';
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

<Section marker="01" id="concept" title="How it works">
  <div class="space-y-6">
    <p class="text-text-secondary max-w-3xl leading-relaxed">
      A2UI (Agent-to-UI) lets an agent describe an interface as <strong>data</strong>, not
      executable code. The agent never ships components or scripts — it emits JSONL
      <em>envelopes</em> that reference a <strong>trusted catalog</strong> your app already ships.
      A2UIView is the renderer for the Urbicon subset of A2UI <code>v0.9.1</code>
      <code>basic</code>: it maps the catalog components onto real Urbicon primitives and renders
      them live and interactive.
    </p>

    <div class="grid gap-4 sm:grid-cols-3">
      <InfoCard title="Data, not code">
        Envelopes are inert JSON. Only the mapped components and their declared props ever reach the
        DOM — nothing the payload says can execute.
      </InfoCard>
      <InfoCard title="Whitelist-only">
        Unknown components, unknown props, prototype-pollution keys and function-call bindings are
        rejected, never rendered.
      </InfoCard>
      <InfoCard title="Fail-loud">
        Every rejection surfaces as a spec-compatible issue through
        <code>onValidationError</code> — a consumer can relay it to the agent verbatim.
      </InfoCard>
    </div>

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <div class="divide-border-subtle divide-y">
        <div class="pb-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">The enforcement thesis</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            An agent is untrusted. If it could emit arbitrary markup or handlers, the surface would
            be an injection vector. A2UIView removes that class of risk by construction: the payload
            is a reference into a catalog <em>you</em> control. A component name the registry does
            not know is a fault chip, not a mystery element; a prop the registry does not declare
            never reaches a Svelte component; a <code>{'{ call }'}</code> function binding resolves
            to nothing. There is no <code>{'{@html}'}</code>, no dynamic import, no
            <code>restProps</code> spread from the payload anywhere in the path.
          </p>
        </div>
        <div class="py-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Incremental & two-way</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            The payload is the <em>accumulated</em> envelope array — stream by extending it
            immutably (<code>{'[...prev, envelope]'}</code>). A2UIView applies only the newly
            appended envelopes, so local input edits survive a mid-stream update. Inputs write
            straight into the surface data model; bound text updates live; the model syncs to the
            agent only on an action.
          </p>
        </div>
        <div class="pt-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Policy-gated media</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            <code>Image</code> sources and <code>Text</code> markdown links pass the same
            strict-by-default <code>urlPolicy</code> as StreamingMarkdown. Every external image is blocked
            unless its prefix is allowlisted; a blocked image renders an alt chip instead.
          </p>
        </div>
      </div>
    </div>
  </div>
</Section>

<Section marker="02" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Golden-file replay — progressive rendering"
      description="The agent's envelopes arrive one JSONL line at a time; the consumer only extends the payload array. While streaming, a reference to a not-yet-defined child renders a skeleton placeholder — components fill in as their envelopes land, and the Button dispatches a spec-exact action event when clicked."
      code={liveDemoCode}
    >
      <LiveDemo />
    </CodeExample>

    <CodeExample
      title="A broken payload becomes a fault chip"
      description="Video is not in the basic subset. Instead of rendering something the catalog never sanctioned, A2UIView drops a visible fault chip in its place and reports the fault through onValidationError as a spec-compatible issue the consumer can relay to the agent."
      code={brokenPayloadCode}
    >
      <BrokenPayload />
    </CodeExample>
  </div>
</Section>

<Section marker="03" id="integration" title="Integration">
  <div class="space-y-10">
    <div>
      <h3 class="text-text-primary mb-2 text-base font-semibold">
        Wire it in via <code>partRenderers.a2ui</code>
      </h3>
      <p class="text-text-secondary mb-4 max-w-3xl text-sm leading-relaxed">
        A2UIView is deliberately <strong>not</strong> a default ChatMessage part renderer — keeping
        it opt-in keeps it out of the base conversation bundle. Register it per surface as the
        <code>a2ui</code> renderer; <code>ChatMessageList</code> forwards
        <code>partRenderers</code> to every <code>ChatMessage</code>. Couple the part's
        <code>streaming</code> flag to the owning message's status so dangling references degrade to placeholders
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
        only — function calls are explicitly forbidden), the
        <code>root</code> rule, <code>child</code>-vs-<code>children</code>, the template form and
        the action rules, straight from the registry that validates the payload. It omits the
        transport — how envelopes reach the client is app-specific, so append that yourself.
      </p>
      <CodeExample title="System prompt" code={promptCode} language="ts" preview={false} />
    </div>
  </div>
</Section>

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Real controls, real labels</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Each catalog component maps onto a real Urbicon primitive — <code>TextField</code> to
          Input/Textarea, <code>CheckBox</code> to Checkbox, <code>ChoicePicker</code> to
          RadioGroup, <code>Slider</code> to Slider, <code>DateTimeInput</code> to
          DatePicker/TimeInput — so labels, roles and keyboard behaviour come from the library, not
          from ad-hoc markup. A component's
          <code>accessibility.label</code> becomes an <code>aria-label</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Streaming placeholders</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          While <code>streaming</code>, a not-yet-defined reference renders a
          <code>Skeleton</code> with an <code>sr-only</code> label (<code>pendingLabel</code>), so
          assistive tech announces a loading state rather than an empty gap.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Faults are text</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          A rejected component renders a fault chip with a readable label (<code
            >unsupportedLabel</code
          >) alongside its danger icon — the reason is text, not colour alone. Envelope-level faults
          render in a danger <code>Alert</code> with its
          <code>errorTitle</code>.
        </p>
      </div>
    </div>
  </div>
</Section>
