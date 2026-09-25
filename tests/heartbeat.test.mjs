// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// node --test tests/*.test.mjs
//
// `.github/scripts/heartbeat.mjs`, run as canary-tag.yml runs it, against a
// receiver that is a preloaded `fetch`. healthchecks.io answers a UUID ping
// URL with 200 whatever it did with the ping: `OK` when a check took it,
// `OK (not found)` when no check has that UUID, `OK (rate limited)` when it
// dropped it (its pinging API page, read 2026-09-25; `OK (not found)` measured
// on a random UUID the same day). So a
// secret left holding the URL of a deleted or re-created check was a green
// step until this test: the heartbeat counted any 2xx.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, ".github/scripts/heartbeat.mjs");
const URL_SECRET = "https://hc-ping.com/00000000-0000-4000-8000-00000000c0de";

/** Runs the script with the receiver answering 200 and `body`. */
function beat(body, env = { ASTRA_DEADMAN_URL_CANARY_TAG: URL_SECRET }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "canary-heartbeat-"));
  try {
    const preload = path.join(dir, "receiver.mjs");
    fs.writeFileSync(preload,
      "globalThis.fetch = async (url, init = {}) => {\n" +
      "  process.stdout.write(`receiver ${init.method ?? \"GET\"} ${url}\\n`);\n" +
      `  return { ok: true, status: 200, text: async () => ${JSON.stringify(body)} };\n` +
      "};\n");
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, SCRIPT], {
      encoding: "utf8", env: { PATH: process.env.PATH, ...env },
    });
    return { status: r.status, out: r.stdout, err: r.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("a ping the receiver took, `OK`, is a heartbeat", () => {
  for (const body of ["OK", "OK\n"]) {
    const r = beat(body);
    assert.equal(r.status, 0, `${JSON.stringify(body)}: ${r.err}`);
    assert.match(r.out, new RegExp(`^receiver POST ${URL_SECRET}$`, "m"));
    assert.match(r.out, /ok    success posted for receiver check canary-tag/);
  }
});

test("a 200 whose body is not `OK` fails the step, quotes the answer and never prints the URL", () => {
  for (const body of ["OK (not found)", "OK (rate limited)", "", "OKAY"]) {
    const r = beat(body);
    assert.match(r.out, /^receiver POST /m, `${JSON.stringify(body)}: the ping was never sent`);
    assert.equal(r.status, 1, `a 200 ${JSON.stringify(body)} was counted as a heartbeat`);
    assert.ok(r.err.includes(JSON.stringify(body)), `the failure does not quote ${JSON.stringify(body)}: ${r.err}`);
    assert.ok(!r.err.includes("hc-ping.com/"), "the failure printed the ping URL");
  }
});

test("an unset secret is still a warning and posts nothing", () => {
  const r = beat("OK", {});
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.out, /^receiver /m);
  assert.match(r.out, /::warning::ASTRA_DEADMAN_URL_CANARY_TAG is not set/);
});
