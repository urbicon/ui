# Designing a rate limiter from scratch

Rate limiting looks trivial until you actually deploy one, at which point every
simplifying assumption you made comes back to bite. This walkthrough builds one
up from the naive version to something you would be comfortable running in
production, and points out the traps along the way.

## Why you cannot just count requests

The obvious first idea is a counter per client that resets every minute. It is
easy to reason about and easy to get wrong, because a fixed window lets a client
send a full burst at `00:59` and another full burst at `01:00` — double the
intended rate across a two-second span.

> A limiter that is correct on average but wrong at the boundaries is not a
> limiter. It is a suggestion.

So the real requirement is smoothness, not just an average.

## The algorithms worth knowing

There are four you will encounter in practice, and they trade off differently:

| Algorithm       | Smooth? | Memory      | Bursts        |
| :-------------- | :-----: | :---------- | ------------: |
| Fixed window    |   no    | tiny        |    allowed 2x |
| Sliding log     |   yes   | O(requests) |          none |
| Sliding window  |   yes   | small       |       bounded |
| Token bucket    |   yes   | O(1)        |  configurable |

My default is the token bucket. It gives you O(1) memory per client, it lets you
allow *controlled* bursts by sizing the bucket, and the refill math is a single
subtraction.

### Token bucket, step by step

The whole model is two numbers per client: how many tokens are in the bucket,
and when it was last refilled. On each request you:

1. Compute how many tokens have accrued since the last refill.
2. Clamp the bucket to its maximum capacity.
3. If at least one token is present, spend it and allow the request.
4. Otherwise reject and tell the caller when to retry.

Here is the core, deliberately dependency-free:

```ts
interface Bucket {
  tokens: number;
  updatedAt: number;
}

function allow(
  bucket: Bucket,
  now: number,
  ratePerSec: number,
  capacity: number
): { ok: boolean; retryAfter: number } {
  const elapsed = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * ratePerSec);
  bucket.updatedAt = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { ok: true, retryAfter: 0 };
  }
  const retryAfter = (1 - bucket.tokens) / ratePerSec;
  return { ok: false, retryAfter };
}
```

Notice there is no timer anywhere. Refill is *lazy* — computed on read from the
elapsed time — which is what keeps memory at O(1) and makes the whole thing
trivially correct under restarts.

## Where it gets hard: distribution

A single-process bucket is easy. The moment you have more than one server, every
one of them has its own view of the bucket and the effective limit multiplies by
the number of replicas. Three options, roughly in order of effort:

- **Sticky routing.** Pin each client to one replica so its bucket lives in one
  place. Simple, but rebalancing and failover reset limits.
- **Central store.** Keep buckets in something like Redis and run the refill as
  an atomic script. Correct, at the cost of a network hop per request.
- **Local with reconciliation.** Each replica keeps a local bucket sized to its
  share of the global budget, and a background process rebalances shares based on
  observed traffic. Fast and mostly correct, fiddly to tune.

For most services the central store wins: the extra latency is a fraction of a
millisecond on a warm connection, and you get exact global limits for free.

### The atomic-script sketch

The one rule that matters: the read-modify-write must be atomic, or two
concurrent requests both see one token and both spend it.

```py
# Executed atomically on the store.
def allow(key, now, rate, capacity):
    tokens, updated = load(key)
    tokens = min(capacity, tokens + (now - updated) * rate)
    if tokens >= 1:
        save(key, tokens - 1, now)
        return True
    save(key, tokens, now)
    return False
```

## Things people forget

A short checklist of the mistakes I have personally shipped:

- [x] Return a `Retry-After` header, not just a `429`.
- [x] Key on something forgeable-resistant, not a spoofable header.
- [ ] Exempt health checks and internal traffic from the limit.
- [ ] Add a separate, looser limit for authenticated users.
- [ ] Emit a metric on every rejection so you can see abuse early.

---

## Closing thought

The algorithm is the easy ten percent. The hard ninety is *keying* (who is a
client, really?) and *distribution* (whose count is authoritative?). Get those
two right and almost any of the four algorithms above will serve you well. Get
them wrong and the fanciest sliding-window math will still let an attacker walk
right through.

If you take one thing away: make refill lazy, make the write atomic, and always
tell the caller when to come back.
