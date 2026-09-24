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
| `plugins/astra-withdrawal-canary/` | The registry's **staging listing** (MOD-16; registry plan M-T2.1, M-T2.2), the same scaffold. Published unlisted, and **never tagged by the weekly job** |
| `.github/workflows/release-astra-withdrawal-canary.yml` | Its caller, exactly as `astra-plugin init-ci --ref c3f342469d186ef48458992930bf1b7c583c78d4` wrote it: the newest allowlisted commit, the one `plugin-release/v1` points at |
| `.github/workflows/canary-tag.yml` | The weekly tag, one per canary caller, and a heartbeat to the registry's dead-man receiver |
| `.github/workflows/author-token-probe.yml` | OPEN-MBE-2's one-off measurement of an author-audience OIDC token's claims. It never prints or sends the token |
| `.github/workflows/probe-log-lint.yml` | Red if the probe's log ever holds a JWT's shape, or the runner masked a line the probe printed — GitHub masks a JWT-shaped string before storing the log, so the shape alone is never seen |
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

### The staging listing

`plugins/astra-withdrawal-canary/` is the registry's staging listing (registry
plan M-T2.1/M-T2.2, at rollout R2): the one listing the registry may delist,
relist, revoke and un-revoke on demand, so that a withdrawal can be walked end
to end without doing it to anybody's plugin. The registry derives it
`unlisted` from its first listing, so it is never in a signed catalogue.

- It is released from `main`, which is one more reason `main` carries no
  binding line.
- Its caller pins an allowlisted commit and may share it with a canary caller;
  `.github/scripts/lib.mjs` (`STAGING_PLUGIN_DIR`) tells the two apart. **The
  weekly job never tags it and `prune` never deletes its tags.** `canary-tag`
  still reads its pin and goes red when trust.json no longer allowlists it.
- Its tag, `astra-withdrawal-canary-v<version>` (the first is
  `astra-withdrawal-canary-v0.1.0`), is the owner's act, once per walk, and is
  recorded with the walk.

### Also here, later

- the one-off **live run** of the registry's moderation-coverage canary
  (M-T1.5), on a branch of its own;
- **AP-20's candidate canary** before a renewal ceremony (2027);
- the **test-client bundle** an installed Astra 0.2.x copy is disabled and
  restored with in ROLL-56's withdrawal walks: any canary release's bundle.

## ROLL-60's rehearsal: `signed`, `signed-compromise` and Pages

The registry's R2 exit (contract ROLL-60) needs a staging plugins service and a
debug 0.2.x daemon to accept a key rotation signed with the throwaway
`tools/testkeys` keys. The service reads it from here:

| Here | What it is |
|---|---|
| branch `signed` | The rotation series (`tools/testkeys/fixtures/rehearsal-r2/rotation/`), one commit per step, each the exact commit the registry's signer made when the series was generated |
| branch `signed-compromise` | D10's compromise line: rotation steps 0-2, then `compromise/00-drop-2026a`. Its own branch, because it forks from step 2 |
| Pages | Serves branch `signed` (legacy build, root), so `registry/v1/*.json` at `https://mihailinl.github.io/astra-registry-canary/` is always a step the branch carries |
| `main`'s merge of `refs/rehearsal-source/*` | The fixture generator's throwaway registry history, merged with `-s ours`: the commits every step's `Source-Commit` names, so the service's TRUST-3 holds. `main`'s tree is unchanged by it |

- **Everything on those two branches is TEST-ONLY**, signed by keys whose
  private halves are public in the registry. No shipped Astra build trusts them.
- **Only `astra-registry`'s `tools/testkeys/rehearsal-push.mjs --step N` pushes
  there**, one fast-forward commit per step, never forced. Nothing else is
  pushed to them, and they are never rewound: a service that has accepted a step
  refuses a head that does not descend from it (SERVE-18).
- **The lists in the series expire on 2026-09-29.** After that the branches are
  a record, and a new rehearsal needs a regenerated series on new branches.
- The runbook is astra-plugins-ops `runbooks/roll-60-rehearsal.md`.

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
