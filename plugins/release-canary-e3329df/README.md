# release-canary-e3329df

A test fixture, not a plugin for users. The registry's weekly release canary
(BOT-88) builds it through AstraPlugins' `plugin-release.yml` at
`e3329df252a46d747676cb540ae4b986af68a3ad`, one of the commits the registry's `trust.json` allowlists, and
verifies what comes out. See the repository's README.

It is the scaffold `astra-plugin new --template tool` writes, unchanged but
for its manifest's name, description, author and licence: one tool that says
hello.
