# Answer with citations

The transformer architecture removed recurrence entirely and replaced it with
self-attention [1], which made training parallelizable across sequence
positions. Later work showed that scaling the same architecture predictably
improves loss [2], and that instruction tuning on top of a base model sharply
improves usefulness on held-out tasks [3].

Not every bracketed number is a citation, though. A phrase like "step [1] of the
setup" or a list index [0] in prose should stay plain text unless its id is in
the known citation set — the parser must not turn every `[n]` into a marker.

Full-width brackets appear too, especially from models trained on CJK corpora:
a marker like 【1】 should be recognized the same way its ASCII cousin is.
