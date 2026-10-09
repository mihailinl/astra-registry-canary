# release-canary-9864f03

A test fixture, not a plugin for users. It is AP-20's candidate caller: built
once through AstraPlugins' `plugin-release.yml` at
`9864f03bafb52a7de5215ff92376eeefa7331431` (2026-10-07: the plugin UI kit's
tooling pin, a pinned bun and a frontend install step, on top of #87's verify
command), the commit AP-20 prepares to add to the registry's `trust.json`
allowlist at the next root ceremony. Until that ceremony, trust.json does not
allowlist it, so BOT-88's weekly `canary-tag.yml` job skips it (`lib.mjs`'s
`compareAllowlist`) and its one release is tagged by hand, under the owner's
approval, per the registry plan's "Test the thing before the freeze". See the
repository's README.

It is the scaffold `astra-plugin new --template tool` writes, unchanged but
for its manifest's name, description, author and licence: one tool that says
hello.
