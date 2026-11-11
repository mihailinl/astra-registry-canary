# release-canary-496f440

A test fixture, not a plugin for users. It is BOT-88's canary caller for
AstraPlugins' `plugin-release.yml` at
`496f44075c7ff989979bd059b5b6f14c9ff23441` (merge of #170, "platform/macos-arm64-release",
2026-11-10), the commit that adds the macOS arm64 leg and that trust.json
serial 6 allowlists. Because trust.json allowlists the commit, `canary-tag.yml`'s
weekly job tags and releases it like any other allowlisted commit. See the
repository's README.

It is the scaffold `astra-plugin new --template tool` writes (CLI from
AstraPlugins 496f440), unchanged but for its manifest's description, author and
licence: one tool that says hello.
