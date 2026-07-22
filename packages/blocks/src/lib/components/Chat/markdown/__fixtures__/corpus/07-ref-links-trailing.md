# Further reading

If you want to go deeper on the streaming parser design, three sources shaped
the approach here. The [CommonMark spec][cm] is the ground truth for block
structure, the [GFM extension][gfm] adds tables and task lists, and the
[incremental parsing notes][inc] cover why settled blocks keep their identity.

The interesting property is that all three links above are written as reference
style, and their definitions do not appear until the very end of the document.
A streaming parser sees `[CommonMark spec][cm]` long before it ever sees what
`cm` resolves to — so until the definition arrives the label has to render as
readable text, then upgrade to a real link once the tail settles.

That is the whole reason this fixture exists: the definitions below stream in
last.

[cm]: https://spec.commonmark.org/ "CommonMark 0.31"
[gfm]: https://github.github.com/gfm/ "GitHub Flavored Markdown"
[inc]: https://example.org/incremental-markdown
