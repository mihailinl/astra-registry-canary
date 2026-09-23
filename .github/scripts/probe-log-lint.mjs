#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// B-T1.6's lint over the author-token probe: no line of the probe job's log
// holds a JWT's shape.
//
//     RUN_ID=<id> RUN_ATTEMPT=<n> GH_TOKEN=… node .github/scripts/probe-log-lint.mjs
//
// It reads every job of that run attempt, and it is red — never green — when
// it could not read one: an unread log and a clean log would otherwise be the
// same colour. It is vacuous unless the log is the probe's, so it also
// requires the line the probe always prints (`probe.claim_names` for a
// measurement, `probe.fixture` for the watch). A hit is reported by job and
// line number only: a lint that found a leaked token must not print it again.

import { jwtLines } from "./lib.mjs";

const { GITHUB_API_URL: API, GITHUB_REPOSITORY: REPO, RUN_ID, RUN_ATTEMPT, GH_TOKEN } = process.env;
for (const [k, v] of Object.entries({ GITHUB_API_URL: API, GITHUB_REPOSITORY: REPO, RUN_ID, RUN_ATTEMPT, GH_TOKEN })) {
  if (!v) throw new Error(`${k} is not set`);
}
const headers = { authorization: `Bearer ${GH_TOKEN}`, accept: "application/vnd.github+json" };
const get = async (url, kind) => {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return kind === "json" ? res.json() : res.text();
};

const jobs = (await get(`${API}/repos/${REPO}/actions/runs/${RUN_ID}/attempts/${RUN_ATTEMPT}/jobs?per_page=100`, "json")).jobs || [];
if (jobs.length === 0) throw new Error(`run ${RUN_ID} attempt ${RUN_ATTEMPT} has no jobs to read`);
let red = 0;
let marker = false;
for (const job of jobs) {
  const log = await get(`${API}/repos/${REPO}/actions/jobs/${job.id}/logs`, "text");
  if (/ probe\.(claim_names|fixture) /.test(log)) marker = true;
  const hits = jwtLines(log);
  console.log(`job ${JSON.stringify(job.name)} (${job.id}): ${log.split("\n").length} lines read, ${hits.length} with a JWT's shape`);
  if (hits.length) {
    red++;
    console.log(`::error::job ${JSON.stringify(job.name)} of run ${RUN_ID} attempt ${RUN_ATTEMPT} printed a JWT-shaped string on log line(s) ${hits.join(", ")}. The probe must never print a token.`);
  }
}
if (!marker) {
  console.log(`::error::no job of run ${RUN_ID} attempt ${RUN_ATTEMPT} printed probe.claim_names or probe.fixture, so this lint read a log that is not the probe's and proves nothing`);
  red++;
}
process.exitCode = red ? 1 : 0;
