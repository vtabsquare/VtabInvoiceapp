/**
 * Audit Trail Service
 * Lightweight, failure-safe audit logging to Google Sheets 'audit_log' tab
 */

const { sheets, SPREADSHEET_ID } = require('../config/googleSheet');

// In-memory buffer for fast verification, testing, and fallback
const recentAuditLogs = [];
const MAX_BUFFER_SIZE = 100;
let simulatedFailureMode = false;

/**
 * Extract client IP from Express request safely
 * @param {object} req - Express request object
 * @returns {string} IP address or empty string
 */
function getClientIp(req) {
    if (!req) return '';
    try {
        const forwarded = req.headers ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip']) : null;
        if (forwarded) {
            return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
        }
        return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
    } catch (_) {
        return '';
    }
}

/**
 * Log an administrative action to the audit trail.
 * 
 * CRITICAL SAFETY REQUIREMENT:
 * This function is non-blocking and failure-safe.
 * It will NEVER throw or bubble up errors to the caller.
 *
 * @param {object} entry
 * @param {string} entry.adminEmail - Email of the admin performing the action
 * @param {string} entry.action - E.g. LOGIN, LOGOUT, CREATE, UPDATE, DELETE, SEND_EMAIL, PASSWORD_RESET
 * @param {string} entry.entity - E.g. AUTH, CLIENT, PROFILE, INVOICE
 * @param {string} [entry.entityId] - Identifier of the entity (e.g. invoiceNo, serialNo)
 * @param {string} [entry.status='SUCCESS'] - Status: SUCCESS or FAILED
 * @param {string} [entry.details=''] - Brief non-sensitive description
 * @param {string} [entry.ipAddress=''] - Client IP address
 * @returns {Promise<object|null>} The audit record, or null if logging failed
 */
async function logAudit({
    adminEmail = '',
    action = '',
    entity = '',
    entityId = '',
    status = 'SUCCESS',
    details = '',
    ipAddress = ''
}) {
    const timestamp = new Date().toISOString();

    const record = {
        timestamp,
        adminEmail: String(adminEmail || 'Anonymous'),
        action: String(action || 'UNKNOWN'),
        entity: String(entity || 'UNKNOWN'),
        entityId: String(entityId || ''),
        status: String(status || 'SUCCESS'),
        details: String(details || ''),
        ipAddress: String(ipAddress || '')
    };

    // Store in-memory buffer (useful for inspection and test verification)
    recentAuditLogs.unshift(record);
    if (recentAuditLogs.length > MAX_BUFFER_SIZE) {
        recentAuditLogs.pop();
    }

    // Append to Google Sheets 'audit_log' tab
    try {
        if (simulatedFailureMode) {
            throw new Error("Simulated Google Sheets audit log outage");
        }

        const row = [
            record.timestamp,
            record.adminEmail,
            record.action,
            record.entity,
            record.entityId,
            record.status,
            record.details,
            record.ipAddress
        ];

        // Perform append operation
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'audit_log!A:H',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [row]
            }
        });

        return record;
    } catch (err) {
        // Log warning internally without interrupting the business operation
        console.warn("⚠️ Audit log warning (non-blocking):", err.message);
        return null;
    }
}

/**
 * Retrieve recent audit entries from in-memory cache
 */
function getRecentLogs() {
    return [...recentAuditLogs];
}

/**
 * Clear in-memory cache (for test isolation)
 */
function clearRecentLogs() {
    recentAuditLogs.length = 0;
}

/**
 * Set simulated failure mode (for failure-safety tests)
 */
function setSheetFailMode(enable) {
    simulatedFailureMode = Boolean(enable);
}

module.exports = {
    logAudit,
    getClientIp,
    getRecentLogs,
    clearRecentLogs,
    setSheetFailMode
};
