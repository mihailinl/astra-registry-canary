# astra-withdrawal-canary

A test fixture, not a plugin for users. It is the registry's staging listing
(contract MOD-16; registry plan M-T2.1 and M-T2.2): the one listing the
registry may delist, relist, revoke and un-revoke on demand, so that a
withdrawal can be walked end to end without doing it to somebody's plugin.
It is built through AstraPlugins' `plugin-release.yml` at
`c3f342469d186ef48458992930bf1b7c583c78d4`, one of the commits the registry's `trust.json` allowlists.

The registry publishes it **unlisted** from its first listing
(`policy/reserved-ids.json`'s `staging_listing_id`), so it is never in a signed
catalogue. Unlike the `release-canary-*` plugins beside it, it is **never
tagged by the weekly canary**: its tag, `astra-withdrawal-canary-v<version>`,
is pushed by the owner, once per walk. See the repository's README.

It is the scaffold `astra-plugin new --template tool` writes, unchanged but
for its manifest's name, description, author and licence: one tool that says
hello.
