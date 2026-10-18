# release-canary-b6e9140

A test fixture, not a plugin for users. It is BOT-88's canary caller for
AstraPlugins' `plugin-release.yml` at
`b6e9140d53060585c70280e979b58202f34966ba` (merge of #104, "plugin-release:
the author wake (notify job)", 2026-10-18T03:43:09Z), the commit the D4 root
ceremony allowlisted in trust.json serial 4 on 2026-10-18 and moved
`plugin-release/v1` to. This repository had no caller for it yet, so BOT-88's
canary did not cover the workflow every author now uses; adding this caller
closes that gap. Because trust.json already allowlists the commit,
`canary-tag.yml`'s weekly job tags and releases it like any other allowlisted
commit — no hand-tagging under a separate approval, unlike an AP-20 candidate
pinned before its ceremony. See the repository's README.

It is the scaffold `astra-plugin new --template tool` writes, unchanged but
for its manifest's name, description, author and licence: one tool that says
hello.
