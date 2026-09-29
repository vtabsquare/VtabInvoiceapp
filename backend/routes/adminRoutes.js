const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { checkRateLimit, checkOtpRateLimit } = require("../utils/loginRateLimiter");
const { authenticateToken } = require("../middleware/auth");

/*
================================
 AUTH ROUTES
================================
*/

router.post("/login", checkRateLimit, adminController.loginAdmin);
router.post("/logout", authenticateToken, adminController.logoutAdmin);
router.post("/send-otp", checkOtpRateLimit, adminController.sendOTP);
router.post("/verify-otp", checkOtpRateLimit, adminController.verifyOTP);
router.post("/change-password", checkOtpRateLimit, adminController.changePassword);


/*
================================
 CLIENT MANAGEMENT (Protected)
================================
*/

// Get all clients
router.get("/clients", authenticateToken, adminController.getClients);

// Create new client
router.post("/clients", authenticateToken, adminController.addClient);

// Update client
router.put("/clients/:serialNo", authenticateToken, adminController.updateClient);

// Delete client
router.delete("/clients/:serialNo", authenticateToken, adminController.deleteClient);


/*
================================
 PROFILE MANAGEMENT (Protected)
================================
*/

// Get all profiles
router.get("/profiles", authenticateToken, adminController.getProfiles);

// Create profile
router.post("/profiles", authenticateToken, adminController.addProfile);

// Update profile
router.put("/profiles/:serialNo", authenticateToken, adminController.updateProfile);

// Delete profile
router.delete("/profiles/:serialNo", authenticateToken, adminController.deleteProfile);


/*
================================
 INVOICE MANAGEMENT (Protected)
================================
*/

// Get all invoices
router.get("/invoices", authenticateToken, adminController.getInvoices);

// Create invoice
router.post("/invoices", authenticateToken, adminController.addInvoice);

// Get single invoice
router.get("/invoices/:serialNo", authenticateToken, adminController.getInvoiceBySerial);

// Update invoice
router.put("/invoices/:serialNo", authenticateToken, adminController.updateInvoice);

// Delete invoice
router.delete("/invoices/:serialNo", authenticateToken, adminController.deleteInvoice);

// Update status
router.patch("/invoices/:serialNo/status", authenticateToken, adminController.updateInvoiceStatuses);

// Send Email
router.post("/invoice/send-email", authenticateToken, adminController.sendInvoiceEmail);

/*
================================
 BACKUP & RECOVERY (Protected)
================================
*/

// Create timestamped backup export
router.post("/backup", authenticateToken, adminController.createBackup);

// List available backups
router.get("/backups", authenticateToken, adminController.listBackups);

/*
================================
 EXPORT ROUTER
================================
*/

module.exports = router;