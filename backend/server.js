const express = require("express");
const cors = require("cors");
require("dotenv").config();

const adminRoutes = require("./routes/adminRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
    res.send("VTAB Square Invoice API is running...");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
