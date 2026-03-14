const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");

/*
================================
 AUTH ROUTES
================================
*/

router.post("/login", adminController.loginAdmin);
router.post("/send-otp", adminController.sendOTP);
router.post("/verify-otp", adminController.verifyOTP);
router.post("/change-password", adminController.changePassword);


/*
================================
 CLIENT MANAGEMENT
================================
*/

// Get all clients
router.get("/clients", adminController.getClients);

// Create new client
router.post("/clients", adminController.addClient);

// Update client
router.put("/clients/:serialNo", adminController.updateClient);

// Delete client
router.delete("/clients/:serialNo", adminController.deleteClient);


/*
================================
 PROFILE MANAGEMENT
================================
*/

// Get all profiles
router.get("/profiles", adminController.getProfiles);

// Create profile
router.post("/profiles", adminController.addProfile);

// Update profile
router.put("/profiles/:serialNo", adminController.updateProfile);

// Delete profile
router.delete("/profiles/:serialNo", adminController.deleteProfile);


/*
================================
 INVOICE MANAGEMENT
================================
*/

// Get all invoices
router.get("/invoices", adminController.getInvoices);

// Create invoice
router.post("/invoices", adminController.addInvoice);

// Get single invoice
router.get("/invoices/:serialNo", adminController.getInvoiceBySerial);

// Update invoice
router.put("/invoices/:serialNo", adminController.updateInvoice);

// Delete invoice
router.delete("/invoices/:serialNo", adminController.deleteInvoice);


/*
================================
 EXPORT ROUTER
================================
*/

module.exports = router;