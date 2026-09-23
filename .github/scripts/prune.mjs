#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// Keeps the newest KEEP canary releases per caller and deletes the rest, each
// Release with its tag.
//
//     node .github/scripts/prune.mjs [--dry-run]      # needs GH_TOKEN with contents: write
//
// Why keep any. astra-registry's release-canary reads the NEWEST release per
// allowlisted commit; the older ones are how a reader finds the last week a
// commit still built, which is the first question after a red canary. Eight
// weeks answers it. Why delete the rest: a weekly tag per commit is over a
// hundred Releases a year of identical test bundles, and a Releases page that
// long is one nobody reads.
//
// Only a tag that matches a caller's canary pattern EXACTLY —
// `<prefix>0.<YYYYMMDD>.<n>` — is ever deleted. The probe's tags, the staging
// listing's tags and anything a person pushed by hand are not this script's.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { readCallers, tagsToPrune } from "./lib.mjs";

const KEEP = 8;
const DRY = process.argv.includes("--dry-run");
const REPO = process.env.GITHUB_REPOSITORY;
if (!REPO) throw new Error("GITHUB_REPOSITORY is not set");

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const wfDir = path.join(process.cwd(), ".github", "workflows");
const files = fs.readdirSync(wfDir).filter((n) => /\.ya?ml$/.test(n)).sort()
  .map((n) => ({ path: `.github/workflows/${n}`, text: fs.readFileSync(path.join(wfDir, n), "utf8") }));
const prefixes = readCallers(files).map((c) => c.prefix);

const refs = JSON.parse(gh("api", "--paginate", "--slurp", `repos/${REPO}/git/matching-refs/tags/`)).flat();
const tags = refs.map((r) => r.ref.slice("refs/tags/".length));
const prune = tagsToPrune(tags, prefixes, KEEP);
console.log(`${tags.length} tag(s); ${prefixes.length} caller prefix(es); keeping ${KEEP} per prefix; pruning ${prune.length}`);

let failed = 0;
for (const t of prune) {
  if (DRY) { console.log(`would delete ${t}`); continue; }
  try {
    let hasRelease = true;
    try { gh("release", "view", t, "--repo", REPO, "--json", "tagName"); } catch { hasRelease = false; }
    if (hasRelease) gh("release", "delete", t, "--repo", REPO, "--cleanup-tag", "--yes");
    else gh("api", "-X", "DELETE", `repos/${REPO}/git/refs/tags/${t}`);
    console.log(`deleted ${t}${hasRelease ? " and its Release" : " (no Release)"}`);
  } catch (e) {
    failed++;
    console.error(`::error::could not delete ${t}: ${String(e.stderr || e.message).trim().slice(0, 300)}`);
  }
}
if (failed) process.exitCode = 1;
