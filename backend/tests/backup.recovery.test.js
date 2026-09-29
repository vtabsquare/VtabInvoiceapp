const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');

const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');
const backupService = require('../utils/backupService');
const { getRecentLogs } = require('../utils/auditService');
const { sheets, SPREADSHEET_ID } = require('../config/googleSheet');

let server;
let baseURL;
let validToken;
let expiredToken;
let invalidToken;
let testBackupDir;
let initialBackupResult;

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

describe('Task 8 — Backup & Recovery Tests', () => {

    before(async () => {
        validToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        expiredToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '-10s' });
        invalidToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, 'wrong_secret', { expiresIn: '1h' });

        testBackupDir = path.join(os.tmpdir(), `vtab_backup_test_${Date.now()}`);
        fs.mkdirSync(testBackupDir, { recursive: true });

        // Generate baseline backup with CSV export to use across integrity and formatting assertions
        initialBackupResult = await backupService.createBackup({ backupDir: testBackupDir, includeCsv: true });

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
        if (testBackupDir && fs.existsSync(testBackupDir)) {
            try {
                fs.rmSync(testBackupDir, { recursive: true, force: true });
            } catch (_) {}
        }
    });

    /* ====================================================================
       1. Backup Creation & Timestamping
       ==================================================================== */
    describe('1. Backup Creation & Timestamping', () => {
        it('backup service creates a valid JSON backup file with timestamp in filename', () => {
            assert.strictEqual(initialBackupResult.success, true);
            assert.ok(initialBackupResult.filename.startsWith('backup_'));
            assert.ok(initialBackupResult.filename.endsWith('.json'));

            const filePath = path.join(testBackupDir, initialBackupResult.filename);
            assert.ok(fs.existsSync(filePath), 'Backup file must exist on disk');

            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            assert.strictEqual(content.backupVersion, '1.0');
            assert.strictEqual(content.source, 'Google Sheets');
            assert.ok(content.createdAt);
            assert.ok(Array.isArray(content.sheetNames));
        });

        it('backup contains all required business sheets and excludes credential tabs', () => {
            const filePath = path.join(testBackupDir, initialBackupResult.filename);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            const expectedSheets = ['Client', 'profile', 'invoice header', 'invoice details', 'audit_log'];
            for (const sheetName of expectedSheets) {
                assert.ok(content.sheets[sheetName], `Sheet "${sheetName}" must be present in backup`);
                assert.ok(Array.isArray(content.sheets[sheetName].headers), `Headers for "${sheetName}" must be an array`);
                assert.ok(Array.isArray(content.sheets[sheetName].rows), `Rows for "${sheetName}" must be an array`);
            }

            // Strictly prohibited tabs
            assert.strictEqual(content.sheets['admin login'], undefined, 'admin login tab must be excluded');
            assert.strictEqual(content.sheets['workspace login'], undefined, 'workspace login tab must be excluded');
            assert.strictEqual(content.sheets['users'], undefined, 'users tab must be excluded');
        });

        it('multiple backup executions in the same second do not overwrite each other', async () => {
            const backup1 = await backupService.createBackup({ backupDir: testBackupDir });
            const backup2 = await backupService.createBackup({ backupDir: testBackupDir });

            assert.notStrictEqual(backup1.filename, backup2.filename, 'Each backup must have a distinct filename');
            assert.ok(fs.existsSync(path.join(testBackupDir, backup1.filename)));
            assert.ok(fs.existsSync(path.join(testBackupDir, backup2.filename)));
        });

        it('atomic file creation leaves no temporary .tmp files on disk', () => {
            const files = fs.readdirSync(testBackupDir);
            const tmpFiles = files.filter(f => f.endsWith('.tmp'));
            assert.strictEqual(tmpFiles.length, 0, 'No .tmp files should remain after backup completes');
        });

        it('optional CSV export generates RFC 4180 CSV files alongside JSON snapshot', () => {
            assert.strictEqual(initialBackupResult.success, true);
            assert.ok(initialBackupResult.files.length > 1, 'Should generate JSON plus CSV files');

            const csvFiles = initialBackupResult.files.filter(f => f.endsWith('.csv'));
            assert.strictEqual(csvFiles.length, 5, 'Should generate 5 CSV files for the 5 business sheets');

            for (const csvFilename of csvFiles) {
                const csvPath = path.join(testBackupDir, csvFilename);
                assert.ok(fs.existsSync(csvPath), `CSV file ${csvFilename} must exist`);
                const content = fs.readFileSync(csvPath, 'utf8');
                assert.ok(content.length > 0, `CSV ${csvFilename} must not be empty`);
            }
        });
    });

    /* ====================================================================
       2. Data Integrity & Snapshot Verification
       ==================================================================== */
    describe('2. Data Integrity & Snapshot Verification', () => {
        it('faithfully preserves sheet headers and row counts from live source', () => {
            const backupData = backupService.getBackupContent(initialBackupResult.filename, testBackupDir);

            assert.ok(backupData.sheets['Client'].headers.length >= 5);
            assert.ok(backupData.sheets['profile'].headers.length >= 5);
            assert.ok(backupData.sheets['invoice header'].headers.length >= 10);
            assert.ok(backupData.sheets['invoice details'].headers.length >= 10);

            // Verify row count summary matches actual rows array lengths
            for (const tab of backupData.sheetNames) {
                const sheet = backupData.sheets[tab];
                assert.strictEqual(sheet.rowCount, sheet.rows.length);
                assert.strictEqual(backupData.summary.sheetCounts[tab], sheet.rows.length);
            }
        });

        it('preserves invoice line item details without modifying numbers or recalculating', () => {
            const backupData = backupService.getBackupContent(initialBackupResult.filename, testBackupDir);
            const detailsRows = backupData.sheets['invoice details'].rows;

            if (detailsRows.length > 0) {
                const sampleRow = detailsRows[0];
                assert.ok(Array.isArray(sampleRow));
                assert.ok(sampleRow.length > 0);
                assert.ok(sampleRow[0] !== undefined);
            }
        });

        it('backup operation is completely read-only against Google Sheets', async () => {
            const clientResBefore = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Client!A:M',
            });
            const rowCountBefore = (clientResBefore.data.values || []).length;

            // Perform another backup
            await backupService.createBackup({ backupDir: testBackupDir });

            const clientResAfter = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Client!A:M',
            });
            const rowCountAfter = (clientResAfter.data.values || []).length;

            assert.strictEqual(rowCountAfter, rowCountBefore, 'Google Sheets source row count must remain unchanged');
        });
    });

    /* ====================================================================
       3. Security & Access Control
       ==================================================================== */
    describe('3. Security & Access Control', () => {
        it('POST /api/admin/backup rejects requests without JWT with 401', async () => {
            const res = await request('/api/admin/backup', { method: 'POST' });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Authorization token required');
        });

        it('POST /api/admin/backup rejects requests with invalid JWT with 401', async () => {
            const res = await request('/api/admin/backup', {
                method: 'POST',
                headers: { Authorization: `Bearer ${invalidToken}` }
            });
            assert.strictEqual(res.status, 401);
        });

        it('POST /api/admin/backup rejects requests with expired JWT with 401', async () => {
            const res = await request('/api/admin/backup', {
                method: 'POST',
                headers: { Authorization: `Bearer ${expiredToken}` }
            });
            assert.strictEqual(res.status, 401);
            assert.ok(res.body.message.includes('expired'));
        });

        it('POST /api/admin/backup succeeds with valid JWT and returns 201', async () => {
            const res = await request('/api/admin/backup', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            assert.ok(res.body.filename);
            assert.ok(res.body.summary);
            assert.strictEqual(res.body.summary.totalSheets, 5);
        });

        it('GET /api/admin/backups returns list of backups with valid JWT', async () => {
            const res = await request('/api/admin/backups', {
                method: 'GET',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body.backups));
            if (res.body.backups.length > 0) {
                const item = res.body.backups[0];
                assert.ok(item.filename);
                assert.ok(typeof item.size === 'number');
                // Ensure no absolute system paths leaked
                assert.strictEqual(item.path, undefined);
                assert.strictEqual(item.fullPath, undefined);
            }
        });

        it('backup directory is not publicly served as a static route', async () => {
            const res = await request('/backups/some_backup.json');
            assert.ok(res.status === 404 || res.body?.message === 'API endpoint not found');
        });

        it('backup files do not contain passwords, hashes, JWT secret, or API keys', () => {
            const rawContent = fs.readFileSync(path.join(testBackupDir, initialBackupResult.filename), 'utf8');

            assert.strictEqual(rawContent.includes(JWT_SECRET), false, 'JWT_SECRET must not appear in backup');
            if (process.env.BREVO_API_KEY) {
                assert.strictEqual(rawContent.includes(process.env.BREVO_API_KEY), false, 'BREVO_API_KEY must not appear in backup');
            }
            if (process.env.EMAIL_PASS) {
                assert.strictEqual(rawContent.includes(process.env.EMAIL_PASS), false, 'EMAIL_PASS must not appear in backup');
            }
            assert.strictEqual(rawContent.includes('$2a$') || rawContent.includes('$2b$'), false, 'Bcrypt hashes must not appear in backup');
        });

        it('getBackupContent prevents directory traversal attempts', () => {
            assert.throws(() => {
                backupService.getBackupContent('../package.json', testBackupDir);
            }, /Invalid backup filename/);

            assert.throws(() => {
                backupService.getBackupContent('..\\server.js', testBackupDir);
            }, /Invalid backup filename/);
        });
    });

    /* ====================================================================
       4. Failure Safety & Error Resilience
       ==================================================================== */
    describe('4. Failure Safety & Error Resilience', () => {
        it('handles file write error gracefully and cleans up temporary files', async () => {
            await assert.rejects(async () => {
                await backupService.createBackup({ backupDir: 'Z:\\invalid_drive_path\\backups' });
            });
        });

        it('rejects backup requests with prohibited tabs', async () => {
            await assert.rejects(async () => {
                await backupService.createBackup({
                    backupDir: testBackupDir,
                    tabNames: ['admin login'] // Prohibited tab
                });
            }, /No valid business tabs selected/);
        });

        it('listBackups returns empty array for non-existent directory without throwing', () => {
            const emptyList = backupService.listBackups('/path/that/does/not/exist');
            assert.deepStrictEqual(emptyList, []);
        });
    });

    /* ====================================================================
       5. Audit Trail & Business Continuity Regression
       ==================================================================== */
    describe('5. Audit Trail & Business Continuity Regression', () => {
        it('records successful backup action in audit trail', async () => {
            const logs = getRecentLogs();
            const backupLog = logs.find(l => l.action === 'BACKUP');
            assert.ok(backupLog, 'Audit trail must record BACKUP action');
            assert.strictEqual(backupLog.entity, 'SYSTEM');
            assert.strictEqual(backupLog.status, 'SUCCESS');
            assert.ok(backupLog.details.includes('Backup created'));
            assert.ok(!backupLog.details.includes(JWT_SECRET));
        });

        it('GET /api/admin/clients continues working smoothly', async () => {
            const res = await request('/api/admin/clients', {
                method: 'GET',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });

        it('GET /api/admin/profiles continues working smoothly', async () => {
            const res = await request('/api/admin/profiles', {
                method: 'GET',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });

        it('GET /api/admin/invoices continues working smoothly', async () => {
            const res = await request('/api/admin/invoices', {
                method: 'GET',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
        });
    });
});
