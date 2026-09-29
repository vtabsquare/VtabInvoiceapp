const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');

let server;
let baseURL;
let authToken;

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

describe('Backend API Smoke Tests', () => {
    before(async () => {
        authToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
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

    it('GET / responds with API health status (Public)', async () => {
        const res = await request('/');
        assert.strictEqual(res.status, 200);
        assert.ok(typeof res.body === 'string' && res.body.includes('VTAB Square Invoice API is running'));
    });

    it('POST /api/admin/login rejects invalid credentials without crashing (Public)', async () => {
        const res = await request('/api/admin/login', {
            method: 'POST',
            body: { email: 'nonexistent@vtab.com', password: 'wrongpassword' },
        });
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.message, 'Invalid credentials');
    });

    it('GET /api/admin/clients rejects unauthenticated requests with 401', async () => {
        const res = await request('/api/admin/clients');
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.message, 'Authorization token required');
    });

    it('GET /api/admin/clients returns array of clients when authenticated', async () => {
        const res = await request('/api/admin/clients', {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    it('POST /api/admin/clients rejects incomplete data when authenticated without modifying sheet', async () => {
        const res = await request('/api/admin/clients', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: { name: 'Incomplete Test Client' }, // Missing required fields
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message && res.body.message.includes('required fields'));
    });

    it('GET /api/admin/profiles returns array of profiles when authenticated', async () => {
        const res = await request('/api/admin/profiles', {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    it('POST /api/admin/profiles rejects incomplete data when authenticated without modifying sheet', async () => {
        const res = await request('/api/admin/profiles', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: { companyName: 'Test Profile Ltd' }, // Missing required fields
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message && res.body.message.includes('required fields'));
    });

    it('GET /api/admin/invoices returns array of invoices when authenticated', async () => {
        const res = await request('/api/admin/invoices', {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    it('POST /api/admin/invoices rejects empty lineItems when authenticated without modifying sheet', async () => {
        const res = await request('/api/admin/invoices', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: {
                invoiceNo: 'TEST-000',
                invoiceDate: '2026-03-01',
                dueDate: '2026-03-10',
                profileName: 'VTAB Square',
                clientName: 'Sample Client',
                lineItems: [], // empty line items
            },
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message && res.body.message.includes('Missing required invoice fields'));
    });

    it('POST /api/admin/invoice/send-email rejects missing email parameters when authenticated', async () => {
        const res = await request('/api/admin/invoice/send-email', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: { invoiceNo: 'TEST-001' }, // Missing clientEmail, pdfBase64, clientName
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message && res.body.message.includes('Missing required fields'));
    });

    it('POST /api/admin/verify-otp rejects invalid or unissued OTP (Public)', async () => {
        const res = await request('/api/admin/verify-otp', {
            method: 'POST',
            body: { email: 'test@example.com', otp: '999999' },
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.message, 'Invalid or expired OTP');
    });
});
