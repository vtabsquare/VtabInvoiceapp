// Lightweight in-memory rate limiter for login attempts
const loginAttempts = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const MAX_ATTEMPTS = 5; // 5 failed attempts allowed before temporary lockout

function getClientIdentifier(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
    return ip;
}

function checkRateLimit(req, res, next) {
    const clientId = getClientIdentifier(req);
    const now = Date.now();
    const record = loginAttempts.get(clientId);

    if (record) {
        if (now < record.resetTime) {
            if (record.count >= MAX_ATTEMPTS) {
                const remainingMinutes = Math.max(1, Math.ceil((record.resetTime - now) / 60000));
                return res.status(429).json({
                    message: `Too many failed login attempts. Please try again after ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`
                });
            }
        } else {
            // Window expired, reset
            loginAttempts.delete(clientId);
        }
    }

    next();
}

function recordFailedAttempt(req) {
    const clientId = getClientIdentifier(req);
    const now = Date.now();
    const record = loginAttempts.get(clientId);

    if (!record || now >= record.resetTime) {
        loginAttempts.set(clientId, {
            count: 1,
            resetTime: now + WINDOW_MS
        });
    } else {
        record.count += 1;
    }
}

function resetAttempts(req) {
    const clientId = getClientIdentifier(req);
    loginAttempts.delete(clientId);
}

// Rate limiter for OTP operations (send-otp, verify-otp)
const otpAttempts = new Map();
const OTP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const MAX_OTP_ATTEMPTS = 10; // 10 attempts allowed per 15 minutes

function checkOtpRateLimit(req, res, next) {
    const clientId = getClientIdentifier(req);
    const now = Date.now();
    const record = otpAttempts.get(clientId);

    if (record) {
        if (now < record.resetTime) {
            if (record.count >= MAX_OTP_ATTEMPTS) {
                const remainingMinutes = Math.max(1, Math.ceil((record.resetTime - now) / 60000));
                return res.status(429).json({
                    message: `Too many OTP requests. Please try again after ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`
                });
            }
        } else {
            otpAttempts.delete(clientId);
        }
    }

    // Count attempt
    if (!record || now >= record.resetTime) {
        otpAttempts.set(clientId, { count: 1, resetTime: now + OTP_WINDOW_MS });
    } else {
        record.count += 1;
    }

    next();
}

function resetOtpAttempts(req) {
    const clientId = getClientIdentifier(req);
    otpAttempts.delete(clientId);
}

// Periodic cleanup of stale entries (every 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of loginAttempts.entries()) {
        if (now >= record.resetTime) {
            loginAttempts.delete(key);
        }
    }
    for (const [key, record] of otpAttempts.entries()) {
        if (now >= record.resetTime) {
            otpAttempts.delete(key);
        }
    }
}, 10 * 60 * 1000).unref();

module.exports = {
    checkRateLimit,
    recordFailedAttempt,
    resetAttempts,
    loginAttempts,
    checkOtpRateLimit,
    resetOtpAttempts,
    otpAttempts,
    MAX_ATTEMPTS,
    WINDOW_MS,
    MAX_OTP_ATTEMPTS,
    OTP_WINDOW_MS
};
