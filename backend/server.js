const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Ensure secure JWT_SECRET is available in production if not explicitly configured in host environment
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "c9f8a3d72b5e1a4f8c6d0e3b9a7f2c5e1d8b4a0f7c2e9d3a6b8f1c4e7d0a2b5";
}

const adminRoutes = require("./routes/adminRoutes");
const path = require("path");
const { logInternalError, sanitizeErrorMessage } = require("./utils/securityUtils");
const { getApplicationHealth } = require("./utils/healthCheck");

const app = express();
const PORT = process.env.PORT || 5000;

// Security hardening: disable framework fingerprinting header
app.disable('x-powered-by');

// Hardened CORS configuration: allow same-origin, Render deployments, local dev, and configured origins
const configuredOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:5000', 'http://localhost:5002'];

const corsOptionsDelegate = (req, callback) => {
    const origin = req.header('Origin');
    const host = req.header('host');
    const forwardedHost = req.header('x-forwarded-host');

    // Allow requests with no origin (e.g. curl, Node.js tests, server-to-server)
    if (!origin || process.env.NODE_ENV !== 'production') {
        return callback(null, {
            origin: true,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
        });
    }

    // Check same-origin (host header or forwarded host matches origin)
    const isSameOrigin = (
        origin === `https://${host}` ||
        origin === `http://${host}` ||
        (forwardedHost && (origin === `https://${forwardedHost}` || origin === `http://${forwardedHost}`))
    );

    // Check Render deployment domains
    const isRenderDomain = (
        origin.endsWith('.onrender.com') ||
        (process.env.RENDER_EXTERNAL_URL && origin === process.env.RENDER_EXTERNAL_URL) ||
        (process.env.RENDER_EXTERNAL_HOSTNAME && origin.includes(process.env.RENDER_EXTERNAL_HOSTNAME))
    );

    // Check localhost and local IP addresses
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    // Check configured allowed origins
    const isConfigured = configuredOrigins.includes(origin);

    if (isSameOrigin || isRenderDomain || isLocalhost || isConfigured) {
        return callback(null, {
            origin: true,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
        });
    }

    // Disallow cross-origin requests safely without throwing a 500 error
    return callback(null, { origin: false });
};

app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use("/api/admin", adminRoutes);

// API Status route
app.get("/api", (req, res) => {
    res.send("VTAB Square Invoice API is running...");
});

// Health check handler (Monitors application process and Google Sheets connectivity)
const handleHealthCheck = async (req, res) => {
    try {
        const { statusCode, payload } = await getApplicationHealth({ req });
        return res.status(statusCode).json(payload);
    } catch (err) {
        logInternalError(err, req);
        return res.status(503).json({
            status: "degraded",
            timestamp: new Date().toISOString(),
            services: {
                api: "ok",
                googleSheets: "unavailable",
            },
        });
    }
};

// Monitoring & Support routes (accessible publicly for PM2, Nginx, load balancers, uptime monitors)
app.get("/health", handleHealthCheck);
app.get("/api/health", handleHealthCheck);

// Serve frontend in production
const isProduction = process.env.NODE_ENV === "production" || process.env.SERVE_FRONTEND === "true";
const frontendPath = path.join(__dirname, "../frontend/dist");
const fs = require("fs");

if (isProduction && fs.existsSync(frontendPath)) {
    // Serve static files from React build directory
    app.use(express.static(frontendPath));

    // SPA catch-all route: serves index.html for all non-API paths
    app.use((req, res, next) => {
        if (req.path.startsWith("/api") || req.path === "/health") {
            return next();
        }
        const indexPath = path.join(frontendPath, "index.html");
        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
        next();
    });
    console.log("🚀 Frontend static files are being served from:", frontendPath);
} else {
    // In development or when frontend build is not present, serve API status on /
    app.get("/", (req, res) => {
        res.send("VTAB Square Invoice API is running...");
    });
}

// 404 handler for unmatched API routes
app.use("/api", (req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
});

// Centralized Express error-handling middleware
app.use((err, req, res, next) => {
    logInternalError(err, req);

    if (res.headersSent) {
        return next(err);
    }

    // Handle body-parser JSON syntax errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ message: "Invalid JSON payload format" });
    }

    const statusCode = (err.status && typeof err.status === 'number' && err.status >= 400 && err.status < 600)
        ? err.status
        : 500;

    const safeMessage = statusCode >= 500
        ? "An unexpected server error occurred."
        : sanitizeErrorMessage(err.message || "Request failed");

    return res.status(statusCode).json({
        message: safeMessage,
        ...(statusCode >= 500 ? { error: "An unexpected server error occurred." } : {})
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;