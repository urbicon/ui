# Text that looks like markup but is not

Identifiers with underscores are a classic false positive: names like
`my_function_name`, `MAX_BUFFER_SIZE`, and `snake_case_words` appear constantly
in technical prose, and the underscores inside them must not start emphasis.
Written outside a code span — my_function_name and snake_case_words again — the
same rule holds: intra-word underscores are literal.

Tildes are similarly overloaded. A home path like ~/projects/app, an
approximation such as ~500ms, and a long decorative run like this:

~~~~~~~~~~~~~~~~~~~~~~~~~

should all survive as plain text rather than collapsing into strikethrough. Only
a real `~~pair~~` around content becomes a strike.

Asterisks in arithmetic — 2 * 3 * 4 — and a lone star at the end of a line * are
likewise just characters, not emphasis delimiters.
