#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// BOT-85's heartbeat for receiver check `canary-tag`: one POST to the WHOLE
// ping URL that check's own secret carries, ASTRA_DEADMAN_URL_CANARY_TAG, in
// environment `canary-tag`. The name is astra-registry's `secretName("canary-tag")`
// (bot/lib/alert-checks.mjs), whose row for this check says its secret is
// stored here, under that name, and never in the registry's `alerts`.
//
// This file composes no URL and holds no base: a base plus a check name is a
// project-level ping key, and whoever held it could silence every other check
// on the receiver (attack M-5). It cannot reuse the registry's
// bot/heartbeat.mjs, which refuses — correctly — to post for a check another
// party owns.
//
// ── absent is not a failure; everything else is ───────────────────────────
//
// The receiver creates `canary-tag` DISARMED: it arms at its first post
// (alert-checks.mjs, the block above CHECKS). So before the URL is placed,
// posting nothing loses nothing — and a red run every week until then would
// teach whoever reads this repository that red here means "not set up yet".
// The absence is a warning on the run instead. Once the URL has been posted
// to even once the check is armed, and from then on a secret that disappears
// is a silence the receiver pages on, which is the guard.
//
// Present and failing — unreachable, not https, a non-2xx answer — fails the
// step, so silence at the receiver and red in the run agree.

const NAME = "ASTRA_DEADMAN_URL_CANARY_TAG";
const url = process.env[NAME];

if (typeof url !== "string" || url.trim() === "") {
  console.log(`::warning::${NAME} is not set in environment canary-tag, so no heartbeat was posted. Receiver check canary-tag is created disarmed and arms at its first post; until the URL is placed it neither pages nor hears from this run.`);
  process.exit(0);
}
if (!url.startsWith("https://")) {
  console.error(`::error::${NAME} is not an https URL; a ping sent in clear is one anybody on the path can forge`);
  process.exit(1);
}
const run = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : "";
try {
  const res = await fetch(url.trim(), {
    method: "POST",
    headers: { "content-type": "text/plain", "user-agent": "astra-registry-canary-heartbeat" },
    body: run,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error(`::error::the receiver answered HTTP ${res.status} for check canary-tag`);
    process.exit(1);
  }
} catch (e) {
  console.error(`::error::the receiver could not be reached for check canary-tag: ${e.message}`);
  process.exit(1);
}
console.log("ok    success posted for receiver check canary-tag");
