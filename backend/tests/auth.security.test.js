const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const {
    checkRateLimit,
    recordFailedAttempt,
    resetAttempts,
    loginAttempts,
    MAX_ATTEMPTS
} = require('../utils/loginRateLimiter');

describe('Login Security & Bcrypt Authentication Tests', () => {

    beforeEach(() => {
        loginAttempts.clear();
    });

    describe('1. Bcrypt Hash Format Detection', () => {
        const isBcrypt = (val) => typeof val === 'string' && /^\$2[abyx]\$\d{2}\$/.test(val) && val.length === 60;

        it('correctly identifies legacy plaintext passwords', () => {
            assert.strictEqual(isBcrypt('admin123'), false);
            assert.strictEqual(isBcrypt('password'), false);
            assert.strictEqual(isBcrypt('secretPass!@#'), false);
        });

        it('correctly identifies valid bcrypt hashes', async () => {
            const hash = await bcrypt.hash('admin123', 10);
            assert.strictEqual(isBcrypt(hash), true);
            assert.strictEqual(hash.length, 60);
        });
    });

    describe('2. Bcrypt Password Verification & Migration Logic', () => {
        it('authenticates a plaintext password and flags for migration', async () => {
            const storedPassword = 'legacyPlaintextPassword';
            const userPassword = 'legacyPlaintextPassword';

            const isBcrypt = typeof storedPassword === 'string' && /^\$2[abyx]\$\d{2}\$/.test(storedPassword) && storedPassword.length === 60;
            let isMatch = false;
            let needsMigration = false;

            if (isBcrypt) {
                isMatch = await bcrypt.compare(userPassword, storedPassword);
            } else {
                isMatch = (userPassword === storedPassword);
                if (isMatch) needsMigration = true;
            }

            assert.strictEqual(isMatch, true);
            assert.strictEqual(needsMigration, true);

            // Generate migration hash
            const migratedHash = await bcrypt.hash(userPassword, 10);
            assert.ok(migratedHash.startsWith('$2a$') || migratedHash.startsWith('$2b$'));
            assert.strictEqual(migratedHash.length, 60);

            // Verify subsequent login with migrated hash
            const isSubsequentMatch = await bcrypt.compare(userPassword, migratedHash);
            assert.strictEqual(isSubsequentMatch, true);
        });

        it('rejects incorrect plaintext password without flagging for migration', async () => {
            const storedPassword = 'legacyPlaintextPassword';
            const userPassword = 'wrongPassword';

            const isBcrypt = typeof storedPassword === 'string' && /^\$2[abyx]\$\d{2}\$/.test(storedPassword) && storedPassword.length === 60;
            let isMatch = false;
            let needsMigration = false;

            if (isBcrypt) {
                isMatch = await bcrypt.compare(userPassword, storedPassword);
            } else {
                isMatch = (userPassword === storedPassword);
                if (isMatch) needsMigration = true;
            }

            assert.strictEqual(isMatch, false);
            assert.strictEqual(needsMigration, false);
        });

        it('authenticates an existing bcrypt password without flagging for migration', async () => {
            const userPassword = 'mySecretPassword';
            const storedHash = await bcrypt.hash(userPassword, 10);

            const isBcrypt = typeof storedHash === 'string' && /^\$2[abyx]\$\d{2}\$/.test(storedHash) && storedHash.length === 60;
            let isMatch = false;
            let needsMigration = false;

            if (isBcrypt) {
                isMatch = await bcrypt.compare(userPassword, storedHash);
            } else {
                isMatch = (userPassword === storedHash);
                if (isMatch) needsMigration = true;
            }

            assert.strictEqual(isMatch, true);
            assert.strictEqual(needsMigration, false);
        });

        it('rejects incorrect password against existing bcrypt hash', async () => {
            const storedHash = await bcrypt.hash('correctPassword', 10);
            const isMatch = await bcrypt.compare('incorrectPassword', storedHash);
            assert.strictEqual(isMatch, false);
        });
    });

    describe('3. Password Reset Hashing Behavior', () => {
        it('always generates a bcrypt hash for password reset, never plaintext', async () => {
            const newPassword = 'newResetPassword2026';
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            assert.notStrictEqual(hashedPassword, newPassword);
            assert.strictEqual(hashedPassword.length, 60);
            assert.ok(hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$'));

            // Verify new password validates
            assert.strictEqual(await bcrypt.compare(newPassword, hashedPassword), true);
            // Verify old/wrong password fails
            assert.strictEqual(await bcrypt.compare('oldPassword', hashedPassword), false);
        });
    });

    describe('4. Login Rate Limiting Middleware', () => {
        const mockReq = (ip = '192.168.1.100') => ({
            headers: {},
            socket: { remoteAddress: ip },
        });

        const mockRes = () => {
            const res = {
                statusCode: 200,
                jsonData: null,
                status(code) {
                    res.statusCode = code;
                    return res;
                },
                json(data) {
                    res.jsonData = data;
                    return res;
                }
            };
            return res;
        };

        it('allows normal login attempts within limits', () => {
            const req = mockReq('10.0.0.1');
            const res = mockRes();
            let nextCalled = false;

            checkRateLimit(req, res, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, true);
            assert.strictEqual(res.statusCode, 200);
        });

        it('records failed attempts and blocks when limit is exceeded', () => {
            const req = mockReq('10.0.0.2');

            // Record MAX_ATTEMPTS failures
            for (let i = 0; i < MAX_ATTEMPTS; i++) {
                recordFailedAttempt(req);
            }

            const res = mockRes();
            let nextCalled = false;

            checkRateLimit(req, res, () => { nextCalled = true; });

            // Blocked: next() should not be called and HTTP 429 returned
            assert.strictEqual(nextCalled, false);
            assert.strictEqual(res.statusCode, 429);
            assert.ok(res.jsonData.message.includes('Too many failed login attempts'));
        });

        it('resets attempt counter upon successful login', () => {
            const req = mockReq('10.0.0.3');

            // 3 failed attempts
            recordFailedAttempt(req);
            recordFailedAttempt(req);
            recordFailedAttempt(req);
            assert.strictEqual(loginAttempts.get('10.0.0.3').count, 3);

            // User logs in successfully
            resetAttempts(req);
            assert.strictEqual(loginAttempts.has('10.0.0.3'), false);

            // Subsequent attempt is completely unrestricted
            const res = mockRes();
            let nextCalled = false;
            checkRateLimit(req, res, () => { nextCalled = true; });
            assert.strictEqual(nextCalled, true);
        });

        it('does not affect different client IP addresses', () => {
            const reqBad = mockReq('192.168.1.50');
            const reqGood = mockReq('192.168.1.60');

            for (let i = 0; i < MAX_ATTEMPTS; i++) {
                recordFailedAttempt(reqBad);
            }

            // reqBad is blocked
            const resBad = mockRes();
            let badNext = false;
            checkRateLimit(reqBad, resBad, () => { badNext = true; });
            assert.strictEqual(badNext, false);
            assert.strictEqual(resBad.statusCode, 429);

            // reqGood is allowed
            const resGood = mockRes();
            let goodNext = false;
            checkRateLimit(reqGood, resGood, () => { goodNext = true; });
            assert.strictEqual(goodNext, true);
            assert.strictEqual(resGood.statusCode, 200);
        });
    });
});
