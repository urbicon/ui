# Reading a file, three ways

The same task in three languages, so you can see how the ergonomics differ.

TypeScript, using the modern promises API:

```ts
import { readFile } from 'node:fs/promises';

const text = await readFile('notes.md', 'utf8');
console.log(text.split('\n').length, 'lines');
```

Python, where the context manager handles closing for you:

```py
with open("notes.md", encoding="utf-8") as f:
    lines = f.readlines()
print(len(lines), "lines")
```

And a plain shell one-liner, no language server required:

```
wc -l notes.md
```

One subtlety: a code span can contain backticks in prose, like the string
`` `backtick` `` — that is fine and does not open a fence, because a fence has
to be a line that starts with three backticks. Inline text such as `a ` b` is
just a code span followed by more text.
