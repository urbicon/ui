export const recipeMeta = {
  pattern: 'a2ui-agent-ui',
  title: 'Agent-generated UI (A2UI)',
  description:
    'A chat where the agent answers with live UI instead of prose: A2uiStreamSplitter turns the token stream into a2ui parts, A2UIView renders them against a trusted catalog, and A2uiSurfaceRouter lets a later turn patch a form the agent sent earlier — the multi-step flow (pick a date → load slots → confirm) without rebuilding the surface.',
  components: ['A2UIView', 'Chat', 'ChatMessageList', 'PromptInput'],
  features: [
    'a2uiSystemPrompt() + a2uiFencedTransportSection(): catalog contract and wire format, generated from the same source the validator checks against',
    'A2uiStreamSplitter: token stream → ordered text / a2ui parts, chunk-decomposition invariant',
    'A2UIView with the Urbicon catalog and an optional data schema — fail-loud, whitelist-only rendering',
    'A2uiSurfaceRouter + routeMessageParts(): envelopes from a later turn reach the message that owns the surface',
    'Streaming grace for patched messages (result.targets) so half-arrived patches show placeholders, not error chips',
    'sendDataModel: true — every action carries the full form state, read at click time',
    'Choices bind to the data model (value: { path }); actions are reserved for fetch and commit',
    'Fetched options live in the data model and bind via options: { path }',
    'Validation issues relayed to the agent behind a [ui-error] prefix so it can repair its own surface'
  ]
};
