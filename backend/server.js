const express = require("express");
const cors = require("cors");
require("dotenv").config();

const adminRoutes = require("./routes/adminRoutes");
const path = require("path");
const { logInternalError, sanitizeErrorMessage } = require("./utils/securityUtils");
const { getApplicationHealth } = require("./utils/healthCheck");

const app = express();
const PORT = process.env.PORT || 5000;

// Security hardening: disable framework fingerprinting header
app.disable('x-powered-by');

// Hardened CORS configuration: restrict to authorized origins with local dev & test fallback
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:5000', 'http://localhost:5002'];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. curl, Node.js tests, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use("/api/admin", adminRoutes);

// Root routes
app.get("/", (req, res) => {
    res.send("VTAB Square Invoice API is running...");
});
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
if (process.env.NODE_ENV === "production" || process.env.SERVE_FRONTEND === "true") {
    const fs = require("fs");
    const frontendPath = path.join(__dirname, "../frontend/dist");

    if (fs.existsSync(frontendPath)) {
        app.use(express.static(frontendPath));

        // Catch-all route for SPA
        app.use((req, res) => {
            if (!req.path.startsWith("/api")) {
                const indexPath = path.join(frontendPath, "index.html");
                if (fs.existsSync(indexPath)) {
                    res.sendFile(indexPath);
                } else {
                    res.status(404).send("Frontend build not found");
                }
            }
        });
        console.log("🚀 Frontend static files are being served from:", frontendPath);
    } else {
        console.log("⚠️ Frontend distribution directory not found. Skipping static file serving.");
    }
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