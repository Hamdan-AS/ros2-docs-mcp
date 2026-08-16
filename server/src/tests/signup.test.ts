import assert from "node:assert/strict";
import test from "node:test";

import type { SignupRepository, SignupVerificationStatus } from "../repository.js";
import {
  generateApiKey,
  generateOtp,
  hashSignupValue,
  normalizeEmail,
  requestSignup,
  secureHexEqual,
  SignupInputError,
  SignupUnavailableError,
  verifySignup,
  type SignupDependencies,
} from "../signup.js";

class FakeSignupRepository implements SignupRepository {
  shouldSend = true;
  verificationStatus: SignupVerificationStatus = "issued";
  began: Array<[string, string]> = [];
  cancelled: Array<[string, string]> = [];
  verified: Array<[string, string, string]> = [];
  rolledBack: Array<[string, string, string]> = [];

  async beginSignup(email: string, hash: string) {
    this.began.push([email, hash]);
    return this.shouldSend;
  }
  async cancelSignup(email: string, hash: string) { this.cancelled.push([email, hash]); }
  async verifySignup(email: string, otpHash: string, keyHash: string) {
    this.verified.push([email, otpHash, keyHash]);
    return this.verificationStatus;
  }
  async rollbackKeyDelivery(email: string, keyHash: string, otpHash: string) {
    this.rolledBack.push([email, keyHash, otpHash]);
  }
}

function dependencies(repository = new FakeSignupRepository()): SignupDependencies & {
  sentOtps: Array<[string, string]>;
  sentKeys: Array<[string, string, string]>;
  humanActions: string[];
} {
  const sentOtps: Array<[string, string]> = [];
  const sentKeys: Array<[string, string, string]> = [];
  const humanActions: string[] = [];
  return {
    repository,
    otpPepper: "test-pepper-with-enough-entropy",
    sentOtps,
    sentKeys,
    humanActions,
    async verifyHuman(_token, action) { humanActions.push(action); return true; },
    async emailAllowed() { return true; },
    async sendOtp(email, otp) { sentOtps.push([email, otp]); },
    async sendKey(email, key, idempotencyKey) { sentKeys.push([email, key, idempotencyKey]); },
  };
}

test("normalizes addresses and generates correctly shaped secrets", async () => {
  assert.equal(normalizeEmail(" User@Example.COM "), "user@example.com");
  assert.throws(() => normalizeEmail("not-an-email"), SignupInputError);
  assert.match(generateOtp(), /^\d{6}$/);
  assert.match(generateApiKey(), /^r2d_[A-Za-z0-9_-]{43}$/);
  assert.equal(
    await hashSignupValue("user@example.com:123456", "pepper"),
    await hashSignupValue("user@example.com:123456", "pepper")
  );
  assert.equal(secureHexEqual("aa00", "aa00"), true);
  assert.equal(secureHexEqual("aa00", "aa01"), false);
  assert.equal(secureHexEqual("not-hex", "not-hex"), false);
});

test("signup stores only a hash and emails a six-digit OTP", async () => {
  const repository = new FakeSignupRepository();
  const deps = dependencies(repository);
  await requestSignup({ email: "USER@example.com", turnstileToken: "valid" }, deps, "192.0.2.1");
  assert.deepEqual(deps.humanActions, ["signup"]);
  assert.equal(repository.began[0][0], "user@example.com");
  assert.match(repository.began[0][1], /^[a-f0-9]{64}$/);
  assert.match(deps.sentOtps[0][1], /^\d{6}$/);
  assert.notEqual(repository.began[0][1], deps.sentOtps[0][1]);
});

test("throttled or existing signup returns generically without sending email", async () => {
  const repository = new FakeSignupRepository();
  repository.shouldSend = false;
  const deps = dependencies(repository);
  await requestSignup({ email: "user@example.com", turnstileToken: "valid" }, deps);
  assert.equal(deps.sentOtps.length, 0);
});

test("OTP delivery failure cancels the stored attempt", async () => {
  const repository = new FakeSignupRepository();
  const deps = dependencies(repository);
  deps.sendOtp = async () => { throw new Error("provider unavailable"); };
  await assert.rejects(
    requestSignup({ email: "user@example.com", turnstileToken: "valid" }, deps),
    SignupUnavailableError
  );
  assert.equal(repository.cancelled.length, 1);
  assert.deepEqual(repository.cancelled[0], repository.began[0]);
});

test("verification issues one shaped key and never passes the raw key to storage", async () => {
  const repository = new FakeSignupRepository();
  const deps = dependencies(repository);
  await verifySignup(
    { email: "user@example.com", otp: "123456", turnstileToken: "valid" },
    deps
  );
  assert.deepEqual(deps.humanActions, ["verify"]);
  assert.match(repository.verified[0][1], /^[a-f0-9]{64}$/);
  assert.match(repository.verified[0][2], /^[a-f0-9]{64}$/);
  assert.match(deps.sentKeys[0][1], /^r2d_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(repository.verified[0][2], deps.sentKeys[0][1]);
  assert.match(deps.sentKeys[0][2], /^signup-key-[a-f0-9]{64}$/);
});

test("invalid or already-active verification does not send or replace a key", async () => {
  for (const status of ["invalid", "already_active"] as const) {
    const repository = new FakeSignupRepository();
    repository.verificationStatus = status;
    const deps = dependencies(repository);
    await verifySignup({ email: "user@example.com", otp: "123456", turnstileToken: "valid" }, deps);
    assert.equal(deps.sentKeys.length, 0);
  }
});

test("key-email failure rolls back exactly the newly issued hash", async () => {
  const repository = new FakeSignupRepository();
  const deps = dependencies(repository);
  deps.sendKey = async () => { throw new Error("provider unavailable"); };
  await assert.rejects(
    verifySignup({ email: "user@example.com", otp: "123456", turnstileToken: "valid" }, deps),
    SignupUnavailableError
  );
  assert.equal(repository.rolledBack.length, 1);
  assert.equal(repository.rolledBack[0][0], "user@example.com");
  assert.equal(repository.rolledBack[0][1], repository.verified[0][2]);
  assert.equal(repository.rolledBack[0][2], repository.verified[0][1]);
});

test("invalid human checks and malformed OTPs are rejected before database access", async () => {
  const repository = new FakeSignupRepository();
  const deps = dependencies(repository);
  deps.verifyHuman = async () => false;
  await assert.rejects(
    requestSignup({ email: "user@example.com", turnstileToken: "bad" }, deps),
    SignupInputError
  );
  await assert.rejects(
    verifySignup({ email: "user@example.com", otp: "12345", turnstileToken: "valid" }, dependencies(repository)),
    SignupInputError
  );
  assert.equal(repository.began.length, 0);
  assert.equal(repository.verified.length, 0);
});

test("operator allow-list rejection stays generic and never reaches storage or email", async () => {
  const repository = new FakeSignupRepository();
  const deps = dependencies(repository);
  deps.emailAllowed = async () => false;
  await requestSignup({ email: "other@example.com", turnstileToken: "valid" }, deps);
  await verifySignup({ email: "other@example.com", otp: "123456", turnstileToken: "valid" }, deps);
  assert.deepEqual(deps.humanActions, ["signup", "verify"]);
  assert.equal(repository.began.length, 0);
  assert.equal(repository.verified.length, 0);
  assert.equal(deps.sentOtps.length, 0);
  assert.equal(deps.sentKeys.length, 0);
});
