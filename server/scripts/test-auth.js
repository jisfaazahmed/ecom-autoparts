#!/usr/bin/env node

const authController = require('../controllers/authController');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const originalFindOne = User.findOne;
const originalSave = User.prototype.save;
const originalGenSalt = bcrypt.genSalt;
const originalHash = bcrypt.hash;
const originalCompare = bcrypt.compare;
const originalJwtSign = jwt.sign;

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
  User.prototype.save = async function saveMock() {
    return this;
  };

  bcrypt.genSalt = async () => 'mock-salt';
  bcrypt.hash = async () => 'mock-hash';
  bcrypt.compare = async () => true;

  jwt.sign = (payload, secret, options, callback) => {
    callback(null, 'mock-jwt-token');
  };
}

function restoreAll() {
  User.findOne = originalFindOne;
  User.prototype.save = originalSave;
  bcrypt.genSalt = originalGenSalt;
  bcrypt.hash = originalHash;
  bcrypt.compare = originalCompare;
  jwt.sign = originalJwtSign;
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

async function run() {
  console.log('='.repeat(70));
  console.log('AUTH CONTROLLER UNIT TESTS');
  console.log('='.repeat(70));

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

  await test('registration fails when user already exists', async () => {
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

  await test('login returns 403 when account is pending', async () => {
    User.findOne = async () => ({
      id: 'user-2',
      email: 'pending@example.com',
      name: 'Pending User',
      role: 'ADMIN',
      status: 'PENDING',
      password: 'stored-hash',
    });

    const req = { body: { email: 'pending@example.com', password: 'secret123' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 403, 'Expected HTTP 403');
    assert(res.body && res.body.message === 'Account pending approval.', 'Expected pending approval message');
  });

  await test('login returns token and normalized role on success', async () => {
    User.findOne = async () => ({
      id: 'user-3',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      password: 'stored-hash',
    });

    const req = { body: { email: 'admin@example.com', password: 'secret123' } };
    const res = createRes();

    await authController.login(req, res);

    assert(res.statusCode === 200, 'Expected HTTP 200');
    assert(res.body && res.body.accessToken === 'mock-jwt-token', 'Expected access token');
    assert(res.body && res.body.user && res.body.user.role === 'admin', 'Expected normalized admin role');
  });

  await test('register creates customer and returns token', async () => {
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

    assert(res.statusCode === 201, 'Expected HTTP 201');
    assert(res.body && res.body.accessToken === 'mock-jwt-token', 'Expected access token');
    assert(res.body && res.body.user && res.body.user.role === 'customer', 'Expected customer role mapping');
  });

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
