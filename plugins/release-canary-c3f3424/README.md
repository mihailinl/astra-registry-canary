# release-canary-c3f3424

A test fixture, not a plugin for users. The registry's weekly release canary
(BOT-88) builds it through AstraPlugins' `plugin-release.yml` at
`c3f342469d186ef48458992930bf1b7c583c78d4`, one of the commits the registry's `trust.json` allowlists, and
verifies what comes out. See the repository's README.

It is the scaffold `astra-plugin new --template tool` writes, unchanged but
for its manifest's name, description, author and licence: one tool that says
hello.
