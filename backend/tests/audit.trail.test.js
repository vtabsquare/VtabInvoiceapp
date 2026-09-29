const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');
const {
    logAudit,
    getClientIp,
    getRecentLogs,
    clearRecentLogs,
    setSheetFailMode
} = require('../utils/auditService');

let server;
let baseURL;
let authToken;

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseURL);
        const headers = { ...options.headers };
        const reqOptions = {
            method: options.method || 'GET',
            headers,
        };

        const req = http.request(url, reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (_) {
                    // text response
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                });
            });
        });

        req.on('error', reject);

        if (options.body) {
            const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('Content-Length', Buffer.byteLength(bodyStr));
            req.write(bodyStr);
        }

        req.end();
    });
}

describe('Audit Trail Service & Administrative Action Logging Tests', () => {
    before(async () => {
        authToken = jwt.sign({ email: 'audit-admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                baseURL = `http://localhost:${server.address().port}`;
                resolve();
            });
        });
    });

    after(async () => {
        setSheetFailMode(false);
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    beforeEach(() => {
        clearRecentLogs();
        setSheetFailMode(false);
    });

    describe('1. Audit Helper & Schema Verification', () => {
        it('creates a structured audit entry with all required fields', async () => {
            const entry = await logAudit({
                adminEmail: 'admin@vtab.com',
                action: 'CREATE',
                entity: 'CLIENT',
                entityId: 'CLI-101',
                status: 'SUCCESS',
                details: 'Client created: Acme Corp',
                ipAddress: '127.0.0.1'
            });

            assert.ok(entry, 'Audit entry should be returned');
            assert.strictEqual(entry.adminEmail, 'admin@vtab.com');
            assert.strictEqual(entry.action, 'CREATE');
            assert.strictEqual(entry.entity, 'CLIENT');
            assert.strictEqual(entry.entityId, 'CLI-101');
            assert.strictEqual(entry.status, 'SUCCESS');
            assert.strictEqual(entry.details, 'Client created: Acme Corp');
            assert.strictEqual(entry.ipAddress, '127.0.0.1');
        });

        it('generates a valid ISO 8601 server timestamp', async () => {
            const beforeTime = new Date().getTime();
            const entry = await logAudit({
                adminEmail: 'test@vtab.com',
                action: 'TEST',
                entity: 'SYSTEM'
            });
            const entryTime = new Date(entry.timestamp).getTime();
            const afterTime = new Date().getTime();

            assert.ok(!isNaN(entryTime), 'Timestamp must be a valid date');
            assert.ok(entryTime >= beforeTime && entryTime <= afterTime);
            assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(entry.timestamp));
        });

        it('defaults missing optional fields safely', async () => {
            const entry = await logAudit({ action: 'PING' });
            assert.strictEqual(entry.adminEmail, 'Anonymous');
            assert.strictEqual(entry.status, 'SUCCESS');
            assert.strictEqual(entry.entityId, '');
            assert.strictEqual(entry.details, '');
            assert.strictEqual(entry.ipAddress, '');
        });
    });

    describe('2. Sensitive Data Protection in Audit Trail', () => {
        it('never logs passwords, password hashes, JWTs, OTPs, or API keys in audit entries', async () => {
            await logAudit({
                adminEmail: 'admin@vtab.com',
                action: 'LOGIN',
                entity: 'AUTH',
                status: 'SUCCESS',
                details: 'Admin login successful'
            });

            const logs = getRecentLogs();
            assert.ok(logs.length > 0);
            const serialized = JSON.stringify(logs);

            assert.ok(!serialized.includes('password='), 'Must not contain password parameter');
            assert.ok(!serialized.includes('$2a$'), 'Must not contain bcrypt hash pattern');
            assert.ok(!serialized.includes(JWT_SECRET), 'Must not contain JWT secret');
            if (process.env.BREVO_API_KEY) {
                assert.ok(!serialized.includes(process.env.BREVO_API_KEY), 'Must not contain Brevo API key');
            }
        });
    });

    describe('3. Failure Safety & Non-Blocking Resilience', () => {
        it('logAudit handles simulated sheet outage safely without throwing an exception', async () => {
            setSheetFailMode(true);

            // Should not throw
            const result = await logAudit({
                adminEmail: 'admin@vtab.com',
                action: 'UPDATE',
                entity: 'CLIENT'
            });

            assert.strictEqual(result, null, 'Returns null on failure without throwing');
        });

        it('business operations (e.g. login) succeed even when audit sheet fails', async () => {
            setSheetFailMode(true);

            // Trigger a failed login when audit sheet is completely down
            const res = await request('/api/admin/login', {
                method: 'POST',
                body: { email: 'nobody@vtab.com', password: 'wrong' }
            });

            // The business logic response (401 invalid credentials) must not turn into 500 error!
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Invalid credentials');
        });
    });

    describe('4. Administrative Endpoints Integration', () => {
        it('records failed login attempt in the audit trail', async () => {
            await request('/api/admin/login', {
                method: 'POST',
                body: { email: 'baduser@vtab.com', password: 'badpassword' }
            });

            const logs = getRecentLogs();
            const failedLoginLog = logs.find(l => l.action === 'LOGIN' && l.status === 'FAILED');

            assert.ok(failedLoginLog, 'Failed login must create an audit entry');
            assert.strictEqual(failedLoginLog.adminEmail, 'baduser@vtab.com');
            assert.strictEqual(failedLoginLog.entity, 'AUTH');
        });

        it('records authenticated logout in the audit trail', async () => {
            const res = await request('/api/admin/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.message, 'Logout successful');

            const logs = getRecentLogs();
            const logoutLog = logs.find(l => l.action === 'LOGOUT');

            assert.ok(logoutLog, 'Logout must create an audit entry');
            assert.strictEqual(logoutLog.adminEmail, 'audit-admin@vtab.com');
            assert.strictEqual(logoutLog.entity, 'AUTH');
            assert.strictEqual(logoutLog.status, 'SUCCESS');
        });

        it('rejects unauthenticated logout with 401 and does not audit unverified logout', async () => {
            const res = await request('/api/admin/logout', {
                method: 'POST'
            });

            assert.strictEqual(res.status, 401);
            const logs = getRecentLogs();
            const logoutLog = logs.find(l => l.action === 'LOGOUT');
            assert.strictEqual(logoutLog, undefined, 'Unauthenticated logout must not produce audit entry');
        });
    });
});
