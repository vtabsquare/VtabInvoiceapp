const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');
const {
    sanitizeErrorMessage,
    sanitizeLogText,
    logInternalError,
    handleServerError,
} = require('../utils/securityUtils');
const { logAudit, getRecentLogs } = require('../utils/auditService');

let server;
let baseURL;
let validToken;
let expiredToken;
let invalidToken;

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
                    // plain text response
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

describe('Error Handling & Response Sanitization Tests', () => {

    before(async () => {
        validToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        expiredToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '-10s' });
        invalidToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, 'wrong_secret', { expiresIn: '1h' });

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

    /* ====================================================================
       1. HTTP Response Safety & Status Codes
       ==================================================================== */
    describe('1. HTTP Response Safety & Status Codes', () => {
        it('validation errors return HTTP 400 with a concise safe message', async () => {
            const res = await request('/api/admin/clients', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { name: 'Acme Corp' } // missing fields
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body && typeof res.body.message === 'string');
            assert.ok(res.body.message.includes('required fields'));
            assert.strictEqual(res.body.stack, undefined);
        });

        it('missing JWT token returns HTTP 401 with standard error message', async () => {
            const res = await request('/api/admin/clients');
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Authorization token required');
            assert.strictEqual(res.body.stack, undefined);
        });

        it('invalid or tampered JWT returns HTTP 401 without leaking JWT internals', async () => {
            const res = await request('/api/admin/clients', {
                headers: { Authorization: `Bearer ${invalidToken}` }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Invalid authorization token');
            assert.strictEqual(res.body.stack, undefined);
        });

        it('expired JWT returns HTTP 401 with renewal prompt', async () => {
            const res = await request('/api/admin/clients', {
                headers: { Authorization: `Bearer ${expiredToken}` }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Token expired. Please login again.');
        });

        it('non-existent entity returns HTTP 404 without leaking sheet ranges or queries', async () => {
            const res = await request('/api/admin/invoices/99999', {
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.message, 'Invoice not found');
            assert.strictEqual(JSON.stringify(res.body).includes('invoice header!'), false);
        });

        it('unmatched API route returns HTTP 404 in JSON format', async () => {
            const res = await request('/api/nonexistent-endpoint');
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.message, 'API endpoint not found');
        });

        it('unexpected server error returns HTTP 500 with generic safe message', () => {
            let capturedStatus = null;
            let capturedJson = null;
            const mockRes = {
                status: (s) => {
                    capturedStatus = s;
                    return {
                        json: (data) => { capturedJson = data; }
                    };
                }
            };
            const mockReq = { method: 'GET', originalUrl: '/test-error' };
            const sampleError = new Error('Database connection failed: connect ECONNREFUSED 127.0.0.1:3306 at C:\\app\\db.js:14');

            handleServerError(mockRes, sampleError, mockReq);

            assert.strictEqual(capturedStatus, 500);
            assert.strictEqual(capturedJson.message, 'An unexpected server error occurred.');
            assert.strictEqual(capturedJson.error, 'An unexpected server error occurred.');
            assert.strictEqual(capturedJson.stack, undefined);
            assert.strictEqual(JSON.stringify(capturedJson).includes('ECONNREFUSED'), false);
            assert.strictEqual(JSON.stringify(capturedJson).includes('C:\\app'), false);
        });

        it('malformed JSON request payload returns HTTP 400 instead of 500 or HTML', async () => {
            const res = await request('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{ invalid_json: ' // Broken JSON syntax
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body && typeof res.body.message === 'string');
            assert.ok(res.body.message.includes('JSON'));
        });
    });

    /* ====================================================================
       2. Sensitive Information Protection in Responses
       ==================================================================== */
    describe('2. Sensitive Information Protection in Responses', () => {
        it('server responses never contain Windows or POSIX filesystem paths', () => {
            const winPathErr = new Error('Failed to load file at C:\\Users\\Administrator\\app\\backend\\server.js');
            const sanitizedWin = sanitizeErrorMessage(winPathErr);
            assert.strictEqual(sanitizedWin.includes('C:\\Users'), false);
            assert.ok(sanitizedWin.includes('[server path]'));

            const posixPathErr = new Error('Failed to read /var/www/vtab/backend/config/key.json');
            const sanitizedPosix = sanitizeErrorMessage(posixPathErr);
            assert.strictEqual(sanitizedPosix.includes('/var/www'), false);
            assert.ok(sanitizedPosix.includes('[server path]'));
        });

        it('server responses never leak stack traces', async () => {
            const res = await request('/api/admin/clients/bad*id', {
                method: 'PUT',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { name: 'Test' }
            });
            assert.strictEqual(res.body.stack, undefined);
            assert.strictEqual(JSON.stringify(res.body).includes('at Object.'), false);
            assert.strictEqual(JSON.stringify(res.body).includes('at async'), false);
        });

        it('server responses never expose JWT_SECRET', () => {
            const secretErr = new Error(`Token verification failed with secret: ${process.env.JWT_SECRET}`);
            const sanitized = sanitizeErrorMessage(secretErr);
            assert.strictEqual(sanitized.includes(process.env.JWT_SECRET), false);
            assert.ok(sanitized.includes('[REDACTED]'));
        });

        it('server responses never expose BREVO_API_KEY', () => {
            const brevoSecret = process.env.BREVO_API_KEY || 'xkeysib-dummy-test-key-54321';
            const brevoErr = new Error(`Brevo API call failed with key ${brevoSecret}`);
            const sanitized = sanitizeErrorMessage(brevoErr);
            assert.strictEqual(sanitized.includes(brevoSecret), false);
        });

        it('server responses never expose EMAIL_PASS', () => {
            const emailPass = process.env.EMAIL_PASS || 'mySuperSecretPassword123';
            const emailErr = new Error(`SMTP authentication failed for pass ${emailPass}`);
            const sanitized = sanitizeErrorMessage(emailErr);
            assert.strictEqual(sanitized.includes(emailPass), false);
        });

        it('server responses never expose Google Service Account private keys', () => {
            const privateKey = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDWuHWS4vqSQxZm\n-----END PRIVATE KEY-----';
            const keyErr = new Error(`Failed with credentials: ${privateKey}`);
            const sanitized = sanitizeErrorMessage(keyErr);
            assert.strictEqual(sanitized.includes('MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDWuHWS4vqSQxZm'), false);
            assert.ok(sanitized.includes('[REDACTED PRIVATE KEY]'));
        });

        it('server responses never expose Bearer tokens', () => {
            const tokenErr = new Error('Request with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 failed');
            const sanitized = sanitizeErrorMessage(tokenErr);
            assert.strictEqual(sanitized.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), false);
            assert.ok(sanitized.includes('Bearer [REDACTED]'));
        });

        it('error responses never echo unauthenticated request body passwords or OTPs', async () => {
            const res = await request('/api/admin/verify-otp', {
                method: 'POST',
                body: { email: 'admin@vtab.com', otp: '123456' }
            });
            const responseStr = JSON.stringify(res.body);
            assert.strictEqual(responseStr.includes('123456'), false);
        });
    });

    /* ====================================================================
       3. Internal Developer Logging & Sanitization
       ==================================================================== */
    describe('3. Internal Developer Logging & Sanitization', () => {
        let loggedMessages = [];
        let originalConsoleError;

        before(() => {
            originalConsoleError = console.error;
            console.error = (...args) => {
                loggedMessages.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
            };
        });

        after(() => {
            console.error = originalConsoleError;
        });

        it('technical errors are captured and logged internally with metadata', () => {
            loggedMessages = [];
            const mockReq = {
                method: 'POST',
                originalUrl: '/api/admin/invoices',
                user: { email: 'operator@vtab.com' }
            };
            const err = new Error('Google Sheets quota exceeded');
            err.name = 'GoogleQuotaError';

            logInternalError(err, mockReq);

            assert.strictEqual(loggedMessages.length >= 1, true);
            const logEntry = loggedMessages[0];
            assert.ok(logEntry.includes('[ERROR]'));
            assert.ok(logEntry.includes('POST /api/admin/invoices'));
            assert.ok(logEntry.includes('User: operator@vtab.com'));
            assert.ok(logEntry.includes('Type: GoogleQuotaError'));
            assert.ok(logEntry.includes('Google Sheets quota exceeded'));
        });

        it('sanitizeLogText redacts passwords, new passwords, OTPs, and auth tokens', () => {
            const rawLog = 'Payload failed validation: {"password": "SuperSecretPass!", "otp": "998877", "newPassword": "NewSecretPass123!"} with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9';
            const sanitized = sanitizeLogText(rawLog);

            assert.strictEqual(sanitized.includes('SuperSecretPass!'), false);
            assert.strictEqual(sanitized.includes('998877'), false);
            assert.strictEqual(sanitized.includes('NewSecretPass123!'), false);
            assert.strictEqual(sanitized.includes('eyJhbGciOiJIUzI1NiJ9'), false);
            assert.ok(sanitized.includes('"password": "[REDACTED]"'));
            assert.ok(sanitized.includes('"otp": "[REDACTED]"'));
            assert.ok(sanitized.includes('"newPassword": "[REDACTED]"'));
            assert.ok(sanitized.includes('Authorization: Bearer [REDACTED]'));
        });

        it('internal error logging never reveals Authorization header or credentials', () => {
            loggedMessages = [];
            const mockReq = {
                method: 'GET',
                originalUrl: '/api/admin/profiles',
                headers: { authorization: 'Bearer super_secret_bearer_token' }
            };
            const err = new Error('Token verification crashed at C:\\app\\middleware\\auth.js with Bearer super_secret_bearer_token');

            logInternalError(err, mockReq);

            const allLogs = loggedMessages.join('\n');
            assert.strictEqual(allLogs.includes('super_secret_bearer_token'), false);
            assert.strictEqual(allLogs.includes('C:\\app'), false);
            assert.ok(allLogs.includes('Bearer [REDACTED]'));
            assert.ok(allLogs.includes('[server path]'));
        });
    });

    /* ====================================================================
       4. Frontend Compatibility & Error Normalization
       ==================================================================== */
    describe('4. Frontend Compatibility & Error Normalization', () => {
        // Test client-side error normalization logic directly
        function normalizeClientError(error) {
            if (!error.response) {
                return "Network error. Please check your connection and try again.";
            } else if (error.response.status >= 500) {
                return error.response.data?.message || "Something went wrong on the server. Please try again.";
            } else if (error.response.data && typeof error.response.data === 'object' && error.response.data.message) {
                return error.response.data.message;
            } else {
                return "Something went wrong. Please try again.";
            }
        }

        it('normalizes 400 validation error responses to display server message', () => {
            const err400 = {
                response: {
                    status: 400,
                    data: { message: "Client Name must contain only alphabets" }
                }
            };
            assert.strictEqual(normalizeClientError(err400), "Client Name must contain only alphabets");
        });

        it('normalizes 401 authentication errors safely', () => {
            const err401 = {
                response: {
                    status: 401,
                    data: { message: "Token expired. Please login again." }
                }
            };
            assert.strictEqual(normalizeClientError(err401), "Token expired. Please login again.");
        });

        it('normalizes 500 server errors to generic user-friendly text', () => {
            const err500 = {
                response: {
                    status: 500,
                    data: { message: "An unexpected server error occurred." }
                }
            };
            assert.strictEqual(normalizeClientError(err500), "An unexpected server error occurred.");
        });

        it('normalizes network failures without exposing raw Axios internals', () => {
            const networkErr = {
                message: "Network Error: ECONNREFUSED 127.0.0.1:5000",
                code: "ERR_NETWORK"
                // No response object
            };
            const userMsg = normalizeClientError(networkErr);
            assert.strictEqual(userMsg, "Network error. Please check your connection and try again.");
            assert.strictEqual(userMsg.includes('ECONNREFUSED'), false);
        });
    });

    /* ====================================================================
       5. Regression & Business Logic Integrity
       ==================================================================== */
    describe('5. Regression & Business Logic Integrity', () => {
        it('client input validation preserves exact rejection messages', async () => {
            const res = await request('/api/admin/clients', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { name: 'Acme Corp' }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message.includes('required fields'));
        });

        it('profile input validation preserves exact rejection messages', async () => {
            const res = await request('/api/admin/profiles', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { companyName: 'Acme Corp' }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message.includes('required fields'));
        });

        it('invoice input validation rejects empty line items with exact message', async () => {
            const res = await request('/api/admin/invoices', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    invoiceNo: 'TEST-000',
                    invoiceDate: '2026-03-01',
                    dueDate: '2026-03-10',
                    profileName: 'VTAB Square',
                    clientName: 'Sample Client',
                    lineItems: []
                }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message.includes('Missing required invoice fields'));
        });

        it('audit trail records failures safely without passwords, tokens, or stack traces', async () => {
            await logAudit({
                adminEmail: 'operator@vtab.com',
                action: 'SEND_EMAIL',
                entity: 'INVOICE',
                entityId: 'INV-TEST-001',
                status: 'FAILED',
                details: 'Invoice email dispatch failed'
            });

            const logs = getRecentLogs();
            const emailFailLog = logs.find(l => l.entityId === 'INV-TEST-001' && l.status === 'FAILED');
            assert.ok(emailFailLog, 'Audit trail entry must exist');
            assert.strictEqual(emailFailLog.details, 'Invoice email dispatch failed');
            assert.strictEqual(JSON.stringify(emailFailLog).includes('password'), false);
            assert.strictEqual(JSON.stringify(emailFailLog).includes('Bearer'), false);
            assert.strictEqual(JSON.stringify(emailFailLog).includes('stack'), false);
        });
    });
});
