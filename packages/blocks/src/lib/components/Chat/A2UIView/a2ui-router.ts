/**
 * Surface routing across message boundaries.
 *
 * `A2UIView` is payload-driven: one view renders one envelope array, and its
 * processor lives with that view. In a chat that means one view per assistant
 * message — so a surface dies with the message that created it. The A2UI spec
 * says the opposite: a `surfaceId` is "globally unique for the renderer's
 * lifetime", `deleteSurface` is the only way to retire one, and
 * `updateComponents`/`updateDataModel` are patches an agent may send at any
 * later point. A model that patches a form it built two turns ago is reading
 * the protocol correctly; the renderer just had nowhere to put the envelope.
 *
 * This router closes that gap WITHOUT giving the engine a second state
 * lifetime. It is a pure bookkeeping layer over the transcript: it remembers
 * which source (message + a2ui part) owns which surface, and splits each
 * source's envelopes into the ones that stay put and the ones that belong to an
 * earlier source's payload. The consumer appends those to that payload
 * (`[...payload, ...patch]`, keeping element identity) and `A2UIView` consumes
 * them incrementally — two-way edits the user already made survive, because the
 * view never rebuilds.
 *
 * The transcript stays the single source of truth: every envelope still lives
 * in exactly one payload, so undo (`revoke`) and replay are plain array work.
 *
 * Zero-dependency and Svelte-free — usable from a server-side transcript
 * reducer, not just from the browser.
 */

import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';

/** The four operations an envelope may carry, in the order the spec lists them. */
const OP_KEYS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'] as const;

/**
 * Envelopes destined for one source's payload.
 *
 * `envelopes` are the very objects the caller passed in — element identity is
 * what lets `A2UIView` apply them incrementally instead of rebuilding, and what
 * makes {@link A2uiSurfaceRouter.revoke} a reference filter.
 */
export interface A2uiRoutePatch {
  /** The `sourceKey` whose payload these envelopes belong to. */
  targetKey: string;
  envelopes: unknown[];
}

/** The verdict for one {@link A2uiSurfaceRouter.route} call. */
export interface A2uiRouteResult {
  /**
   * The full envelope list this source keeps — assign it as the part's payload.
   * Envelopes routed to an earlier source are absent; everything else stays,
   * including malformed ones (the processor is what reports those).
   */
  own: unknown[];
  /** Envelopes to append to earlier sources' payloads, grouped by target. */
  patches: A2uiRoutePatch[];
  /**
   * Envelopes to REMOVE from earlier payloads (by reference) because this
   * source was rebuilt — a regenerated turn must not leave its old patches
   * behind. Empty on an append-only call.
   */
  revoked: A2uiRoutePatch[];
  /**
   * Surfaces that this call patched from a later source — i.e. surfaces that
   * just proved they outlive their own message. This is the promotion signal
   * for a client heuristic: a surface listed here is long-lived and deserves
   * treatment beyond an inline transcript entry (a jump anchor, a pinned card,
   * an artifact panel). Only fires on the transition, not on every patch.
   */
  promoted: string[];
  /** Router-level findings, shaped for the same channel as processor issues. */
  issues: A2uiValidationIssue[];
}

interface SourceState {
  /** Envelopes seen so far, in order — the prefix guard compares against this. */
  seen: unknown[];
  /** What this source keeps in its own payload. */
  own: unknown[];
  /** What this source sent to other payloads, so a rebuild can take it back. */
  sent: Map<string, unknown[]>;
  /** Surfaces this source patched from the outside (drives the promotion count). */
  patched: Set<string>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Read `(operation, surfaceId)` off an envelope — tolerantly, and without
 * duplicating the validator. Anything that is not exactly one known operation
 * with a non-empty string `surfaceId` returns `undefined`: the router then
 * leaves the envelope where it is and the processor reports the real fault.
 */
function readTarget(envelope: unknown): { op: (typeof OP_KEYS)[number]; surfaceId: string } | null {
  if (!isPlainObject(envelope)) return null;
  const ops = OP_KEYS.filter((key) => envelope[key] !== undefined);
  if (ops.length !== 1) return null;
  const op = ops[0];
  const body = envelope[op];
  if (!isPlainObject(body)) return null;
  const surfaceId = body.surfaceId;
  if (typeof surfaceId !== 'string' || surfaceId === '') return null;
  return { op, surfaceId };
}

/**
 * Tracks surface ownership across sources and routes envelopes to the payload
 * that owns their surface.
 *
 * A "source" is one A2UI payload in the transcript — in a chat app, one `a2ui`
 * part of one message. The key is the consumer's to choose; it only has to be
 * stable for that payload's lifetime (e.g. `` `${messageId}#${partIndex}` ``).
 *
 * Ownership rules:
 * - `createSurface` for an unknown id → the calling source owns it.
 * - `createSurface` for an id owned by ANOTHER source → ownership transfers to
 *   the caller (last writer wins, so the new surface actually renders) and a
 *   `SURFACE_RECREATED` issue is raised for the agent.
 * - Any operation on a surface owned by another source → routed to that owner.
 * - Any operation on an UNKNOWN surface stays with the caller, so the
 *   processor's `NO_SURFACE` error surfaces instead of vanishing here.
 * - `deleteSurface` routes to the owner and then frees the id for re-use.
 *
 * @example One assistant turn, wired into the transcript
 * ```ts
 * const result = router.route(`${messageId}#0`, part.payload);
 * part.payload = result.own;
 * for (const patch of result.patches) appendToPayload(patch.targetKey, patch.envelopes);
 * for (const surfaceId of result.promoted) markLongLived(surfaceId);
 * ```
 */
export class A2uiSurfaceRouter {
  /** surfaceId → owning sourceKey. */
  #owners = new Map<string, string>();
  #sources = new Map<string, SourceState>();
  /**
   * surfaceId → the sources that patched it from the outside. Counting the
   * patchers (rather than flagging a boolean) keeps the promotion signal honest
   * when a turn is regenerated: take the last outside patch away and the
   * surface stops being long-lived, so a later patch promotes it afresh.
   */
  #patchedBy = new Map<string, Set<string>>();

  /**
   * Detach a source: release the surfaces it owns, undo its share of every
   * promotion, and report the envelopes it had pushed elsewhere.
   */
  #detach(sourceKey: string, source: SourceState): A2uiRoutePatch[] {
    for (const [surfaceId, owner] of this.#owners) {
      if (owner === sourceKey) {
        this.#owners.delete(surfaceId);
        this.#patchedBy.delete(surfaceId);
      }
    }
    for (const surfaceId of source.patched) {
      const patchers = this.#patchedBy.get(surfaceId);
      if (!patchers) continue;
      patchers.delete(sourceKey);
      if (patchers.size === 0) this.#patchedBy.delete(surfaceId);
    }
    const patches: A2uiRoutePatch[] = [];
    for (const [targetKey, envelopes] of source.sent) {
      if (envelopes.length > 0) patches.push({ targetKey, envelopes });
    }
    return patches;
  }

  /**
   * Route one source's envelope list.
   *
   * Call it as often as you like — on every streamed token, if that is when the
   * payload grows. Only envelopes appended since the last call are examined; an
   * unchanged prefix is never re-routed, so patches are never duplicated. If
   * the prefix DID change (a regenerated turn), the source is rebuilt from
   * scratch and its previous patches come back in `revoked`.
   *
   * @param sourceKey Stable id of the payload being routed.
   * @param envelopes The payload's accumulated envelopes, in stream order.
   */
  route(sourceKey: string, envelopes: readonly unknown[]): A2uiRouteResult {
    const previous = this.#sources.get(sourceKey);
    const isAppend =
      previous !== undefined &&
      envelopes.length >= previous.seen.length &&
      previous.seen.every((envelope, index) => envelope === envelopes[index]);

    const revoked: A2uiRoutePatch[] = [];
    let source: SourceState;
    let startIndex: number;

    if (isAppend) {
      source = previous;
      startIndex = previous.seen.length;
    } else {
      // Rebuild: hand back whatever this source had pushed into other payloads
      // and drop the surfaces it owned, so re-routing re-establishes them.
      if (previous) revoked.push(...this.#detach(sourceKey, previous));
      source = { seen: [], own: [], sent: new Map(), patched: new Set() };
      this.#sources.set(sourceKey, source);
      startIndex = 0;
    }

    const patches = new Map<string, unknown[]>();
    const promoted: string[] = [];
    const issues: A2uiValidationIssue[] = [];

    for (let index = startIndex; index < envelopes.length; index++) {
      const envelope = envelopes[index];
      source.seen.push(envelope);

      const target = readTarget(envelope);
      if (!target) {
        source.own.push(envelope);
        continue;
      }
      const { op, surfaceId } = target;
      const owner = this.#owners.get(surfaceId);

      if (op === 'createSurface') {
        if (owner !== undefined && owner !== sourceKey) {
          issues.push({
            severity: 'warning',
            code: A2UI_ISSUE_CODES.SURFACE_RECREATED,
            surfaceId,
            message:
              `Surface "${surfaceId}" was already created earlier in this conversation. ` +
              "A surfaceId must stay unique for the renderer's lifetime — to change an " +
              'existing surface send updateComponents/updateDataModel for it instead of ' +
              'createSurface, or pick a new id.'
          });
        }
        // Last writer wins either way: the newest source owns the id, so its
        // surface renders and later patches follow it. A recreated surface is
        // a fresh one — its promotion history goes with the old incarnation.
        this.#owners.set(surfaceId, sourceKey);
        this.#patchedBy.delete(surfaceId);
        source.own.push(envelope);
        continue;
      }

      // An unknown surface stays here on purpose — fail loud through the
      // processor rather than silently dropping the envelope.
      if (owner === undefined || owner === sourceKey) {
        source.own.push(envelope);
        if (op === 'deleteSurface' && owner === sourceKey) this.#owners.delete(surfaceId);
        continue;
      }

      // The surface lives in an earlier payload — send the patch there.
      const bucket = patches.get(owner) ?? [];
      bucket.push(envelope);
      patches.set(owner, bucket);
      const sent = source.sent.get(owner) ?? [];
      sent.push(envelope);
      source.sent.set(owner, sent);

      const patchers = this.#patchedBy.get(surfaceId) ?? new Set<string>();
      const wasLongLived = patchers.size > 0;
      patchers.add(sourceKey);
      this.#patchedBy.set(surfaceId, patchers);
      source.patched.add(surfaceId);
      if (!wasLongLived) promoted.push(surfaceId);

      if (op === 'deleteSurface') {
        this.#owners.delete(surfaceId);
        this.#patchedBy.delete(surfaceId);
      }
    }

    return {
      own: source.own.slice(),
      patches: [...patches].map(([targetKey, list]) => ({ targetKey, envelopes: list })),
      revoked,
      promoted,
      issues
    };
  }

  /**
   * Forget a source entirely — call it when a message leaves the transcript
   * (regenerate, delete, branch switch). The returned patches are the envelopes
   * this source had pushed into other payloads; remove them by reference so no
   * orphaned patch survives its author.
   */
  revoke(sourceKey: string): A2uiRoutePatch[] {
    const source = this.#sources.get(sourceKey);
    if (!source) return [];
    this.#sources.delete(sourceKey);
    return this.#detach(sourceKey, source);
  }

  /** The source whose payload currently holds `surfaceId`, if any. */
  ownerOf(surfaceId: string): string | undefined {
    return this.#owners.get(surfaceId);
  }

  /**
   * Whether a surface has been patched from a later source — the promotion
   * predicate, for clients that need to ask after the fact rather than react to
   * {@link A2uiRouteResult.promoted}.
   */
  isLongLived(surfaceId: string): boolean {
    return (this.#patchedBy.get(surfaceId)?.size ?? 0) > 0;
  }

  /** Every surface currently owned by a source, in creation order. */
  surfaceIds(): string[] {
    return [...this.#owners.keys()];
  }

  /**
   * Every source key routed so far, in first-seen order.
   *
   * Needed to retire a source whose payload no longer shows it: a message whose
   * envelopes ALL travelled to earlier surfaces keeps no a2ui part of its own,
   * so the caller cannot reconstruct its keys by counting parts.
   */
  sourceKeys(): string[] {
    return [...this.#sources.keys()];
  }

  /** Drop all bookkeeping (new conversation). */
  reset(): void {
    this.#owners.clear();
    this.#sources.clear();
    this.#patchedBy.clear();
  }
}
