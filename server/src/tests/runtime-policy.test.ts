import assert from "node:assert/strict";
import test from "node:test";

import { localeForCountry, quotaError, quotaHeaders, signupMode, supportUrl } from "../runtime-policy.js";

test("South Asian countries receive Roman Urdu and every other case falls back to English", () => {
  for (const country of ["PK", "IN", "BD", "LK", "NP", "BT", "MV", "pk"]) {
    assert.equal(localeForCountry(country), "ur-Latn");
  }
  for (const country of ["US", "GB", "XX", "T1", "", null, undefined]) {
    assert.equal(localeForCountry(country), "en");
  }
  assert.match(quotaError("ur-Latn"), /48 ghantay/);
  assert.match(quotaError("en"), /48 hours/);
});

test("signup mode fails closed", () => {
  assert.equal(signupMode("public"), "public");
  assert.equal(signupMode("operator_test"), "operator_test");
  assert.equal(signupMode("disabled"), "disabled");
  assert.equal(signupMode(undefined), "disabled");
  assert.equal(signupMode("unexpected"), "disabled");
});

test("support URL accepts Patreon HTTPS only and strips fragments", () => {
  assert.equal(supportUrl("https://www.patreon.com/ros2docs#support"), "https://www.patreon.com/ros2docs");
  assert.equal(supportUrl("https://patreon.com/ros2docs"), "https://patreon.com/ros2docs");
  assert.equal(supportUrl("http://patreon.com/ros2docs"), undefined);
  assert.equal(supportUrl("https://patreon.com.example/ros2docs"), undefined);
  assert.equal(supportUrl("https://example.com"), undefined);
  assert.equal(supportUrl(undefined), undefined);
});

test("quota headers warn only when the final allowed credit is consumed", () => {
  assert.deepEqual(quotaHeaders(75, { allowed: true, credits_used: 74, cooldown_until: null }), {
    "x-ratelimit-limit": "75",
    "x-ratelimit-remaining": "1",
  });
  assert.deepEqual(quotaHeaders(75, {
    allowed: true,
    credits_used: 75,
    cooldown_until: "2026-08-18T12:00:00.000Z",
  }), {
    "x-ratelimit-limit": "75",
    "x-ratelimit-remaining": "0",
    "x-ratelimit-reset-at": "2026-08-18T12:00:00.000Z",
    "x-ros2-docs-warning": "Last credit consumed; cooldown started",
  });
  const rejected = quotaHeaders(75, {
    allowed: false,
    credits_used: 75,
    cooldown_until: "2026-08-18T12:00:00.000Z",
  });
  assert.equal(rejected["x-ros2-docs-warning"], undefined);
  assert.equal(rejected["x-ratelimit-remaining"], "0");
});
