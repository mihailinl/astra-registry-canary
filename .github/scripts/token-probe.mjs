#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Minice
//
// OPEN-MBE-2's measurement (astra-registry plan B-T1.6; contract §10.2): what
// GitHub puts in an OIDC token minted under the AUTHOR audience, in a
// workflow that is not reusable — which is what an author's release run is.
//
// It prints the claim names and types, `exp` − `iat`, the `nbf` offset,
// `job_workflow_ref`, `run_id` and `run_attempt`, and on a re-run whether
// `jti` changed. It NEVER prints the token, never writes it to a file, an
// output or the environment, and sends it nowhere: the one request here is to
// GitHub's own token endpoint, and the token is dropped once decoded. Every
// line is checked for a JWT's shape before it is printed, and
// probe-log-lint.yml then reads this job's whole log for one.
//
// `--fixture` prints a fixture JWT and mints nothing. It exists to watch the
// lint go red (B-T1.6's canary: "watched by printing a fixture token").

import crypto from "node:crypto";
import fs from "node:fs";

import { JWT_SHAPE } from "./lib.mjs";

const AUDIENCE = "https://api.minice.ai/plugins/v1/author"; // ID-32
const JTI_LINE = /^probe\.jti_sha256_16 ([0-9a-f]{16})$/m;

const lines = [];
function say(line) {
  JWT_SHAPE.lastIndex = 0;
  if (JWT_SHAPE.test(line)) throw new Error("refusing to print a line with a JWT's shape");
  console.log(line);
  lines.push(line);
}

if (process.argv.includes("--fixture")) {
  // Not a token: an unsigned header and a payload of {"fixture":true}. It
  // exists to be found.
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  console.log(`probe.fixture ${b64({ alg: "none", typ: "JWT" })}.${b64({ fixture: true, note: "not a token" })}.`);
  process.exit(0);
}

const { ACTIONS_ID_TOKEN_REQUEST_URL: reqUrl, ACTIONS_ID_TOKEN_REQUEST_TOKEN: reqToken } = process.env;
if (!reqUrl || !reqToken) throw new Error("no OIDC request URL in this job: it needs `permissions: id-token: write`");
const u = new URL(reqUrl);
u.searchParams.set("audience", AUDIENCE);
const res = await fetch(u, { headers: { authorization: `bearer ${reqToken}`, accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
if (!res.ok) throw new Error(`GitHub's token endpoint answered HTTP ${res.status}`);
let header;
let claims;
{
  const token = (await res.json()).value;
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) throw new Error("the token endpoint did not return a three-part JWT");
  header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

const type = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
say(`probe.measured_at ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`);
say(`probe.audience_requested ${AUDIENCE}`);
say(`probe.aud_matches ${claims.aud === AUDIENCE || (Array.isArray(claims.aud) && claims.aud.includes(AUDIENCE))}`);
say(`probe.header_members ${Object.keys(header).sort().join(",")}`);
say(`probe.header_alg ${header.alg}`);
say(`probe.claim_names ${Object.keys(claims).sort().join(",")}`);
say(`probe.claim_types ${Object.keys(claims).sort().map((k) => `${k}:${type(claims[k])}`).join(",")}`);
say(`probe.exp_minus_iat_s ${claims.exp - claims.iat}`);
say(`probe.nbf_minus_iat_s ${"nbf" in claims ? claims.nbf - claims.iat : "absent"}`);
for (const k of ["repository_id", "repository_owner_id", "actor_id", "run_id", "run_attempt", "run_number"]) {
  say(`probe.id_type ${k} ${k in claims ? type(claims[k]) : "absent"}`);
}
say(`probe.run_id ${JSON.stringify(claims.run_id)}`);
say(`probe.run_attempt ${JSON.stringify(claims.run_attempt)}`);
say(`probe.job_workflow_ref ${claims.job_workflow_ref}`);
say(`probe.workflow_ref ${claims.workflow_ref}`);
say(`probe.event_name ${claims.event_name}`);
say(`probe.ref ${claims.ref}`);
const jtiHash = typeof claims.jti === "string" ? crypto.createHash("sha256").update(claims.jti).digest("hex").slice(0, 16) : "absent";
say(`probe.jti_sha256_16 ${jtiHash}`);

// On a re-run, the previous attempt's printed jti digest, from its own log.
const attempt = Number(process.env.GITHUB_RUN_ATTEMPT || "1");
if (attempt > 1) {
  const api = `${process.env.GITHUB_API_URL}/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const headers = { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json" };
  const jobs = await (await fetch(`${api}/attempts/${attempt - 1}/jobs`, { headers })).json();
  const job = (jobs.jobs || []).find((j) => j.name === process.env.PROBE_JOB_NAME);
  if (!job) {
    say(`probe.jti_changed_since_attempt_${attempt - 1} unknown (no job named ${process.env.PROBE_JOB_NAME} in that attempt)`);
  } else {
    const log = await (await fetch(`${process.env.GITHUB_API_URL}/repos/${process.env.GITHUB_REPOSITORY}/actions/jobs/${job.id}/logs`, { headers })).text();
    const m = JTI_LINE.exec(log.split("\n").map((l) => l.replace(/^\S+Z /, "")).join("\n"));
    say(`probe.jti_changed_since_attempt_${attempt - 1} ${m ? m[1] !== jtiHash : "unknown (no digest in that attempt's log)"}`);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### OPEN-MBE-2 author-token reading\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`);
}
