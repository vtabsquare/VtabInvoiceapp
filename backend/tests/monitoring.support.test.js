const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');
const { checkGoogleSheetsHealth, getApplicationHealth, setSimulatedFailure } = require('../utils/healthCheck');
const { getRecentLogs } = require('../utils/auditService');
const { sheets, SPREADSHEET_ID } = require('../config/googleSheet');

let server;
let baseURL;
let validToken;

// Helper to make HTTP requests
function request(pathUrl, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(pathUrl, baseURL);
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

describe('Task 9 — Monitoring & Support Tests', () => {

    before(async () => {
        validToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

        await new Promise((resolve) => {
            server = app.listen(0, () => {
                baseURL = `http://localhost:${server.address().port}`;
                resolve();
            });
        });
    });

    after(async () => {
        setSimulatedFailure(false);
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    /* ====================================================================
       1. Application & Service Availability
       ==================================================================== */
    describe('1. Application & Service Availability', () => {
        it('GET /health responds with HTTP 200 when application and Google Sheets are healthy', async () => {
            const res = await request('/health');
            assert.strictEqual(res.status, 200);
            assert.ok(typeof res.body === 'object');
            assert.strictEqual(res.body.status, 'ok');
            assert.ok(res.body.timestamp);
            assert.strictEqual(res.body.services.api, 'ok');
            assert.strictEqual(res.body.services.googleSheets, 'ok');
        });

        it('GET /api/health also responds with HTTP 200 for Nginx /api proxy compatibility', async () => {
            const res = await request('/api/health');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.status, 'ok');
            assert.strictEqual(res.body.services.api, 'ok');
            assert.strictEqual(res.body.services.googleSheets, 'ok');
        });

        it('response contains valid ISO 8601 timestamp string', async () => {
            const res = await request('/health');
            const date = new Date(res.body.timestamp);
            assert.strictEqual(isNaN(date.getTime()), false, 'Timestamp must be a valid parseable date');
        });

        it('root endpoint GET / continues to return plain text status without regression', async () => {
            const res = await request('/');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body, 'VTAB Square Invoice API is running...');
        });
    });

    /* ====================================================================
       2. Google Sheets Health Check & Failure Handling
       ==================================================================== */
    describe('2. Google Sheets Health Check & Failure Handling', () => {
        it('checkGoogleSheetsHealth returns healthy status and latencyMs on normal operation', async () => {
            const result = await checkGoogleSheetsHealth();
            assert.strictEqual(result.healthy, true);
            assert.strictEqual(result.status, 'ok');
            assert.ok(typeof result.latencyMs === 'number');
            assert.ok(result.latencyMs >= 0);
        });

        it('simulated Google Sheets failure returns degraded status and HTTP 503', async () => {
            setSimulatedFailure(true);
            try {
                const res = await request('/health');
                assert.strictEqual(res.status, 503);
                assert.strictEqual(res.body.status, 'degraded');
                assert.strictEqual(res.body.services.api, 'ok');
                assert.strictEqual(res.body.services.googleSheets, 'unavailable');
                assert.ok(res.body.timestamp);
            } finally {
                setSimulatedFailure(false);
            }
        });

        it('checkGoogleSheetsHealth handles timeouts safely without hanging or throwing', async () => {
            // Test with a 1ms timeout to ensure timeout logic triggers gracefully
            const result = await checkGoogleSheetsHealth({ timeoutMs: 1 });
            assert.strictEqual(result.healthy, false);
            assert.strictEqual(result.status, 'unavailable');
        });

        it('does not leak raw Google API errors in client response during failure', async () => {
            setSimulatedFailure(true);
            try {
                const res = await request('/health');
                assert.strictEqual(res.body.error, undefined);
                assert.strictEqual(res.body.errors, undefined);
                assert.strictEqual(res.body.message, undefined);
                assert.strictEqual(res.body.stack, undefined);
            } finally {
                setSimulatedFailure(false);
            }
        });
    });

    /* ====================================================================
       3. Security & Information Protection
       ==================================================================== */
    describe('3. Security & Information Protection', () => {
        it('GET /health does not require JWT authentication (public for monitoring agents)', async () => {
            const res = await request('/health');
            assert.notStrictEqual(res.status, 401);
            assert.strictEqual(res.status, 200);
        });

        it('response never exposes SPREADSHEET_ID', async () => {
            const res = await request('/health');
            const bodyStr = JSON.stringify(res.body);
            if (SPREADSHEET_ID) {
                assert.strictEqual(bodyStr.includes(SPREADSHEET_ID), false, 'SPREADSHEET_ID must not appear in health response');
            }
        });

        it('response never exposes JWT_SECRET, BREVO_API_KEY, or EMAIL_PASS', async () => {
            const res = await request('/health');
            const bodyStr = JSON.stringify(res.body);
            assert.strictEqual(bodyStr.includes(JWT_SECRET), false, 'JWT_SECRET must not appear in health response');
            if (process.env.BREVO_API_KEY) {
                assert.strictEqual(bodyStr.includes(process.env.BREVO_API_KEY), false, 'BREVO_API_KEY must not appear in health response');
            }
            if (process.env.EMAIL_PASS) {
                assert.strictEqual(bodyStr.includes(process.env.EMAIL_PASS), false, 'EMAIL_PASS must not appear in health response');
            }
        });

        it('response never exposes filesystem paths or stack traces', async () => {
            const res = await request('/health');
            const bodyStr = JSON.stringify(res.body);
            assert.strictEqual(/[A-Za-z]:\\[^\s:;,"]+/.test(bodyStr), false, 'Windows path must not be present');
            assert.strictEqual(bodyStr.includes('node_modules'), false);
            assert.strictEqual(bodyStr.includes('Error:'), false);
        });
    });

    /* ====================================================================
       4. Operational Safety & Non-Interference
       ==================================================================== */
    describe('4. Operational Safety & Non-Interference', () => {
        it('health checks do not create audit log entries (prevents audit spam)', async () => {
            const logsBefore = getRecentLogs().length;

            // Make several health check calls
            await request('/health');
            await request('/health');
            await request('/api/health');

            const logsAfter = getRecentLogs().length;
            assert.strictEqual(logsAfter, logsBefore, 'Health checks must not generate audit log records');
        });

        it('health checks are strictly read-only against Google Sheets', async () => {
            const clientResBefore = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Client!A:M',
            });
            const countBefore = (clientResBefore.data.values || []).length;

            // Run multiple health checks
            await request('/health');
            await checkGoogleSheetsHealth();

            const clientResAfter = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Client!A:M',
            });
            const countAfter = (clientResAfter.data.values || []).length;

            assert.strictEqual(countAfter, countBefore, 'Health checks must never alter Google Sheets row counts');
        });
    });

    /* ====================================================================
       5. Regression & Business Logic Integrity
       ==================================================================== */
    describe('5. Regression & Business Logic Integrity', () => {
        it('GET /api/admin/clients remains operational', async () => {
            const res = await request('/api/admin/clients', {
                method: 'GET',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });

        it('GET /api/admin/profiles remains operational', async () => {
            const res = await request('/api/admin/profiles', {
                method: 'GET',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });

        it('GET /api/admin/invoices remains operational', async () => {
            const res = await request('/api/admin/invoices', {
                method: 'GET',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });
    });
});
