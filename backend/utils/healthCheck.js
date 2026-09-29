/**
 * Health Check & Monitoring Utility
 * VTAB Square Invoice Application
 *
 * Responsibilities:
 * - Verify application API process availability
 * - Perform lightweight, read-only Google Sheets connectivity verification
 * - Enforce non-blocking timeouts preventing monitoring hangs
 * - Sanitize technical errors internally without exposing secrets or paths
 * - Maintain zero interference with business operations and zero audit trail spam
 */

const { sheets, SPREADSHEET_ID } = require('../config/googleSheet');
const { logInternalError } = require('./securityUtils');

const DEFAULT_TIMEOUT_MS = 5000;
let simulatedFailure = false;

/**
 * Enable or disable simulated failure mode for automated testing
 *
 * @param {boolean} value
 */
function setSimulatedFailure(value) {
    simulatedFailure = Boolean(value);
}

/**
 * Check Google Sheets connectivity using a lightweight metadata query.
 * Reads ONLY spreadsheet title and ID fields, transferring minimal bytes and
 * zero cell rows/values.
 *
 * @param {object} [options]
 * @param {number} [options.timeoutMs=DEFAULT_TIMEOUT_MS]
 * @param {object} [options.req]
 * @returns {Promise<{ healthy: boolean, status: string, latencyMs?: number }>}
 */
async function checkGoogleSheetsHealth(options = {}) {
    if (simulatedFailure) {
        return {
            healthy: false,
            status: 'unavailable',
        };
    }

    if (!SPREADSHEET_ID) {
        return {
            healthy: false,
            status: 'unavailable',
        };
    }

    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    try {
        let timerId;
        const timeoutPromise = new Promise((_, reject) => {
            timerId = setTimeout(() => {
                reject(new Error(`Google Sheets health check timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        const checkPromise = sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'spreadsheetId,properties.title',
        });

        await Promise.race([checkPromise, timeoutPromise]);
        clearTimeout(timerId);

        const latencyMs = Date.now() - startTime;
        return {
            healthy: true,
            status: 'ok',
            latencyMs,
        };
    } catch (err) {
        // Log technical error details internally for operators/developers
        logInternalError(err, options.req);

        return {
            healthy: false,
            status: 'unavailable',
        };
    }
}

/**
 * Comprehensive health status collector for the application.
 *
 * @param {object} [options]
 * @returns {Promise<{ statusCode: number, payload: { status: string, timestamp: string, services: { api: string, googleSheets: string } } }>}
 */
async function getApplicationHealth(options = {}) {
    const timestamp = new Date().toISOString();
    const sheetsResult = await checkGoogleSheetsHealth(options);

    const isHealthy = sheetsResult.healthy === true;
    const overallStatus = isHealthy ? 'ok' : 'degraded';
    const statusCode = isHealthy ? 200 : 503;

    return {
        statusCode,
        payload: {
            status: overallStatus,
            timestamp,
            services: {
                api: 'ok',
                googleSheets: sheetsResult.status,
            },
        },
    };
}

module.exports = {
    checkGoogleSheetsHealth,
    getApplicationHealth,
    setSimulatedFailure,
    DEFAULT_TIMEOUT_MS,
};
