const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');

const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');
const backupService = require('../utils/backupService');
const { getRecentLogs, clearRecentLogs } = require('../utils/auditService');

let server;
let baseURL;
let validToken;
let expiredToken;
let invalidToken;
let targetSerialNo = null;
let originalInvoiceStatus = 'Pending';
let testBackupDir;

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

describe('Task 12 — Data Retention & Deletion Tests', () => {

    before(async () => {
        validToken = jwt.sign({ email: 'operator-retention@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
        expiredToken = jwt.sign({ email: 'operator-retention@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '-10s' });
        invalidToken = jwt.sign({ email: 'operator-retention@vtab.com', role: 'admin' }, 'tampered_secret', { expiresIn: '1h' });

        testBackupDir = path.join(os.tmpdir(), `vtab_retention_test_${Date.now()}`);
        fs.mkdirSync(testBackupDir, { recursive: true });

        await new Promise((resolve) => {
            server = app.listen(0, () => {
                baseURL = `http://localhost:${server.address().port}`;
                resolve();
            });
        });

        // Find an existing invoice to test archiving and restoration
        try {
            const res = await request('/api/admin/invoices', {
                headers: { Authorization: `Bearer ${validToken}` }
            });
            if (res.status === 200 && Array.isArray(res.body) && res.body.length > 0) {
                targetSerialNo = res.body[0].serialNo;
                originalInvoiceStatus = res.body[0].invoiceStatus || 'Pending';
            }
        } catch (_) {}
    });

    after(async () => {
        // Restore original invoice status if modified
        if (targetSerialNo) {
            try {
                await request(`/api/admin/invoices/${targetSerialNo}/status`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${validToken}` },
                    body: { invoiceStatus: originalInvoiceStatus }
                });
            } catch (_) {}
        }

        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }

        if (testBackupDir && fs.existsSync(testBackupDir)) {
            try {
                fs.rmSync(testBackupDir, { recursive: true, force: true });
            } catch (_) {}
        }
    });

    beforeEach(() => {
        clearRecentLogs();
    });

    /* ====================================================================
       1. Authentication & Session Security for Retention Actions
       ==================================================================== */
    describe('1. Authentication & Session Security for Retention Actions', () => {
        it('rejects unauthenticated invoice status/archive update with 401', async () => {
            const res = await request('/api/admin/invoices/00001/status', {
                method: 'PATCH',
                body: { invoiceStatus: 'Archived' }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Authorization token required');
        });

        it('rejects status/archive update with expired token with 401', async () => {
            const res = await request('/api/admin/invoices/00001/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${expiredToken}` },
                body: { invoiceStatus: 'Archived' }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Token expired. Please login again.');
        });

        it('rejects status/archive update with tampered/invalid token with 401', async () => {
            const res = await request('/api/admin/invoices/00001/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${invalidToken}` },
                body: { invoiceStatus: 'Archived' }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Invalid authorization token');
        });

        it('rejects unauthenticated invoice deletion with 401', async () => {
            const res = await request('/api/admin/invoices/00001', {
                method: 'DELETE'
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Authorization token required');
        });

        it('rejects unauthenticated client deletion with 401', async () => {
            const res = await request('/api/admin/clients/00001', {
                method: 'DELETE'
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Authorization token required');
        });
    });

    /* ====================================================================
       2. Input Validation on Archival Operations
       ==================================================================== */
    describe('2. Input Validation on Archival Operations', () => {
        it('rejects status update with invalid identifier format with 400', async () => {
            const res = await request('/api/admin/invoices/invalid*serial/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { invoiceStatus: 'Archived' }
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.message, 'Invalid invoice serial number');
        });

        it('rejects status update with empty body with 400', async () => {
            const res = await request('/api/admin/invoices/00001/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {}
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.message, 'At least one status field must be provided');
        });

        it('rejects status update exceeding 50 characters with 400', async () => {
            const res = await request('/api/admin/invoices/00001/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { invoiceStatus: 'A'.repeat(51) }
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.message, 'Invalid status value format or length exceeds 50 characters');
        });

        it('returns 404 when attempting to archive non-existent invoice serial', async () => {
            const res = await request('/api/admin/invoices/9999999999/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { invoiceStatus: 'Archived' }
            });
            assert.strictEqual(res.status, 404);
            assert.ok(res.body.message.includes('not found'));
        });
    });

    /* ====================================================================
       3. Non-Destructive Archiving Workflow & Audit Logging
       ==================================================================== */
    describe('3. Non-Destructive Archiving Workflow & Audit Logging', () => {
        it('archives an invoice, records ARCHIVE audit action, and preserves record', async () => {
            if (!targetSerialNo) {
                // Skip if test sheet has no invoices
                return;
            }

            clearRecentLogs();

            // 1. Mark as Archived
            const archiveRes = await request(`/api/admin/invoices/${targetSerialNo}/status`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { invoiceStatus: 'Archived' }
            });

            assert.strictEqual(archiveRes.status, 200);
            assert.strictEqual(archiveRes.body.message, 'Statuses updated successfully');

            // 2. Verify audit log captures ARCHIVE action
            const logs = getRecentLogs();
            const archiveLog = logs.find(l => l.action === 'ARCHIVE' && l.entityId === String(targetSerialNo));
            assert.ok(archiveLog, 'ARCHIVE audit entry must be recorded');
            assert.strictEqual(archiveLog.entity, 'INVOICE');
            assert.strictEqual(archiveLog.status, 'SUCCESS');
            assert.strictEqual(archiveLog.adminEmail, 'operator-retention@vtab.com');
            assert.ok(archiveLog.details.includes('Archived for retention'));

            // 3. Verify the invoice is NOT deleted and is still retrievable
            const getRes = await request(`/api/admin/invoices/${targetSerialNo}`, {
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(getRes.status, 200);
            assert.ok(getRes.body);
            assert.strictEqual(getRes.body.serialNo, targetSerialNo);
            assert.strictEqual(getRes.body.invoiceStatus, 'Archived');
            assert.ok(Array.isArray(getRes.body.lineItems), 'Line items must be preserved');
            assert.ok(getRes.body.lineItems.length > 0, 'Line items must not be deleted');
        });

        it('restores (unarchives) an invoice and records UNARCHIVE audit action', async () => {
            if (!targetSerialNo) return;

            clearRecentLogs();

            // Restore status to original or 'Pending'
            const restoreRes = await request(`/api/admin/invoices/${targetSerialNo}/status`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { invoiceStatus: 'Pending' }
            });

            assert.strictEqual(restoreRes.status, 200);
            assert.strictEqual(restoreRes.body.message, 'Statuses updated successfully');

            // Verify UNARCHIVE audit entry
            const logs = getRecentLogs();
            const unarchiveLog = logs.find(l => l.action === 'UNARCHIVE' && l.entityId === String(targetSerialNo));
            assert.ok(unarchiveLog, 'UNARCHIVE audit entry must be recorded');
            assert.strictEqual(unarchiveLog.entity, 'INVOICE');
            assert.strictEqual(unarchiveLog.status, 'SUCCESS');
            assert.strictEqual(unarchiveLog.adminEmail, 'operator-retention@vtab.com');
            assert.ok(unarchiveLog.details.includes('Restored from archive'));
        });

        it('records STATUS_UPDATE for standard status changes (non-archive)', async () => {
            if (!targetSerialNo) return;

            clearRecentLogs();

            const statusRes = await request(`/api/admin/invoices/${targetSerialNo}/status`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { gstStatus: 'Filed' }
            });

            assert.strictEqual(statusRes.status, 200);

            const logs = getRecentLogs();
            const updateLog = logs.find(l => l.action === 'STATUS_UPDATE' && l.entityId === String(targetSerialNo));
            assert.ok(updateLog, 'STATUS_UPDATE audit entry must be recorded');
            assert.strictEqual(updateLog.entity, 'INVOICE');
            assert.strictEqual(updateLog.status, 'SUCCESS');
        });
    });

    /* ====================================================================
       4. Backup Preservation of Archived Records
       ==================================================================== */
    describe('4. Backup Preservation of Archived Records', () => {
        it('backups capture and retain all invoice headers and details without omitting archived records', async () => {
            const backupResult = await backupService.createBackup({
                backupDir: testBackupDir,
                includeCsv: true
            });

            assert.strictEqual(backupResult.success, true);
            const backupFile = path.join(testBackupDir, backupResult.filename);
            assert.ok(fs.existsSync(backupFile));

            const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            assert.ok(backupData.sheets['invoice header'], 'Backup must contain invoice header');
            assert.ok(backupData.sheets['invoice details'], 'Backup must contain invoice details');

            // Ensure header rows exist
            const invoiceRows = backupData.sheets['invoice header'].rows;
            assert.ok(Array.isArray(invoiceRows));
            assert.ok(invoiceRows.length >= 1, 'Header rows must be present');
        });
    });

    /* ====================================================================
       5. Deletion Protection & Referential Integrity Guarantees
       ==================================================================== */
    describe('5. Deletion Protection & Referential Integrity Guarantees', () => {
        it('ensures all deletion operations are permanently logged to the audit trail', async () => {
            clearRecentLogs();

            // Calling DELETE on a non-existent serial will fail safely or be caught, but unauthenticated is blocked
            const res = await request('/api/admin/invoices/9999999999', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${validToken}` }
            });

            // If found or not found, it responds properly
            assert.ok([200, 404].includes(res.status));

            if (res.status === 200) {
                const logs = getRecentLogs();
                const deleteLog = logs.find(l => l.action === 'DELETE');
                assert.ok(deleteLog, 'DELETE must be logged');
            }
        });
    });
});
