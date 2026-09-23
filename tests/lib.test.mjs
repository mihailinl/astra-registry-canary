// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// node --test tests/
//
// The rules the canary's scripts run on, held to fixtures and to this
// repository's own files. Each rule is also asserted to REFUSE its broken
// case, because a rule that has never been seen refusing is a rule nobody
// knows is there.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CANARY_BINDING_TOKEN, ID_23_SOURCE, compareAllowlist, jwtLines, nextVersion, readCallers,
  setTableVersion, tagsToPrune, withBindingLine,
} from "../.github/scripts/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const workflows = () => fs.readdirSync(path.join(ROOT, ".github/workflows")).filter((n) => n.endsWith(".yml")).sort()
  .map((n) => ({ path: `.github/workflows/${n}`, text: read(`.github/workflows/${n}`) }));

const firstCaller = () => {
  const [c] = readCallers(workflows());
  return workflows().find((f) => f.path === c.path);
};

test("the callers here: one per plugin, each glob in step with its prefix, each plugin present", () => {
  const callers = readCallers(workflows());
  assert.ok(callers.length >= 2, `found ${callers.length} caller(s); trust.json allowlisted two on 2026-09-23`);
  for (const c of callers) {
    assert.match(c.pluginDir, /^plugins\/release-canary-[0-9a-f]{7}$/);
    assert.equal(c.pluginDir, `plugins/release-canary-${c.sha.slice(0, 7)}`, `${c.path}: the plugin is named for the commit it pins`);
    assert.equal(c.prefix, `release-canary-${c.sha.slice(0, 7)}-v`);
    const toml = read(`${c.pluginDir}/plugin.toml`);
    assert.match(toml, new RegExp(`^id = "release-canary-${c.sha.slice(0, 7)}"$`, "m"));
  }
});

test("a caller whose tags glob drifted from its prefix is refused", () => {
  const one = firstCaller();
  const bad = one.text.replace(/tags: \["([^"]+)\*"\]/, 'tags: ["$1x*"]');
  assert.notEqual(bad, one.text, "the mutation changed nothing");
  assert.throws(() => readCallers([{ path: one.path, text: bad }]), /is not exactly/);
});

test("a caller pinned by a movable ref is refused, not skipped", () => {
  const one = firstCaller();
  const bad = one.text.replace(/plugin-release\.yml@[0-9a-f]{40}/, "plugin-release.yml@plugin-release/v1");
  assert.notEqual(bad, one.text);
  assert.throws(() => readCallers([{ path: one.path, text: bad }]), /exactly one/);
});

test("the allowlist is compared both ways", () => {
  const callers = [{ path: "a.yml", sha: "a".repeat(40) }, { path: "b.yml", sha: "b".repeat(40) }];
  assert.deepEqual(compareAllowlist(callers, ["a".repeat(40), "b".repeat(40)]).problems, []);
  const missing = compareAllowlist(callers, ["a".repeat(40), "b".repeat(40), "c".repeat(40)]);
  assert.equal(missing.tag.length, 2);
  assert.match(missing.problems.join("\n"), /no caller here pins it/);
  const stale = compareAllowlist(callers, ["a".repeat(40)]);
  assert.deepEqual(stale.tag.map((c) => c.path), ["a.yml"]);
  assert.match(stale.problems.join("\n"), /no longer allowlists; it was not tagged/);
});

test("versions: one per day across every caller, n one past the highest", () => {
  const p = ["release-canary-aaaaaaa-v", "release-canary-bbbbbbb-v"];
  const now = new Date("2026-09-23T06:17:00Z");
  assert.equal(nextVersion([], p, now), "0.20260923.1");
  assert.equal(nextVersion(["release-canary-aaaaaaa-v0.20260923.1", "release-canary-bbbbbbb-v0.20260923.3",
    "release-canary-aaaaaaa-v0.20260922.9", "author-token-probe-1"], p, now), "0.20260923.4");
});

test("the version rewrite touches exactly one line in the named table, and refuses a no-op", () => {
  for (const c of readCallers(workflows())) {
    const toml = read(`${c.pluginDir}/plugin.toml`);
    const next = setTableVersion(toml, "plugin", "0.20260923.1", "plugin.toml");
    const changed = toml.split("\n").filter((l, i) => l !== next.split("\n")[i]);
    assert.deepEqual(changed.length, 1);
    assert.match(next, /^\[plugin\][^[]*^version = "0\.20260923\.1"$/ms);
    assert.throws(() => setTableVersion(next, "plugin", "0.20260923.1", "plugin.toml"), /would change nothing/);
    const cargo = read(`${c.pluginDir}/Cargo.toml`);
    assert.match(setTableVersion(cargo, "package", "0.20260923.1", "Cargo.toml"), /^version = "0\.20260923\.1"$/m);
    assert.throws(() => setTableVersion(cargo, "plugin", "1.0.0", "Cargo.toml"), /found 0 times/);
  }
});

test("main's owner file lists an owner and carries NO binding line; the canary's line is ID-23 grammar", () => {
  const owner = read(".well-known/astra-plugin-owner");
  const grammar = new RegExp(ID_23_SOURCE);
  assert.ok(!owner.split("\n").some((l) => grammar.test(l)), "a binding line on main would reach M-T2.2's staging release");
  assert.match(owner, /^mihailinl\s*(#.*)?$/m);
  const withLine = withBindingLine(owner);
  const lines = withLine.split("\n").filter((l) => grammar.test(l));
  assert.equal(lines.length, 1);
  assert.equal(grammar.exec(lines[0])[1], CANARY_BINDING_TOKEN);
  assert.throws(() => withBindingLine(withLine), /already carries a binding line/);
});

test("pruning keeps the newest per prefix and never touches a tag it does not recognise", () => {
  const p = ["release-canary-aaaaaaa-v"];
  const tags = ["release-canary-aaaaaaa-v0.20260901.1", "release-canary-aaaaaaa-v0.20260908.1",
    "release-canary-aaaaaaa-v0.20260908.2", "release-canary-aaaaaaa-v0.20260915.1",
    "release-canary-aaaaaaa-v0.1.0", "author-token-probe-2026-09-23", "release-canary-aaaaaaa-v0.20260915.01"];
  assert.deepEqual(tagsToPrune(tags, p, 2).sort(), ["release-canary-aaaaaaa-v0.20260901.1", "release-canary-aaaaaaa-v0.20260908.1"]);
  assert.throws(() => tagsToPrune(tags, p, 0), /positive integer/);
});

test("the JWT lint finds a token by line and does not return it", () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ sub: "x", aud: "y" })}.c2lnbmF0dXJl`;
  const log = ["2026-09-23T10:00:00Z probe.claim_names aud,exp", `2026-09-23T10:00:01Z oops ${jwt}`, "done"].join("\n");
  assert.deepEqual(jwtLines(log), [2]);
  assert.deepEqual(jwtLines("probe.claim_names aud,exp,iat\nprobe.jti_sha256_16 0123456789abcdef"), []);
});
