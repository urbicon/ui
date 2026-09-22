# urbicon

The unscoped name for the [`urbicon` CLI](https://github.com/urbicon/ui/blob/main/packages/design/README.md),
which ships in `@urbicon-ui/design`. This package holds nothing of its own: its one file
resolves the installed `@urbicon-ui/design` and runs its bin in-process, so `bunx urbicon …`
works in every project — one that has the design package installed and one that does not —
instead of failing with `GET …/urbicon 404`. It depends on `@urbicon-ui/design` at exactly
its own version, so the two release in lockstep.

A project still adds `@urbicon-ui/design` as its devDependency:

```bash
bun add -d @urbicon-ui/design
bunx urbicon init
```

`urbicon init` requires the package to be installed in the project, because every line it
writes runs it (`bunx urbicon …` in the context block, the hook and the CI workflow). From a
project that has not installed it, `bunx urbicon init` now fails with that instruction and
exit code 2 instead of a 404, and writes nothing.

## License

MIT
