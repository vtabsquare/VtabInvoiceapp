const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { SPREADSHEET_ID } = require('../config/googleSheet');
const { sanitizeErrorMessage } = require('../utils/securityUtils');

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

describe('Data Protection & Configuration Security Tests', () => {
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

    describe('1. Configuration & Secrets Protection', () => {
        it('JWT_SECRET is loaded from process.env and not a hardcoded default', () => {
            assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be defined in process.env');
            assert.strictEqual(JWT_SECRET, process.env.JWT_SECRET);
            assert.notStrictEqual(JWT_SECRET, 'default_development_jwt_secret_key_vtab_2026');
        });

        it('SPREADSHEET_ID is loaded from process.env and not hardcoded', () => {
            assert.ok(process.env.SPREADSHEET_ID, 'SPREADSHEET_ID must be defined in process.env');
            assert.strictEqual(SPREADSHEET_ID, process.env.SPREADSHEET_ID);
        });

        it('authenticateToken middleware rejects requests safely with 500 if JWT_SECRET is missing', () => {
            const originalSecret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;

            let statusCode = null;
            let responseJson = null;
            const mockReq = { headers: { authorization: 'Bearer test.token' } };
            const mockRes = {
                status: (code) => {
                    statusCode = code;
                    return {
                        json: (data) => { responseJson = data; }
                    };
                }
            };

            try {
                authenticateToken(mockReq, mockRes, () => {});
                assert.strictEqual(statusCode, 500);
                assert.strictEqual(responseJson.message, 'Authentication configuration error');
            } finally {
                process.env.JWT_SECRET = originalSecret;
            }
        });

        it('Public root endpoint / does not leak server secrets or configuration', async () => {
            const res = await request('/');
            assert.strictEqual(res.status, 200);
            const strBody = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
            assert.ok(!strBody.includes(process.env.JWT_SECRET), 'Root must not expose JWT_SECRET');
            assert.ok(!strBody.includes(process.env.BREVO_API_KEY), 'Root must not expose BREVO_API_KEY');
            assert.ok(!strBody.includes(process.env.EMAIL_PASS), 'Root must not expose EMAIL_PASS');
        });
    });

    describe('2. Authentication & Credential Leakage Protection', () => {
        it('Login response never exposes password or password hashes', async () => {
            const res = await request('/api/admin/login', {
                method: 'POST',
                body: { email: 'nonexistent@vtab.com', password: 'password123' },
            });
            // Error response must not contain credentials
            assert.strictEqual(res.body.password, undefined);
            assert.strictEqual(res.body.passwordHash, undefined);
            assert.strictEqual(res.body.hash, undefined);
        });

        it('JWT payload never contains passwords or password hashes', () => {
            const token = jwt.sign(
                { email: 'admin@vtab.com', role: 'admin' },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            );

            const decoded = jwt.decode(token);
            assert.strictEqual(decoded.password, undefined);
            assert.strictEqual(decoded.passwordHash, undefined);
            assert.strictEqual(decoded.hash, undefined);
            assert.strictEqual(decoded.email, 'admin@vtab.com');
            assert.strictEqual(decoded.role, 'admin');
        });

        it('Protected endpoints reject unauthenticated access and do not leak data', async () => {
            const endpoints = ['/api/admin/clients', '/api/admin/profiles', '/api/admin/invoices'];
            for (const ep of endpoints) {
                const res = await request(ep);
                assert.strictEqual(res.status, 401, `Endpoint ${ep} must require authentication`);
                assert.strictEqual(res.body.message, 'Authorization token required');
            }
        });
    });

    describe('3. API Response & Error Message Hardening', () => {
        it('Express X-Powered-By header is removed for fingerprinting protection', async () => {
            const res = await request('/');
            assert.strictEqual(res.headers['x-powered-by'], undefined, 'X-Powered-By header must be disabled');
        });

        it('Error message sanitizer redacts Windows and POSIX absolute filesystem paths', () => {
            const windowsPathErr = new Error('Failed to read config at C:\\Users\\Administrator\\secret\\file.json');
            const sanitizedWin = sanitizeErrorMessage(windowsPathErr);
            assert.ok(!sanitizedWin.includes('C:\\Users'), 'Windows path must be redacted');
            assert.ok(sanitizedWin.includes('[server path]'));

            const posixPathErr = new Error('Failed to load credentials from /var/www/vtab/backend/config/creds.json');
            const sanitizedPosix = sanitizeErrorMessage(posixPathErr);
            assert.ok(!sanitizedPosix.includes('/var/www'), 'POSIX path must be redacted');
            assert.ok(sanitizedPosix.includes('[server path]'));
        });

        it('Error message sanitizer redacts sensitive API keys and secrets', () => {
            const testSecret = process.env.BREVO_API_KEY || 'xkeysib-dummy-test-key-12345';
            const secretErr = new Error(`Request failed with API key ${testSecret}: invalid credentials`);
            const sanitized = sanitizeErrorMessage(secretErr);
            assert.ok(!sanitized.includes(testSecret), 'Secret API key must not be exposed in error output');
            assert.ok(sanitized.includes('[REDACTED]'));
        });

        it('Safe legitimate business error messages are preserved unchanged', () => {
            const cleanErr = new Error('Missing required fields for email.');
            assert.strictEqual(sanitizeErrorMessage(cleanErr), 'Missing required fields for email.');
        });
    });
});
