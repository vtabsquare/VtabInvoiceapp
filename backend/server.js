const express = require("express");
const cors = require("cors");
require("dotenv").config();

const adminRoutes = require("./routes/adminRoutes");

const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/admin", adminRoutes);

// Serving Frontend static files in production
if (process.env.NODE_ENV === "production") {
    const frontendPath = path.join(__dirname, "../frontend/dist");
    app.use(express.static(frontendPath));
    
    app.get("*", (req, res) => {
        if (!req.path.startsWith("/api")) {
            res.sendFile(path.join(frontendPath, "index.html"));
        }
    });
}

app.get("/", (req, res) => {
    res.send("VTAB Square Invoice API is running...");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
