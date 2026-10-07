# release-canary-e36f6a2

A test fixture, not a plugin for users. It is AP-20's candidate caller: built
once through AstraPlugins' `plugin-release.yml` at
`e36f6a2413012dc513d347550512719008e66844` (AstraPlugins #87, 2026-10-06), the
commit AP-20 prepares to add to the registry's `trust.json` allowlist at the
next root ceremony. Until that ceremony, trust.json does not allowlist it, so
BOT-88's weekly `canary-tag.yml` job skips it (`lib.mjs`'s `compareAllowlist`)
and its one release is tagged by hand, under the owner's approval, per the
registry plan's "Test the thing before the freeze". See the repository's
README.

It is the scaffold `astra-plugin new --template tool` writes, unchanged but
for its manifest's name, description, author and licence: one tool that says
hello.
