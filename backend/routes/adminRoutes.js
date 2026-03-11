const express = require("express");
const router = express.Router();
const {
    loginAdmin,
    sendOTP,
    verifyOTP,
    changePassword,
    getClients,
    addClient,
    updateClient,
    deleteClient,
    getProfiles,
    addProfile,
    updateProfile,
    deleteProfile,
    addInvoice,
    getInvoices,
    getInvoiceBySerial,
    updateInvoice,
    deleteInvoice
} = require("../controllers/adminController");

router.post("/login", loginAdmin);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/change-password", changePassword);

// Client management
router.get("/clients", getClients);
router.post("/clients", addClient);
router.put("/clients/:serialNo", updateClient);
router.delete("/clients/:serialNo", deleteClient);

// Profile management
router.get("/profiles", getProfiles);
router.post("/profiles", addProfile);
router.put("/profiles/:serialNo", updateProfile);
router.delete("/profiles/:serialNo", deleteProfile);

// Invoice management
router.get("/invoices", getInvoices);
router.post("/invoices", addInvoice);
router.get("/invoices/:serialNo", getInvoiceBySerial);
router.put("/invoices/:serialNo", updateInvoice);
router.delete("/invoices/:serialNo", deleteInvoice);

module.exports = router;
