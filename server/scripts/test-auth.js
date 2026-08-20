#!/usr/bin/env node

const authController = require('../controllers/authController');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Save originals
const originalFindOne = User.findOne;
const originalFindById = User.findById;
const originalSave = User.prototype.save;
const originalGenSalt = bcrypt.genSalt;
const originalHash = bcrypt.hash;
const originalCompare = bcrypt.compare;
const originalJwtSign = jwt.sign;
const originalRandomInt = crypto.randomInt;
const originalCreateHash = crypto.createHash;

// Helpers
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function createRes() {
  return {
    statusCode: 200,
    body: null,
    sent: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.sent = payload;
      return this;
    },
  };
}

function resetMocks() {
  User.findOne = async () => null;
  User.findById = async () => null;
  User.prototype.save = async function saveMock() {
    return this;
  };

  bcrypt.genSalt = async () => 'mock-salt';
  bcrypt.hash = async () => 'mock-hash';
  bcrypt.compare = async () => true;

  jwt.sign = (payload, secret, options, callback) => {
    callback(null, 'mock-jwt-token');
  };

  // Mock crypto – deterministic OTP "123456"
  crypto.randomInt = () => 123456;
  crypto.createHash = () => ({
    update(data) {
      this._data = data;
      return this;
    },
    digest() {
      return 'hash-of-' + this._data;
    },
  });

}

function restoreAll() {
  User.findOne = originalFindOne;
  User.findById = originalFindById;
  User.prototype.save = originalSave;
  bcrypt.genSalt = originalGenSalt;
  bcrypt.hash = originalHash;
  bcrypt.compare = originalCompare;
  jwt.sign = originalJwtSign;
  crypto.randomInt = originalRandomInt;
  crypto.createHash = originalCreateHash;
}

async function test(name, fn) {
  try {
    resetMocks();
    await fn();
    results.passed += 1;
    results.tests.push({ name, status: 'PASS' });
    console.log('PASS - ' + name);
  } catch (error) {
    results.failed += 1;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.error('FAIL - ' + name + ': ' + error.message);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Tests
async function run() {
  console.log('='.repeat(70));
  console.log('AUTH CONTROLLER UNIT TESTS');
  console.log('='.repeat(70));

  // Legacy register endpoint

  await test('register returns 400 when required fields are missing', async () => {
    const req = { body: { email: 'test@example.com' } };
    const res = createRes();

    await authController.register(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message, 'Expected error payload');
  });

  await test('register blocks SUPER_ADMIN self-registration', async () => {
    const req = {
      body: {
        name: 'User',
        email: 'test@example.com',
        password: 'secret123',
        role: 'SUPER_ADMIN',
      },
    };
    const res = createRes();

    await authController.register(req, res);

    assert(res.statusCode === 403, 'Expected HTTP 403');
    assert(res.body && res.body.message === 'Cannot register as Super Admin.', 'Expected forbidden message');
  });

  await test('register fails when user already exists', async () => {
    User.findOne = async () => ({
      id: 'existing-user-1',
      email: 'existing@example.com',
      name: 'Existing User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      password: 'stored-hash',
    });

    const req = {
      body: {
        name: 'New User',
        email: 'existing@example.com',
        password: 'secret123',
      },
    };
    const res = createRes();

    await authController.register(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'User already exists', 'Expected user already exists message');
  });

  await test('legacy register returns OTP_REQUIRED for new signups', async () => {
    User.findOne = async () => null;

    const req = {
      body: {
        name: 'Customer User',
        email: 'customer@example.com',
        password: 'secret123',
      },
    };
    const res = createRes();

    await authController.register(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400 (OTP required redirect)');
    assert(res.body && res.body.code === 'OTP_REQUIRED', 'Expected OTP_REQUIRED code');
  });

  // ──────────────── registerStart (OTP signup) ────────────────

  await test('registerStart returns 400 when required fields missing', async () => {
    const req = { body: { email: 'test@example.com' } };
    const res = createRes();

    await authController.registerStart(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message, 'Expected error payload');
  });

  await test('registerStart blocks SUPER_ADMIN', async () => {
    const req = {
      body: { name: 'Hacker', email: 'h@x.com', password: 'secret123', role: 'SUPER_ADMIN' },
    };
    const res = createRes();

    await authController.registerStart(req, res);

    assert(res.statusCode === 403, 'Expected HTTP 403');
  });

  await test('registerStart fails when user already exists', async () => {
    User.findOne = async () => ({ id: 'existing', email: 'dup@example.com' });

    const req = {
      body: { name: 'Dup User', email: 'dup@example.com', password: 'secret123' },
    };
    const res = createRes();

    await authController.registerStart(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'User already exists', 'Expected user already exists');
  });

  await test('registerStart requires shopName for ADMIN role', async () => {
    const req = {
      body: { name: 'Vendor', email: 'vendor@example.com', password: 'secret123', role: 'ADMIN' },
    };
    const res = createRes();

    await authController.registerStart(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'Shop name is required for seller registration', 'Expected shopName error');
  });

  await test('registerStart creates user, sends OTP, returns verificationId', async () => {
    User.findOne = async () => null;

    const req = {
      body: { name: 'New Customer', email: 'new@example.com', password: 'secret123' },
    };
    const res = createRes();

    await authController.registerStart(req, res);

    assert(res.statusCode === 201, 'Expected HTTP 201');
    assert(res.body && res.body.verificationId, 'Expected verificationId');
    assert(res.body && res.body.expiresInMinutes, 'Expected expiresInMinutes');
    assert(res.body && res.body.message === 'OTP sent to your email', 'Expected OTP sent message');
  });

  // ──────────────── registerVerify (OTP verification) ────────────────

  await test('registerVerify returns 400 when fields missing', async () => {
    const req = { body: {} };
    const res = createRes();

    await authController.registerVerify(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'verificationId and otp are required', 'Expected fields-required message');
  });

  await test('registerVerify returns 404 when user not found', async () => {
    User.findById = async () => null;

    const req = { body: { verificationId: 'nonexistent', otp: '123456' } };
    const res = createRes();

    await authController.registerVerify(req, res);

    assert(res.statusCode === 404, 'Expected HTTP 404');
  });

  await test('registerVerify returns 400 for expired OTP', async () => {
    User.findById = async () => ({
      id: 'user-otp-1',
      email: 'otp@example.com',
      name: 'OTP User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerification: {
        codeHash: 'hash-of-123456',
        expiresAt: new Date(Date.now() - 10000), // expired
        attempts: 0,
        lastSentAt: new Date(),
        sendCount: 1,
        sendWindowStartAt: new Date(),
        verifiedAt: null,
      },
      save: async function () { return this; },
    });

    const req = { body: { verificationId: 'user-otp-1', otp: '123456' } };
    const res = createRes();

    await authController.registerVerify(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'OTP is invalid or has expired', 'Expected expired OTP message');
  });

  await test('registerVerify returns 400 for wrong OTP', async () => {
    User.findById = async () => ({
      id: 'user-otp-2',
      email: 'otp@example.com',
      name: 'OTP User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerification: {
        codeHash: 'hash-of-123456',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 0,
        lastSentAt: new Date(),
        sendCount: 1,
        sendWindowStartAt: new Date(),
        verifiedAt: null,
      },
      save: async function () { return this; },
    });

    const req = { body: { verificationId: 'user-otp-2', otp: '999999' } };
    const res = createRes();

    await authController.registerVerify(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'OTP is invalid or has expired', 'Expected invalid OTP message');
  });

  await test('registerVerify returns 429 when max attempts exceeded', async () => {
    User.findById = async () => ({
      id: 'user-otp-3',
      email: 'otp@example.com',
      name: 'OTP User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerification: {
        codeHash: 'hash-of-123456',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 5,
        lastSentAt: new Date(),
        sendCount: 1,
        sendWindowStartAt: new Date(),
        verifiedAt: null,
      },
      save: async function () { return this; },
    });

    const req = { body: { verificationId: 'user-otp-3', otp: '123456' } };
    const res = createRes();

    await authController.registerVerify(req, res);

    assert(res.statusCode === 429, 'Expected HTTP 429');
    assert(res.body && res.body.message === 'Too many attempts. Please request a new code.', 'Expected rate limit message');
  });

  await test('registerVerify succeeds with correct OTP and returns token', async () => {
    User.findById = async () => ({
      id: 'user-otp-4',
      email: 'otp@example.com',
      name: 'OTP User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerification: {
        codeHash: 'hash-of-123456',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 0,
        lastSentAt: new Date(),
        sendCount: 1,
        sendWindowStartAt: new Date(),
        verifiedAt: null,
      },
      save: async function () { return this; },
    });

    const req = { body: { verificationId: 'user-otp-4', otp: '123456' } };
    const res = createRes();

    await authController.registerVerify(req, res);

    assert(res.statusCode === 200, 'Expected HTTP 200');
    assert(res.body && res.body.accessToken === 'mock-jwt-token', 'Expected access token');
    assert(res.body && res.body.user && res.body.user.role === 'customer', 'Expected customer role');
  });

  await test('registerVerify issues token for already-verified user', async () => {
    User.findById = async () => ({
      id: 'user-otp-5',
      email: 'verified@example.com',
      name: 'Verified User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerification: {
        codeHash: null,
        expiresAt: null,
        attempts: 0,
        lastSentAt: null,
        sendCount: 0,
        sendWindowStartAt: null,
        verifiedAt: new Date(),
      },
      save: async function () { return this; },
    });

    const req = { body: { verificationId: 'user-otp-5', otp: '000000' } };
    const res = createRes();

    await authController.registerVerify(req, res);

    assert(res.statusCode === 200, 'Expected HTTP 200 (already verified)');
    assert(res.body && res.body.accessToken, 'Expected access token for already-verified user');
  });

  // ──────────────── registerResend ────────────────

  await test('registerResend returns 400 without verificationId', async () => {
    const req = { body: {} };
    const res = createRes();

    await authController.registerResend(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
  });

  await test('registerResend returns 404 when user not found', async () => {
    User.findById = async () => null;

    const req = { body: { verificationId: 'nonexistent' } };
    const res = createRes();

    await authController.registerResend(req, res);

    assert(res.statusCode === 404, 'Expected HTTP 404');
  });

  await test('registerResend returns 400 for already-verified email', async () => {
    User.findById = async () => ({
      id: 'user-resend-1',
      email: 'done@example.com',
      name: 'Done User',
      emailVerification: {
        verifiedAt: new Date(),
        codeHash: null,
        expiresAt: null,
        attempts: 0,
        lastSentAt: null,
        sendCount: 0,
        sendWindowStartAt: null,
      },
      save: async function () { return this; },
    });

    const req = { body: { verificationId: 'user-resend-1' } };
    const res = createRes();

    await authController.registerResend(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'Email already verified', 'Expected already verified message');
  });

  await test('registerResend sends new OTP and returns 200', async () => {
    User.findById = async () => ({
      id: 'user-resend-2',
      email: 'resend@example.com',
      name: 'Resend User',
      emailVerification: {
        codeHash: 'old-hash',
        expiresAt: new Date(Date.now() + 300000),
        attempts: 1,
        lastSentAt: new Date(Date.now() - 120000), // 2 min ago, past cooldown
        sendCount: 1,
        sendWindowStartAt: new Date(Date.now() - 120000),
        verifiedAt: null,
      },
      save: async function () { return this; },
    });

    const req = { body: { verificationId: 'user-resend-2' } };
    const res = createRes();

    await authController.registerResend(req, res);

    assert(res.statusCode === 200, 'Expected HTTP 200');
    assert(res.body && res.body.message === 'OTP resent to your email', 'Expected resend confirmation');
  });

  // ──────────────── Login tests ────────────────

  await test('login fails with invalid email', async () => {
    User.findOne = async () => null;

    const req = { body: { email: 'none@example.com', password: 'secret123' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'Invalid Credentials', 'Expected invalid credentials');
  });

  await test('login fails with wrong password', async () => {
    User.findOne = async () => ({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      password: 'stored-hash',
    });
    bcrypt.compare = async () => false;

    const req = { body: { email: 'user@example.com', password: 'wrong-pass' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 400, 'Expected HTTP 400');
    assert(res.body && res.body.message === 'Invalid Credentials', 'Expected invalid credentials');
  });

  await test('login returns 403 when email not verified', async () => {
    User.findOne = async () => ({
      id: 'user-unverified',
      email: 'unverified@example.com',
      name: 'Unverified User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      password: 'stored-hash',
      emailVerification: {
        codeHash: 'some-hash',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 0,
        lastSentAt: new Date(),
        sendCount: 1,
        sendWindowStartAt: new Date(),
        verifiedAt: null,
      },
    });

    const req = { body: { email: 'unverified@example.com', password: 'secret123' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 403, 'Expected HTTP 403');
    assert(res.body && res.body.message === 'Email verification required.', 'Expected email verification message');
  });

  await test('login returns 403 when account is pending', async () => {
    User.findOne = async () => ({
      id: 'user-2',
      email: 'pending@example.com',
      name: 'Pending User',
      role: 'ADMIN',
      status: 'PENDING',
      password: 'stored-hash',
      emailVerification: {
        verifiedAt: new Date(), // email IS verified, but account status is PENDING
      },
    });

    const req = { body: { email: 'pending@example.com', password: 'secret123' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 403, 'Expected HTTP 403');
    assert(res.body && res.body.message === 'Account pending approval.', 'Expected pending approval message');
  });

  await test('login returns 403 when account is rejected', async () => {
    User.findOne = async () => ({
      id: 'user-rejected',
      email: 'rejected@example.com',
      name: 'Rejected User',
      role: 'ADMIN',
      status: 'REJECTED',
      password: 'stored-hash',
      emailVerification: {
        verifiedAt: new Date(),
      },
    });

    const req = { body: { email: 'rejected@example.com', password: 'secret123' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 403, 'Expected HTTP 403');
    assert(res.body && res.body.message === 'Account rejected.', 'Expected rejected message');
  });

  await test('login returns token and normalized role on success', async () => {
    User.findOne = async () => ({
      id: 'user-3',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      password: 'stored-hash',
      emailVerification: {
        verifiedAt: new Date(), // verified
      },
    });

    const req = { body: { email: 'admin@example.com', password: 'secret123' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 200, 'Expected HTTP 200');
    assert(res.body && res.body.accessToken === 'mock-jwt-token', 'Expected access token');
    assert(res.body && res.body.user && res.body.user.role === 'admin', 'Expected normalized admin role');
  });

  await test('login succeeds for legacy user without emailVerification subdoc', async () => {
    User.findOne = async () => ({
      id: 'user-legacy',
      email: 'legacy@example.com',
      name: 'Legacy User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      password: 'stored-hash',
      // No emailVerification field — legacy account
    });

    const req = { body: { email: 'legacy@example.com', password: 'secret123' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 200, 'Expected HTTP 200');
    assert(res.body && res.body.accessToken === 'mock-jwt-token', 'Expected access token');
    assert(res.body && res.body.user && res.body.user.role === 'customer', 'Expected customer role');
  });

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log('Passed: ' + results.passed);
  console.log('Failed: ' + results.failed);
  console.log('Total: ' + (results.passed + results.failed));

  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests
      .filter((t) => t.status === 'FAIL')
      .forEach((t) => {
        console.log('  - ' + t.name + ': ' + t.error);
      });
  }

  restoreAll();
  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((error) => {
  restoreAll();
  console.error('Fatal error while running tests:', error);
  process.exit(1);
});
