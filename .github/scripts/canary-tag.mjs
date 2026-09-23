#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// BOT-88's weekly canary tag (astra-registry plan B-T1.6).
//
//     node .github/scripts/canary-tag.mjs             # commit, tag, push
//     node .github/scripts/canary-tag.mjs --dry-run   # everything but the commit and the push
//
// For every caller of AstraPlugins' plugin-release.yml in .github/workflows/
// whose pin trust.json still allowlists, this pushes one tag, the way an
// author releases: `astra-plugin version <v>` (plugin.toml and Cargo.toml,
// nothing else), a commit, a lightweight tag, a push. The release that tag
// starts is the thing astra-registry's release-canary verifies.
//
// ── what is committed, and where ───────────────────────────────────────────
//
// One commit on top of main, carrying the version bump of every canary plugin
// and the canary's binding line (ID-23), reachable ONLY from the tags. main
// never moves, so it never carries a binding line — which matters from R2,
// when this repository's staging listing (M-T2.2) is released from main and a
// line there would send that release to the plugins service for a verdict on
// a token nobody minted. The binding line is read at the attested commit
// (ID-22), so the canary's line reaches the canary's releases and nothing else.
//
// ── why each tag is pushed alone ───────────────────────────────────────────
//
// GitHub creates no push event for tags when more than three are pushed at
// once. Two callers today fit under that; the renewal ceremony adds a third
// allowlisted commit, and the day a fourth caller arrived, one `git push
// --tags` would start nothing at all — silently, with every tag on the remote.
//
// ── why this credential ────────────────────────────────────────────────────
//
// A push made with GITHUB_TOKEN starts no workflow run (BOT-50), so the tag
// is pushed over SSH with this repository's write deploy key, which the job
// checks out with. It is scoped to this repository's contents and nothing
// else, and it lives in environment `canary-tag`, which admits only main.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  compareAllowlist, nextVersion, readCallers, setTableVersion, withBindingLine,
} from "./lib.mjs";

const TRUST_URL = "https://raw.githubusercontent.com/mihailinl/astra-registry/main/registry/v1/trust.json";
const OWNER_FILE = ".well-known/astra-plugin-owner";
const DRY = process.argv.includes("--dry-run");
const ROOT = process.cwd();

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function out(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
function summary(line) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

async function allowlist() {
  let res;
  try {
    res = await fetch(TRUST_URL, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "astra-registry-canary" } });
  } catch (e) {
    throw new Error(`trust.json could not be read from ${TRUST_URL}: ${e.message}. Without the allowlist there is no telling which callers to tag.`);
  }
  if (!res.ok) throw new Error(`trust.json: HTTP ${res.status} from ${TRUST_URL}`);
  const doc = JSON.parse(await res.text());
  const shas = doc?.signed?.reusable_workflow_shas;
  if (!Array.isArray(shas) || shas.length === 0 || !shas.every((s) => typeof s === "string" && /^[0-9a-f]{40}$/.test(s))) {
    throw new Error("trust.json's signed.reusable_workflow_shas is not a non-empty list of 40-hex commits");
  }
  return shas;
}

async function main() {
  const wfDir = path.join(ROOT, ".github", "workflows");
  const files = fs.readdirSync(wfDir).filter((n) => /\.ya?ml$/.test(n)).sort()
    .map((n) => ({ path: `.github/workflows/${n}`, text: fs.readFileSync(path.join(wfDir, n), "utf8") }));
  const callers = readCallers(files);
  const shas = await allowlist();
  const { tag, problems } = compareAllowlist(callers, shas);

  console.log(`trust.json allowlists ${shas.length}: ${shas.join(" ")}`);
  for (const c of callers) console.log(`caller  ${c.path}  @${c.sha.slice(0, 12)}  ${c.pluginDir}  ${c.prefix}<version>`);
  if (tag.length === 0) throw new Error(`no caller here pins an allowlisted commit, so there is nothing to tag.\n${problems.join("\n")}`);

  const existing = git("ls-remote", "--tags", "origin").split("\n").filter(Boolean)
    .map((l) => l.split("\t")[1]).filter((r) => r && r.startsWith("refs/tags/"))
    .map((r) => r.slice("refs/tags/".length).replace(/\^\{\}$/, ""));
  const version = nextVersion(existing, callers.map((c) => c.prefix), new Date());
  const tags = tag.map((c) => `${c.prefix}${version}`);
  for (const t of tags) if (existing.includes(t)) throw new Error(`tag ${t} already exists on the remote; refusing to move a tag`);
  console.log(`version ${version}`);

  const touched = [];
  for (const c of tag) {
    for (const [file, table] of [["plugin.toml", "plugin"], ["Cargo.toml", "package"]]) {
      const p = path.join(c.pluginDir, file);
      const before = fs.readFileSync(path.join(ROOT, p), "utf8");
      fs.writeFileSync(path.join(ROOT, p), setTableVersion(before, table, version, p));
      touched.push(p);
    }
  }
  const owner = fs.readFileSync(path.join(ROOT, OWNER_FILE), "utf8");
  fs.writeFileSync(path.join(ROOT, OWNER_FILE), withBindingLine(owner));
  touched.push(OWNER_FILE);

  git("add", "--", ...touched);
  const staged = git("diff", "--cached", "--name-only").split("\n").filter(Boolean).sort();
  const want = [...new Set(touched)].sort();
  if (JSON.stringify(staged) !== JSON.stringify(want)) {
    throw new Error(`staged ${JSON.stringify(staged)}, and the canary writes exactly ${JSON.stringify(want)}`);
  }

  const run = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "(local)";
  if (DRY) {
    console.log(`DRY RUN: would commit ${want.join(", ")} and push ${tags.join(" ")}`);
    git("reset", "--hard", "--quiet", "HEAD");
  } else {
    const msg = [
      `canary ${version}: BOT-88's weekly release through each allowlisted commit`,
      "",
      `Tags: ${tags.join(" ")}`,
      `Run: ${run}`,
      "",
      "Reachable only from those tags; main does not move. The binding line is",
      "ID-23 grammar with a token nobody minted (BOT-88 checks grammar only).",
    ].join("\n");
    git("-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
      "commit", "--quiet", "-m", msg);
    const commit = git("rev-parse", "HEAD");
    for (const t of tags) {
      git("tag", t, commit);
      git("push", "--quiet", "origin", `refs/tags/${t}`);
      const remote = git("ls-remote", "origin", `refs/tags/${t}`).split("\t")[0];
      if (remote !== commit) throw new Error(`pushed ${t} and the remote says it points at ${remote || "nothing"}, not ${commit}`);
      console.log(`pushed  ${t} -> ${commit}`);
    }
    out("commit", commit);
    summary(`Canary ${version} on \`${commit}\`:`);
  }
  out("version", version);
  out("tags", tags.join(" "));
  for (const t of tags) summary(`- \`${t}\``);

  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    summary(`\n**Red:**\n${problems.map((p) => `- ${p}`).join("\n")}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`::error::${e.message}`);
  process.exitCode = 1;
});
