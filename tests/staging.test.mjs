// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// node --test tests/*.test.mjs
//
// MOD-16's staging listing is released from this repository too (registry
// plan M-T2.2), through a caller of the same reusable workflow at an
// allowlisted commit — so, to every rule in `lib.mjs`, it looks exactly like a
// canary caller. It is not one. The weekly job must never tag it: a weekly
// release of the staging plugin is a weekly submission of a listing the
// registry publishes only when a person walks a withdrawal, and its pin is
// allowed to share a commit with a canary caller, which the one-caller-per-
// commit rule would otherwise refuse and take the whole weekly canary down with
// it. It is still a caller: a movable pin, a drifted glob or a de-allowlisted
// commit is a defect in it, and is reported as one.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  STAGING_PLUGIN_DIR, compareAllowlist, readAllCallers, readCallers,
} from "../.github/scripts/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const workflows = () => fs.readdirSync(path.join(ROOT, ".github/workflows")).filter((n) => n.endsWith(".yml")).sort()
  .map((n) => ({ path: `.github/workflows/${n}`, text: read(`.github/workflows/${n}`) }));

const STAGING_FILE = ".github/workflows/release-astra-withdrawal-canary.yml";
const stagingText = () => read(STAGING_FILE);

test("this tree's staging caller is read as the staging caller and never as a canary", () => {
  const { canaries, staging } = readAllCallers(workflows());
  assert.ok(staging, `no caller with plugin-dir ${STAGING_PLUGIN_DIR} was found`);
  assert.equal(staging.path, STAGING_FILE);
  assert.equal(staging.pluginDir, "plugins/astra-withdrawal-canary");
  assert.equal(staging.prefix, "astra-withdrawal-canary-v", "the tag namespace is the id's, so `<id>-v<version>`");
  assert.match(read(`${staging.pluginDir}/plugin.toml`), /^id = "astra-withdrawal-canary"$/m,
    "the staging plugin's id is registry policy/reserved-ids.json's staging_listing_id");
  assert.ok(canaries.length >= 2, `${canaries.length} canary caller(s)`);
  assert.ok(canaries.every((c) => c.pluginDir !== STAGING_PLUGIN_DIR), "the staging caller is among the canaries");
  assert.deepEqual(readCallers(workflows()).map((c) => c.path), canaries.map((c) => c.path),
    "readCallers — what prune.mjs reads its prefixes from — is the canary set and nothing else");
});

test("this tree's staging caller pins a commit a canary caller exercises every week", () => {
  // Offline, so trust.json is not read here; canary-tag.mjs compares the
  // staging pin with it on every run. What can be asked from the tree is that
  // the staging release goes through a commit the weekly canary proves builds.
  const { canaries, staging } = readAllCallers(workflows());
  assert.ok(canaries.some((c) => c.sha === staging.sha),
    `the staging caller pins ${staging.sha}, which no canary caller here pins`);
});

test("the staging caller may share its pin with a canary, and is never in the set tagged", () => {
  const { canaries, staging } = readAllCallers(workflows());
  const allowlisted = [...new Set(canaries.map((c) => c.sha))];
  const { tag, problems } = compareAllowlist(canaries, allowlisted, { staging });
  assert.deepEqual(problems, []);
  assert.deepEqual(tag.map((c) => c.path).sort(), canaries.map((c) => c.path).sort());
  assert.ok(!tag.some((c) => c.pluginDir === STAGING_PLUGIN_DIR), "the weekly job would tag the staging plugin");
});

test("a staging caller pinned to a commit trust.json no longer allowlists is reported, and still not tagged", () => {
  const { canaries, staging } = readAllCallers(workflows());
  const allowlisted = canaries.map((c) => c.sha).filter((s) => s !== staging.sha);
  const { tag, problems } = compareAllowlist(canaries.filter((c) => c.sha !== staging.sha), allowlisted, { staging });
  assert.ok(!tag.some((c) => c.pluginDir === STAGING_PLUGIN_DIR));
  assert.equal(problems.length, 1, JSON.stringify(problems));
  assert.match(problems[0], new RegExp(`${STAGING_FILE.replaceAll(".", "\\.")} pins ${staging.sha}`));
  assert.match(problems[0], /staging listing/);
});

test("a second staging caller is refused", () => {
  const text = stagingText();
  assert.throws(() => readAllCallers([
    { path: STAGING_FILE, text },
    { path: ".github/workflows/release-astra-withdrawal-canary-2.yml", text },
  ]), /staging/);
});

test("the staging caller's shape is held to the same rules as a canary's", () => {
  const text = stagingText();
  const movable = text.replace(/plugin-release\.yml@[0-9a-f]{40}/, "plugin-release.yml@plugin-release/v1");
  assert.notEqual(movable, text, "the mutation changed nothing");
  assert.throws(() => readAllCallers([{ path: STAGING_FILE, text: movable }]), /exactly one/);
  const drifted = text.replace(/tags: \["([^"]+)\*"\]/, 'tags: ["$1x*"]');
  assert.notEqual(drifted, text, "the mutation changed nothing");
  assert.throws(() => readAllCallers([{ path: STAGING_FILE, text: drifted }]), /is not exactly/);
});

test("a canary caller may not take the staging caller's tag namespace", () => {
  const canary = workflows().find((f) => f.path.includes("release-release-canary-"));
  const squatting = canary.text.replaceAll(/release-canary-[0-9a-f]{7}-v/g, "astra-withdrawal-canary-v");
  assert.notEqual(squatting, canary.text, "the mutation changed nothing");
  assert.throws(() => readAllCallers([{ path: STAGING_FILE, text: stagingText() }, { path: canary.path, text: squatting }]),
    /share prefix/);
});

test("handed the staging caller among the callers, compareAllowlist still does not tag it", () => {
  // canary-tag.mjs passes the canaries and the staging caller separately; this
  // is the rule for a caller that does not, so the staging plugin's weekly tag
  // does not depend on every reader remembering to split the set first.
  const { canaries, staging } = readAllCallers(workflows());
  const allowlisted = [...new Set(canaries.map((c) => c.sha))];
  const { tag } = compareAllowlist([...canaries, staging], allowlisted);
  assert.ok(!tag.some((c) => c.pluginDir === STAGING_PLUGIN_DIR), "the staging caller was returned to tag");
  assert.equal(tag.length, canaries.length);
});
