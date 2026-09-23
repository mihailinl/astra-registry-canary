# astra-registry-canary

**A test fixture. Nothing here is a plugin for users, and nothing here is ever
listed in the Astra catalogue as one.** It exists so that the
[Astra plugin registry](https://github.com/mihailinl/astra-registry) can watch
its own release path work between real releases.

## What it is for

Every Astra plugin is released through one reusable workflow,
[`plugin-release.yml`](https://github.com/mihailinl/AstraPlugins/blob/master/.github/workflows/plugin-release.yml),
pinned by commit. The registry accepts a build attestation only from the
commits its `trust.json` allowlists. Those commits pull moving action tags and
a moving toolchain, and an author's release is the only thing that runs them —
so without this repository, a GitHub-side change that broke them would first
be found by a third-party author, and the fix is a signing ceremony
(registry plan BOT-88).

So, once a week, [`canary-tag.yml`](.github/workflows/canary-tag.yml) releases
one small plugin through **each** allowlisted commit, exactly the way an author
does — `astra-plugin version`, a commit, a tag, a push — and the registry's
weekly release canary downloads the newest release per commit, hashes it,
verifies its attestation, reads every field it would read from an author's
release, and alerts on any failure. The canary asks the registry for no
verdict: it is a dry run that commits nothing there.

| Here | What it is |
|---|---|
| `plugins/release-canary-<sha7>/` | One plugin per allowlisted commit, scaffolded by `astra-plugin new` at the CLI commit that workflow builds with |
| `.github/workflows/release-release-canary-<sha7>.yml` | Its caller, exactly as `astra-plugin init-ci --ref <sha>` wrote it |
| `.github/workflows/canary-tag.yml` | The weekly tag, one per caller, and a heartbeat to the registry's dead-man receiver |
| `.github/workflows/author-token-probe.yml` | OPEN-MBE-2's one-off measurement of an author-audience OIDC token's claims. It never prints or sends the token |
| `.github/workflows/probe-log-lint.yml` | Red if the probe's log ever holds a JWT's shape |
| `.github/workflows/keepalive.yml` | One commit a month, so GitHub never switches this repository's schedules off (ROLL-62) |
| `.github/workflows/checks.yml` | `node --test tests/*.test.mjs`: the rules the scripts above run on |
| `.well-known/astra-plugin-owner` | The owner file the registry reads. main carries **no** binding line |

### The canary's commit and its binding line

Each weekly canary is one commit on top of `main`, reachable **only from its
tags** — `main` itself never moves. That commit bumps each plugin's version to
`0.<YYYYMMDD>.<n>` and appends a binding line to the owner file,
`astra-binding: bot88-canary-grammar-only-never-minted`. It has the grammar
contract ID-23 fixes and was never minted by anyone: the canary checks the
line's grammar, never asks for a verdict, and a real token would be a
credential in a public file for no purpose. Keeping it off `main` keeps it off
every other release this repository makes.

### Also here, later

- the registry's **staging listing**, `astra-withdrawal-canary` (registry plan
  M-T2.1/M-T2.2, at rollout R2), released from `main` — which is one more
  reason `main` carries no binding line;
- the one-off **live run** of the registry's moderation-coverage canary
  (M-T1.5), on a branch of its own;
- **AP-20's candidate canary** before a renewal ceremony (2027);
- the **test-client bundle** an installed Astra 0.2.x copy is disabled and
  restored with in ROLL-56's withdrawal walks: any canary release's bundle.

## Tags pushed here without asking, and nothing else

Under the owner's standing grant of 2026-09-23, these are pushed or deleted
without a per-tag approval:

- `release-canary-<sha7>-v0.<YYYYMMDD>.<n>`, pushed by `canary-tag.yml`'s
  `push` job, one per allowlisted caller per run;
- their deletion, with their Releases, by its `prune` job once a caller has
  more than eight;
- `author-token-probe-<date>`, pushed by hand for OPEN-MBE-2, and one re-run of
  the run it starts.

Any other tag here — the staging listing's release tag, AP-20's candidate
canary — is its own task's act and is recorded there.

## The credential, and where things are kept

- **Environment `canary-tag`**, admitting only `main`, holds both secrets the
  weekly job needs:
  - `CANARY_TAG_DEPLOY_KEY` — the private half of this repository's write
    **deploy key**. A tag pushed with `GITHUB_TOKEN` starts no workflow run, so
    the tag needs a credential of its own; a deploy key is scoped to this one
    repository's contents and nothing else, which is the scope the plan asked
    a fine-grained token for, and it can be created and revoked by API. Its
    private half was generated in memory, placed here from stdin, and deleted;
    no copy exists anywhere else.
  - `ASTRA_DEADMAN_URL_CANARY_TAG` — the whole ping URL of receiver check
    `canary-tag` (registry plan BOT-85). The check is created disarmed and arms
    at its first post; until the URL is placed, the job says so on the run and
    posts nothing.
- Branch `main` and every tag are protected by rulesets: `main` cannot be
  deleted or force-pushed, and no tag can be moved.

## Licence

GPL-3.0-or-later (see `LICENSE`), like the rest of the registry. Copyright
Minice.
