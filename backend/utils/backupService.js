/**
 * Backup and Recovery Service
 * VTAB Square Invoice Application
 *
 * Responsibilities:
 * - Read-only snapshot extraction from Google Sheets business tabs using efficient batchGet
 * - Faithful preservation of headers, row counts, and cell values
 * - Timestamped, non-overwriting JSON and optional CSV file export
 * - Exclusion of sensitive credentials, password hashes, and secrets
 * - Atomic file creation preventing partial/corrupt backup files
 */

const fs = require('fs');
const path = require('path');
const { sheets, SPREADSHEET_ID } = require('../config/googleSheet');

// Default business tabs required for application data recovery
const DEFAULT_BUSINESS_TABS = [
    'Client',
    'profile',
    'invoice header',
    'invoice details',
    'audit_log'
];

// Tabs strictly prohibited from backup to prevent secret/credential exposure
const PROHIBITED_TABS = [
    'admin login',
    'workspace login',
    'users'
];

// Default local backup storage directory (not served publicly)
const DEFAULT_BACKUP_DIR = path.join(__dirname, '../backups');

/**
 * Generate formatted timestamp string for filenames: YYYYMMDD_HHmmss
 * E.g., 20260929_143000
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function getTimestampString(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

/**
 * Format a single cell value for standard RFC 4180 CSV export
 *
 * @param {any} value
 * @returns {string}
 */
function formatCsvCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Convert sheet headers and rows into RFC 4180 compliant CSV string
 *
 * @param {Array<string>} headers
 * @param {Array<Array<any>>} rows
 * @returns {string}
 */
function convertSheetToCsv(headers = [], rows = []) {
    const headerLine = headers.map(formatCsvCell).join(',');
    const dataLines = rows.map((row) => {
        if (!Array.isArray(row)) return '';
        const rowCells = [];
        const maxLen = Math.max(headers.length, row.length);
        for (let i = 0; i < maxLen; i++) {
            rowCells.push(formatCsvCell(row[i] ?? ''));
        }
        return rowCells.join(',');
    });
    return [headerLine, ...dataLines].join('\r\n');
}

/**
 * Ensure a unique filename in target directory by appending _1, _2 if needed.
 * Prevents overwriting any prior backups.
 *
 * @param {string} dirPath
 * @param {string} baseName
 * @param {string} extension
 * @returns {string} Unique filename
 */
function getNonOverwritingFilename(dirPath, baseName, extension) {
    let filename = `${baseName}.${extension}`;
    let counter = 1;
    while (fs.existsSync(path.join(dirPath, filename))) {
        filename = `${baseName}_${counter}.${extension}`;
        counter++;
    }
    return filename;
}

/**
 * Fetch all requested tabs in a single batch request to minimize Google Sheets API quota consumption.
 * Includes automatic retry on 429 quota limits.
 *
 * @param {string[]} tabs
 * @param {string} spreadsheetId
 * @returns {Promise<Object.<string, { headers: string[], rows: any[][], rowCount: number }>>}
 */
async function fetchAllSheetsBatch(tabs, spreadsheetId = SPREADSHEET_ID) {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            const response = await sheets.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges: tabs,
            });

            const valueRanges = response.data?.valueRanges || [];
            const result = {};

            for (let i = 0; i < tabs.length; i++) {
                const tabName = tabs[i];
                const vr = valueRanges[i];
                const values = vr?.values || [];
                const headers = values.length > 0 ? [...values[0]] : [];
                const rows = values.length > 1 ? values.slice(1).map((r) => [...r]) : [];
                result[tabName] = {
                    headers,
                    rows,
                    rowCount: rows.length,
                };
            }

            return result;
        } catch (err) {
            const isQuotaError = err?.code === 429 || err?.message?.includes('Quota exceeded') || err?.status === 'RESOURCE_EXHAUSTED';
            if (isQuotaError && attempts < maxAttempts) {
                // Exponential backoff wait (1.5s, 3s)
                const waitMs = attempts * 1500;
                await new Promise((resolve) => setTimeout(resolve, waitMs));
                continue;
            }
            throw err;
        }
    }
}

/**
 * Create a timestamped, non-overwriting backup of business data
 *
 * @param {object} [options]
 * @param {Array<string>} [options.tabNames] - Specific tabs to back up (defaults to DEFAULT_BUSINESS_TABS)
 * @param {string} [options.backupDir] - Directory to write backups (defaults to DEFAULT_BACKUP_DIR)
 * @param {boolean} [options.includeCsv=false] - Also export individual sheet CSV files
 * @param {string} [options.spreadsheetId=SPREADSHEET_ID]
 * @returns {Promise<{ success: boolean, filename: string, createdAt: string, summary: object, files: string[] }>}
 */
async function createBackup(options = {}) {
    const backupDir = options.backupDir || DEFAULT_BACKUP_DIR;
    const includeCsv = options.includeCsv === true;
    const spreadsheetId = options.spreadsheetId || SPREADSHEET_ID;

    // Filter requested tabs: only allow business tabs, reject prohibited/sensitive tabs
    let requestedTabs = options.tabNames && Array.isArray(options.tabNames) && options.tabNames.length > 0
        ? options.tabNames
        : DEFAULT_BUSINESS_TABS;

    const safeTabs = requestedTabs.filter((tab) => {
        const lower = tab.toLowerCase().trim();
        return !PROHIBITED_TABS.some((prohibited) => lower.includes(prohibited.toLowerCase())) &&
            !lower.includes('password') &&
            !lower.includes('secret') &&
            !lower.includes('credential');
    });

    if (safeTabs.length === 0) {
        throw new Error('No valid business tabs selected for backup.');
    }

    // Ensure local backup directory exists
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const timestampStr = getTimestampString(now);

    // Fetch all business sheets in a single optimized batch API request
    const sheetsData = await fetchAllSheetsBatch(safeTabs, spreadsheetId);

    const sheetCounts = {};
    let totalRows = 0;

    for (const tabName of safeTabs) {
        const sheet = sheetsData[tabName];
        sheetCounts[tabName] = sheet.rowCount;
        totalRows += sheet.rowCount;
    }

    // Construct full backup snapshot payload
    const backupPayload = {
        backupVersion: '1.0',
        createdAt,
        source: 'Google Sheets',
        sheetNames: safeTabs,
        sheets: sheetsData,
        summary: {
            totalSheets: safeTabs.length,
            totalRows,
            sheetCounts,
        },
    };

    // Determine non-overwriting JSON filename
    const jsonBaseName = `backup_${timestampStr}`;
    const jsonFilename = getNonOverwritingFilename(backupDir, jsonBaseName, 'json');
    const jsonFinalPath = path.join(backupDir, jsonFilename);
    const jsonTempPath = path.join(backupDir, `${jsonFilename}.tmp`);

    const createdFiles = [];

    try {
        // Atomic JSON file write: write to temp file then rename
        fs.writeFileSync(jsonTempPath, JSON.stringify(backupPayload, null, 2), 'utf8');
        fs.renameSync(jsonTempPath, jsonFinalPath);
        createdFiles.push(jsonFilename);

        // Optional CSV export
        if (includeCsv) {
            for (const tabName of safeTabs) {
                const sheet = sheetsData[tabName];
                const sanitizedTabName = tabName.replace(/[^a-zA-Z0-9_-]/g, '_');
                const csvBaseName = `${jsonBaseName}_${sanitizedTabName}`;
                const csvFilename = getNonOverwritingFilename(backupDir, csvBaseName, 'csv');
                const csvFinalPath = path.join(backupDir, csvFilename);
                const csvTempPath = path.join(backupDir, `${csvFilename}.tmp`);

                const csvContent = convertSheetToCsv(sheet.headers, sheet.rows);
                fs.writeFileSync(csvTempPath, csvContent, 'utf8');
                fs.renameSync(csvTempPath, csvFinalPath);
                createdFiles.push(csvFilename);
            }
        }
    } catch (writeErr) {
        // Cleanup partial temp files on failure
        if (fs.existsSync(jsonTempPath)) {
            try { fs.unlinkSync(jsonTempPath); } catch (_) {}
        }
        throw new Error(`Failed to write backup snapshot: ${writeErr.message}`);
    }

    return {
        success: true,
        filename: jsonFilename,
        createdAt,
        summary: {
            totalSheets: safeTabs.length,
            totalRows,
            sheetCounts,
        },
        files: createdFiles,
    };
}

/**
 * List all available backups in the backup directory
 *
 * @param {string} [backupDir=DEFAULT_BACKUP_DIR]
 * @returns {Array<{ filename: string, size: number, createdAt: Date }>}
 */
function listBackups(backupDir = DEFAULT_BACKUP_DIR) {
    if (!fs.existsSync(backupDir)) {
        return [];
    }

    const entries = fs.readdirSync(backupDir);
    const backups = [];

    for (const filename of entries) {
        if (filename.endsWith('.json') && !filename.endsWith('.tmp')) {
            const filePath = path.join(backupDir, filename);
            try {
                const stat = fs.statSync(filePath);
                backups.push({
                    filename,
                    size: stat.size,
                    createdAt: stat.birthtime || stat.mtime,
                });
            } catch (_) {}
        }
    }

    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Retrieve a specific backup file's parsed JSON content safely
 *
 * @param {string} filename
 * @param {string} [backupDir=DEFAULT_BACKUP_DIR]
 * @returns {object|null}
 */
function getBackupContent(filename, backupDir = DEFAULT_BACKUP_DIR) {
    // Validate filename to prevent directory traversal
    if (!filename || typeof filename !== 'string' || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid backup filename.');
    }

    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

module.exports = {
    DEFAULT_BUSINESS_TABS,
    PROHIBITED_TABS,
    DEFAULT_BACKUP_DIR,
    getTimestampString,
    formatCsvCell,
    convertSheetToCsv,
    getNonOverwritingFilename,
    fetchAllSheetsBatch,
    createBackup,
    listBackups,
    getBackupContent,
};
