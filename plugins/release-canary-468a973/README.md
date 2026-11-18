# release-canary-468a973

A test fixture, not a plugin for users. It is BOT-88's canary caller for
AstraPlugins' `plugin-release.yml` at
`468a9731577f28055cec8009411dce75bf52908c` (merge of #180, the release CLI pin
moved to cli-v0.5.2, 2026-11-18), the commit that trust.json serial 6
allowlists. Because trust.json allowlists the commit, `canary-tag.yml`'s weekly
job tags and releases it like any other allowlisted commit. See the
repository's README.

It is the scaffold `astra-plugin new --template tool` writes (CLI 0.5.2, built
from AstraPlugins 468a973), unchanged but for its manifest's description, author
and licence: one tool that says hello.
