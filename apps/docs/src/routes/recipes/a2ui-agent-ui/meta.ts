import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'ai-chat',
  category: 'AI',
  difficulty: 'Advanced',
  title: 'Agent-generated UI (A2UI)',
  description:
    "A chat where the agent answers with live UI instead of prose: A2uiStreamSplitter turns the token stream into a2ui parts, A2UIView renders them against a trusted catalog, and A2uiSurfaceRouter delivers a later turn's envelopes to the form the agent sent earlier. A multi-step flow (pick a date, load free rooms, choose one) patches one surface instead of rebuilding it.",
  components: ['A2UIView', 'Chat', 'ChatMessage', 'ChatMessageList', 'PromptInput'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'The system prompt is assembled from a2uiSystemPrompt, a2uiDataSchemaSection and a2uiFencedTransportSection: catalog contract, data contract and wire format come from the same source the validator checks, so the prompt cannot describe UI the renderer rejects.',
    'A2uiStreamSplitter turns the token stream into ordered text / a2ui parts; it buffers partial lines, so fences may straddle chunks.',
    "A2uiSurfaceRouter + routeMessageParts deliver a later turn's envelopes to the message that owns the surface; revokeMessage takes a dropped turn's patches back out.",
    'Messages mid-patch (result.targets) keep streaming grace: placeholders instead of dangling-reference chips until the round completes.',
    'A2UIView renders whitelist-only against the Urbicon catalog and an optional data schema; validation issues return to the agent behind a [ui-error] prefix so it can repair its own surface.',
    'Choices and fetched options bind to the data model (value / options: { path }); actions are reserved for fetch and commit and carry the full form state (sendDataModel: true), read at click time.'
  ]
};
