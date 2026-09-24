// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// The pure half of this repository's scripts: everything here takes text and
// returns text or data, reads no file, calls no network and runs no git, so
// `tests/lib.test.mjs` can hold every rule to a fixture.
//
// Every anchor below THROWS unless it matched exactly once. A rewrite that
// matched nothing and a rewrite that worked look identical from outside — the
// file is still valid TOML, the tag still gets pushed — and the release that
// follows asserts the tag against a version nobody wrote.

/** The reusable workflow every caller here pins, by 40-hex commit. */
export const RELEASE_WORKFLOW = "mihailinl/AstraPlugins/.github/workflows/plugin-release.yml";

/**
 * ID-23 (contract §2.3), verbatim — the same source string astra-registry's
 * `bot/lib/binding.mjs` exports as `ID_23_SOURCE`. The canary commits a line
 * this grammar accepts, and checks it here before pushing, because a canary
 * whose binding line the registry would not even parse tests nothing (BOT-88).
 */
export const ID_23_SOURCE = "^[ \\t]*astra-binding:[ \\t]*([A-Za-z0-9_-]{16,128})[ \\t]*(#.*)?$";

/**
 * The token on the canary's binding line. It has ID-23's shape and was never
 * minted: BOT-88 checks the binding line's GRAMMAR only ("the canary asks no
 * verdict, so it needs no service-minted token and no Minice account"), so a
 * real token here would be a credential in a public file for no purpose.
 */
export const CANARY_BINDING_TOKEN = "bot88-canary-grammar-only-never-minted";

/** ID-23's window: a line counts only if it lies wholly within the first 4096 bytes. */
export const WINDOW_BYTES = 4096;

/** A canary tag: `<prefix>0.<YYYYMMDD>.<n>`, n from 1, no leading zero. */
export function canaryTagPattern(prefix) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(prefix)) throw new Error(`not a usable tag prefix: ${JSON.stringify(prefix)}`);
  const p = prefix.replace(/[.]/g, "\\.");
  return new RegExp(`^${p}0\\.([0-9]{8})\\.([1-9][0-9]*)$`);
}

/**
 * The plugin of MOD-16's staging listing (registry plan M-T2.1, M-T2.2), whose
 * caller is the one caller here the weekly canary never tags.
 *
 * Its id is registry `policy/reserved-ids.json`'s `staging_listing_id`, which
 * the registry derives `unlisted` from its first listing. It is released only
 * when a person walks a withdrawal, and its tag is that person's act: a weekly
 * tag of it would be a weekly submission of a listing nobody asked for. Its pin
 * may equal a canary caller's — the staging release should go through a commit
 * the canary proves every week — so the one-caller-per-commit rule does not
 * apply to it. Every other rule does: it is a caller, and a movable pin, a
 * drifted glob or a de-allowlisted commit is as much a defect in it.
 */
export const STAGING_PLUGIN_DIR = "plugins/astra-withdrawal-canary";

/**
 * Callers of the release workflow, read from workflow files as text: the
 * canary callers, and the staging caller if there is one.
 *
 * A caller is a file with exactly one `uses: <RELEASE_WORKFLOW>@<sha>` line.
 * From it this reads the pin, `plugin-dir`, `tag-prefix` and the `tags:` glob,
 * each exactly once, and refuses a caller whose glob is not `<prefix>*`: the
 * two must stay in step or a pushed tag starts nothing (the reusable
 * workflow's own `tag-prefix` description says why).
 *
 * The staging caller is the one whose `plugin-dir` is `STAGING_PLUGIN_DIR`,
 * and there is at most one. No two callers share a tag prefix or a plugin
 * directory; no two CANARY callers share a pin.
 *
 * @param {{path: string, text: string}[]} files
 * @returns {{canaries: {path: string, sha: string, pluginDir: string, prefix: string}[],
 *            staging: {path: string, sha: string, pluginDir: string, prefix: string} | null}}
 */
export function readAllCallers(files) {
  const out = [];
  for (const { path, text } of files) {
    const calls = [...text.matchAll(/^\s*uses:\s*(\S+)/gm)].map((m) => m[1]).filter((u) => u.includes("plugin-release.yml"));
    if (calls.length === 0) continue;
    // A file that calls the release workflow any other way — twice, from a
    // fork, or by a movable ref — is a caller someone broke, not a file that
    // is none of this script's business.
    const pin = /^(.+)@([0-9a-f]{40})$/.exec(calls[0]);
    if (calls.length !== 1 || !pin || pin[1] !== RELEASE_WORKFLOW) {
      throw new Error(`${path}: calls plugin-release.yml as ${JSON.stringify(calls)}; a caller has exactly one \`uses: ${RELEASE_WORKFLOW}@<40-hex>\``);
    }
    const uses = [[null, null, pin[2]]];
    const one = (re, what) => {
      const m = [...text.matchAll(re)];
      if (m.length !== 1) throw new Error(`${path}: ${what} matched ${m.length} times; a caller has exactly one`);
      return m[0][1];
    };
    const pluginDir = one(/^\s*plugin-dir:\s*"?([^"\s#]+)"?\s*(?:#.*)?$/gm, "`plugin-dir:`");
    const prefix = one(/^\s*tag-prefix:\s*"([^"]+)"\s*(?:#.*)?$/gm, "`tag-prefix:`");
    const globs = one(/^\s*tags:\s*\[([^\]]*)\]\s*(?:#.*)?$/gm, "`tags: [...]`")
      .split(",").map((g) => g.trim().replace(/^"(.*)"$/, "$1")).filter(Boolean);
    if (globs.length !== 1 || globs[0] !== `${prefix}*`) {
      throw new Error(`${path}: tags ${JSON.stringify(globs)} is not exactly ["${prefix}*"], so a tag this repository pushes as ${prefix}<version> would not start it — or would start it on another caller's tag`);
    }
    canaryTagPattern(prefix); // throws on an unusable prefix
    out.push({ path, sha: uses[0][2], pluginDir, prefix });
  }
  const staged = out.filter((c) => c.pluginDir === STAGING_PLUGIN_DIR);
  if (staged.length > 1) {
    throw new Error(`${staged.map((c) => c.path).join(" and ")} are both callers for the staging plugin ${STAGING_PLUGIN_DIR}; there is one staging listing and one caller releases it`);
  }
  const seen = new Map();
  for (const c of out) {
    const staging = c.pluginDir === STAGING_PLUGIN_DIR;
    for (const [k, v] of [["sha", c.sha], ["prefix", c.prefix], ["pluginDir", c.pluginDir]]) {
      // The staging caller's pin may be a canary's: it is never tagged here,
      // so it takes no commit's weekly slot. Its prefix and directory are its
      // own like anybody's.
      if (staging && k === "sha") continue;
      const key = `${k}:${v}`;
      if (seen.has(key)) throw new Error(`${c.path} and ${seen.get(key)} share ${k} ${v}; each allowlisted commit gets its own caller, plugin and tag namespace`);
      seen.set(key, c.path);
    }
  }
  const byPath = (a, b) => a.path.localeCompare(b.path);
  return { canaries: out.filter((c) => c.pluginDir !== STAGING_PLUGIN_DIR).sort(byPath), staging: staged[0] ?? null };
}

/**
 * The canary callers alone: the ones the weekly job tags and prunes. The
 * staging caller is never among them (see `STAGING_PLUGIN_DIR`).
 *
 * @param {{path: string, text: string}[]} files
 * @returns {{path: string, sha: string, pluginDir: string, prefix: string}[]}
 */
export function readCallers(files) {
  return readAllCallers(files).canaries;
}

/**
 * The canary callers against trust.json's allowlist, both directions, and the
 * staging caller's pin against it too. The staging caller is never returned in
 * `tag`.
 *
 * @returns {{tag: object[], problems: string[]}} the callers to tag, and why the run is red
 */
export function compareAllowlist(callers, allowlisted, { staging = null } = {}) {
  const problems = [];
  const allow = new Set(allowlisted);
  const pinned = new Set(callers.map((c) => c.sha));
  for (const sha of allowlisted) {
    if (!pinned.has(sha)) {
      problems.push(`trust.json allowlists ${sha} and no caller here pins it, so nothing exercises that commit between releases (BOT-88: one caller per allowlisted SHA). Add one with \`astra-plugin init-ci --ref ${sha}\` in a new plugins/release-canary-${sha.slice(0, 7)}/.`);
    }
  }
  for (const c of callers) {
    if (!allow.has(c.sha)) {
      problems.push(`${c.path} pins ${c.sha}, which trust.json no longer allowlists; it was not tagged. Remove the caller and its plugin, or — for AP-20's candidate SHA — tag it by hand under that task's approval.`);
    }
  }
  if (staging && !allow.has(staging.sha)) {
    problems.push(`${staging.path} pins ${staging.sha}, which trust.json no longer allowlists, so the staging listing's next release through it would be refused by the registry. It is never tagged by this job; re-pin it with \`astra-plugin init-ci --ref <an allowlisted sha>\` before the next withdrawal walk.`);
  }
  return { tag: callers.filter((c) => allow.has(c.sha) && c.pluginDir !== STAGING_PLUGIN_DIR), problems };
}

/** `YYYYMMDD` of a Date, in UTC. */
export function utcDate(d) {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

/**
 * The next canary version: `0.<YYYYMMDD>.<n>`, n one past the highest n any
 * caller already used today, so every caller's tag carries the same version
 * and a second run on the same day never collides with the first.
 */
export function nextVersion(existingTags, prefixes, now) {
  const day = utcDate(now);
  let max = 0;
  for (const prefix of prefixes) {
    const re = canaryTagPattern(prefix);
    for (const t of existingTags) {
      const m = re.exec(t);
      if (m && m[1] === day) max = Math.max(max, Number(m[2]));
    }
  }
  return `0.${day}.${max + 1}`;
}

/**
 * Rewrite `version = "…"` inside one TOML table, exactly as `astra-plugin
 * version` does for `[plugin]` in plugin.toml and `[package]` in Cargo.toml —
 * and nothing else: the CLI leaves Cargo.lock alone and the release build
 * re-resolves it (it builds without `--locked`), so the canary does the same
 * and exercises exactly the author's path.
 */
export function setTableVersion(text, table, version, file = "file") {
  const lines = text.split("\n");
  const headers = lines.map((l, i) => [l.trim(), i]).filter(([l]) => /^\[[^\]]+\]$/.test(l));
  const at = headers.filter(([l]) => l === `[${table}]`);
  if (at.length !== 1) throw new Error(`${file}: [${table}] found ${at.length} times`);
  const start = at[0][1];
  const next = headers.find(([, i]) => i > start);
  const end = next ? next[1] : lines.length;
  const hits = [];
  for (let i = start + 1; i < end; i++) if (/^version\s*=\s*"[^"]*"\s*$/.test(lines[i])) hits.push(i);
  if (hits.length !== 1) throw new Error(`${file}: [${table}] has ${hits.length} \`version = "…"\` lines`);
  const before = lines[hits[0]];
  lines[hits[0]] = `version = "${version}"`;
  if (lines[hits[0]] === before) throw new Error(`${file}: [${table}] already says version ${version}; the rewrite would change nothing`);
  return lines.join("\n");
}

/**
 * The owner file with the canary's binding line appended, checked against
 * ID-23 and the 4096-byte window before anything is committed.
 */
export function withBindingLine(ownerText) {
  const grammar = new RegExp(ID_23_SOURCE);
  const splitLines = (t) => t.split("\n").map((l) => l.replace(/\r$/, ""));
  if (splitLines(ownerText).some((l) => grammar.test(l))) {
    throw new Error(".well-known/astra-plugin-owner already carries a binding line on this commit; the canary adds its own and main must not have one");
  }
  const body = ownerText.endsWith("\n") ? ownerText : `${ownerText}\n`;
  const line = `astra-binding: ${CANARY_BINDING_TOKEN}  # BOT-88 canary: grammar only, never minted`;
  const out = `${body}${line}\n`;
  const bytes = Buffer.from(out, "utf8");
  if (bytes.length > WINDOW_BYTES) throw new Error(`the owner file would be ${bytes.length} bytes and ID-23 reads only the first ${WINDOW_BYTES}`);
  const matches = splitLines(out).filter((l) => grammar.test(l));
  if (matches.length !== 1 || grammar.exec(matches[0])[1] !== CANARY_BINDING_TOKEN) {
    throw new Error(`ID-23 finds ${matches.length} binding line(s) in the file the canary would commit; it must find exactly the canary's`);
  }
  return out;
}

/**
 * Which canary tags to prune: all but the newest `keep` per prefix, ordered
 * by (date, n). Anything not matching the canary pattern exactly is never
 * returned — a tag this rule does not recognise is not the canary's to delete.
 */
export function tagsToPrune(existingTags, prefixes, keep) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error(`keep must be a positive integer, got ${keep}`);
  const out = [];
  for (const prefix of prefixes) {
    const re = canaryTagPattern(prefix);
    const mine = existingTags
      .map((t) => [t, re.exec(t)])
      .filter(([, m]) => m)
      .map(([t, m]) => ({ t, day: m[1], n: Number(m[2]) }))
      .sort((a, b) => (a.day === b.day ? b.n - a.n : b.day.localeCompare(a.day)));
    out.push(...mine.slice(keep).map((x) => x.t));
  }
  return out;
}

/**
 * A JWT's shape: three base64url segments, the first two JSON objects
 * (`eyJ` is base64 of `{"`). The token probe's log must never hold one.
 */
export const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;

/**
 * Lines of a log that hold a JWT-shaped string — by line number only. The
 * match itself is never returned, so a lint that finds a leaked token does
 * not print it a second time.
 */
export function jwtLines(text) {
  const hits = [];
  text.split("\n").forEach((l, i) => {
    JWT_SHAPE.lastIndex = 0;
    if (JWT_SHAPE.test(l)) hits.push(i + 1);
  });
  return hits;
}

/**
 * Lines the probe itself printed (`<time> probe.<name> …`) that the runner
 * masked (`***`).
 *
 * Why this exists: GitHub's runner masks a JWT-shaped string in a job's log
 * even when nobody registered it as a secret. Measured 2026-09-23: the probe's
 * fixture mode printed an unsigned fixture token nobody had registered, and
 * the stored log said `probe.fixture ***` (run 35851332156) — so the lint
 * B-T1.6 asked for, "its log holds no string matching the JWT shape", was
 * green on the very case it exists to catch, and would be green on every
 * leak. Masking is the runner's courtesy, not the probe's guarantee: the step
 * summary, an artifact or a differently-split string are not masked the same
 * way, and a probe that prints a token has a defect whether or not the log
 * hides it. Nothing the probe prints is a secret, so a mask on one of its own
 * lines means it printed something the runner took for one.
 */
export function maskedProbeLines(text) {
  const hits = [];
  text.split("\n").forEach((l, i) => {
    if (/^\S+Z probe\.[a-z0-9_.]+ .*\*\*\*/.test(l.replace(/^\uFEFF/, ""))) hits.push(i + 1);
  });
  return hits;
}
