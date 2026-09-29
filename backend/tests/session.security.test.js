const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');

let server;
let baseURL;

// Helper to make HTTP requests
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

describe('Session Security & JWT Authentication Middleware Tests', () => {
    let validToken;
    let expiredToken;
    let invalidSecretToken;

    before(async () => {
        // Pre-generate tokens for testing
        validToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        expiredToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '-10s' });
        invalidSecretToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, 'completely_wrong_secret', { expiresIn: '1h' });

        await new Promise((resolve) => {
            server = app.listen(0, () => {
                baseURL = `http://localhost:${server.address().port}`;
                resolve();
            });
        });
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    describe('1. Public Routes Accessibility', () => {
        it('Health endpoint GET / is accessible without token', async () => {
            const res = await request('/');
            assert.strictEqual(res.status, 200);
            assert.ok(typeof res.body === 'string' && res.body.includes('VTAB Square Invoice API is running'));
        });

        it('Login endpoint POST /api/admin/login is accessible without token', async () => {
            const res = await request('/api/admin/login', {
                method: 'POST',
                body: { email: 'nobody@vtab.com', password: 'bad' },
            });
            // Should reach controller and return 401 for bad credentials, NOT 401 for missing token
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Invalid credentials');
        });

        it('OTP verification POST /api/admin/verify-otp is accessible without token', async () => {
            const res = await request('/api/admin/verify-otp', {
                method: 'POST',
                body: { email: 'user@example.com', otp: '123456' },
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.message, 'Invalid or expired OTP');
        });
    });

    describe('2. Token Verification & Rejection', () => {
        it('rejects requests with missing Authorization header with 401', async () => {
            const res = await request('/api/admin/clients');
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Authorization token required');
        });

        it('rejects requests with malformed Authorization header with 401', async () => {
            const res = await request('/api/admin/clients', {
                headers: { 'Authorization': 'Basic 12345' },
            });
            assert.strictEqual(res.status, 401);
            assert.ok(res.body.message.includes('Invalid authorization format'));
        });

        it('rejects requests with an invalid/tampered token with 401', async () => {
            const res = await request('/api/admin/clients', {
                headers: { 'Authorization': `Bearer ${invalidSecretToken}` },
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Invalid authorization token');
        });

        it('rejects requests with an expired token with 401 and specific message', async () => {
            const res = await request('/api/admin/clients', {
                headers: { 'Authorization': `Bearer ${expiredToken}` },
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Token expired. Please login again.');
        });
    });

    describe('3. Protected API Routes with Valid Token', () => {
        it('allows access to GET /api/admin/clients with valid token', async () => {
            const res = await request('/api/admin/clients', {
                headers: { 'Authorization': `Bearer ${validToken}` },
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });

        it('allows access to GET /api/admin/profiles with valid token', async () => {
            const res = await request('/api/admin/profiles', {
                headers: { 'Authorization': `Bearer ${validToken}` },
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });

        it('allows access to GET /api/admin/invoices with valid token', async () => {
            const res = await request('/api/admin/invoices', {
                headers: { 'Authorization': `Bearer ${validToken}` },
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });

        it('protects email sending endpoint POST /api/admin/invoice/send-email from unauthenticated calls', async () => {
            const res = await request('/api/admin/invoice/send-email', {
                method: 'POST',
                body: { invoiceNo: 'TEST' },
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Authorization token required');
        });
    });
});
