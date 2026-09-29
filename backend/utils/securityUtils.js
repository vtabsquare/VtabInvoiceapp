/**
 * Security and Data Protection Utilities
 * VTAB Square Invoice Application
 */

/**
 * Sanitize error messages returned in API responses to prevent accidental
 * leakage of server filesystem paths, credentials, and tokens.
 *
 * @param {Error|string} err
 * @returns {string} Sanitized error message safe for client exposure
 */
function sanitizeErrorMessage(err) {
    if (!err) return "An unexpected error occurred";
    let msg = typeof err === "string" ? err : (err.message || "An unexpected error occurred");

    // Mask Windows absolute filesystem paths (e.g. C:\Users\... or D:\projects\...)
    msg = msg.replace(/[A-Za-z]:\\[^\s:;,"]+/g, "[server path]");

    // Mask POSIX absolute filesystem paths (e.g. /var/www/... or /home/...)
    msg = msg.replace(/(?:^|\s)\/(?:[a-zA-Z0-9._-]+\/)+[a-zA-Z0-9._-]+/g, " [server path]");

    // Mask sensitive environment secrets if present in error message
    const secretsToRedact = [
        process.env.JWT_SECRET,
        process.env.BREVO_API_KEY,
        process.env.RESEND_API_KEY,
        process.env.EMAIL_PASS,
        process.env.SPREADSHEET_ID,
    ].filter(Boolean);

    for (const secret of secretsToRedact) {
        if (secret && secret.length > 5 && msg.includes(secret)) {
            msg = msg.split(secret).join("[REDACTED]");
        }
    }

    // Mask Bearer tokens
    msg = msg.replace(/Bearer\s+[a-zA-Z0-9._\-]+/gi, "Bearer [REDACTED]");

    // Mask private keys (PKCS#8, PKCS#1 RSA, EC, etc.)
    msg = msg.replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/gi, "[REDACTED PRIVATE KEY]");

    return msg;
}

/**
 * Sanitize arbitrary text for internal developer logging (removes sensitive tokens and credentials)
 *
 * @param {string} text
 * @returns {string}
 */
function sanitizeLogText(text) {
    if (!text || typeof text !== 'string') return text;
    let sanitized = sanitizeErrorMessage(text);

    // Redact password and secret fields (specific terms first, with boundary guards)
    sanitized = sanitized.replace(/(^|[^a-zA-Z0-9_])"?newPassword"?\s*[:=]\s*"?[^",\s\r\n}]+/gi, '$1"newPassword": "[REDACTED]"');
    sanitized = sanitized.replace(/(^|[^a-zA-Z0-9_])"?password"?\s*[:=]\s*"?[^",\s\r\n}]+/gi, '$1"password": "[REDACTED]"');
    sanitized = sanitized.replace(/(^|[^a-zA-Z0-9_])"?otp"?\s*[:=]\s*"?[^",\s\r\n}]+/gi, '$1"otp": "[REDACTED]"');
    sanitized = sanitized.replace(/Authorization\s*:\s*Bearer\s+[a-zA-Z0-9._\-]+/gi, 'Authorization: Bearer [REDACTED]');

    return sanitized;
}

/**
 * Log technical error details internally for operators/developers
 * without exposing sensitive user credentials or tokens.
 *
 * @param {Error|any} err
 * @param {object} [req]
 */
function logInternalError(err, req) {
    const timestamp = new Date().toISOString();
    const method = req?.method || 'INTERNAL';
    const originalUrl = req?.originalUrl || req?.url || 'N/A';
    const adminEmail = req?.user?.email || 'Unauthenticated';
    const errType = err?.name || 'Error';
    const rawMessage = err?.message || String(err || 'Unknown error');
    const sanitizedMsg = sanitizeErrorMessage(rawMessage);
    const sanitizedStack = err?.stack ? sanitizeLogText(err.stack) : undefined;

    console.error(`[${timestamp}] [ERROR] ${method} ${originalUrl} | User: ${adminEmail} | Type: ${errType} | Message: ${sanitizedMsg}`);
    if (sanitizedStack) {
        console.error(`[${timestamp}] [STACK]`, sanitizedStack);
    }
}

/**
 * Standardized server-side error handler for controller catch blocks
 * Logs the technical error internally and returns a safe HTTP 500 response.
 *
 * @param {object} res - Express response object
 * @param {Error|any} err - Caught error
 * @param {object} [req] - Express request object
 * @param {string} [fallbackMessage="An unexpected server error occurred."] - Safe user-facing message
 */
function handleServerError(res, err, req, fallbackMessage = "An unexpected server error occurred.") {
    logInternalError(err, req);
    return res.status(500).json({
        message: fallbackMessage,
        error: fallbackMessage
    });
}

module.exports = {
    sanitizeErrorMessage,
    sanitizeLogText,
    logInternalError,
    handleServerError,
};
