const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error("❌ CRITICAL: JWT_SECRET environment variable is missing.");
        return res.status(500).json({ message: "Authentication configuration error" });
    }

    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    
    if (!authHeader) {
        return res.status(401).json({ message: "Authorization token required" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({ message: "Invalid authorization format. Format must be 'Bearer <token>'" });
    }

    const token = parts[1];

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Token expired. Please login again." });
            }
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        req.user = decoded;
        next();
    });
}

module.exports = {
    authenticateToken,
    get JWT_SECRET() {
        return process.env.JWT_SECRET;
    }
};
