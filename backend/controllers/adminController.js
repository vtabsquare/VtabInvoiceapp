const { sheets, drive, SPREADSHEET_ID } = require("../config/googleSheet");
const otpGenerator = require("otp-generator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { recordFailedAttempt, resetAttempts } = require("../utils/loginRateLimiter");
const { JWT_SECRET } = require("../middleware/auth");
const { sanitizeErrorMessage, handleServerError, logInternalError } = require("../utils/securityUtils");
const { logAudit, getClientIp } = require("../utils/auditService");
const {
    isValidIdentifier,
    validateClientInput,
    validateProfileInput,
    validateInvoiceInput,
} = require("../utils/validators");
const backupService = require("../utils/backupService");
// Resend removed, migrated to Brevo API explicitly requested by user

const otpStore = {};

//login

exports.loginAdmin = async (req, res) => {

    const { email, password } = req.body;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "admin login!A2:B",
        });

        const rows = response.data.values || [];
        const adminIndex = rows.findIndex((row) => row[0] === email);
        const adminRow = adminIndex !== -1 ? rows[adminIndex] : null;

        if (!adminRow) {
            recordFailedAttempt(req);
            await logAudit({
                adminEmail: email || 'Unknown',
                action: 'LOGIN',
                entity: 'AUTH',
                status: 'FAILED',
                details: 'Invalid credentials - account not found',
                ipAddress: getClientIp(req)
            });
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const storedPassword = adminRow[1] || "";
        const isBcrypt = typeof storedPassword === 'string' && /^\$2[abyx]\$\d{2}\$/.test(storedPassword) && storedPassword.length === 60;

        let isMatch = false;
        let needsMigration = false;

        if (isBcrypt) {
            isMatch = await bcrypt.compare(password, storedPassword);
        } else {
            // Backward-compatible comparison for legacy plain text passwords
            isMatch = (password === storedPassword);
            if (isMatch) {
                needsMigration = true;
            }
        }

        if (!isMatch) {
            recordFailedAttempt(req);
            await logAudit({
                adminEmail: email || 'Unknown',
                action: 'LOGIN',
                entity: 'AUTH',
                status: 'FAILED',
                details: 'Invalid credentials - incorrect password',
                ipAddress: getClientIp(req)
            });
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Login successful: reset rate limiter for this client
        resetAttempts(req);

        // Auto-migrate legacy plain text password to bcrypt hash in the Google Sheet
        if (needsMigration) {
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `admin login!B${adminIndex + 2}`,
                    valueInputOption: "RAW",
                    requestBody: {
                        values: [[hashedPassword]],
                    },
                });
                console.log(`✅ Admin password for ${email} automatically migrated to bcrypt hash.`);
            } catch (migrateErr) {
                console.error("Auto-migration warning:", migrateErr.message);
                // Do not block login if sheet update encountered a momentary issue
            }
        }

        const jwtSecret = process.env.JWT_SECRET || JWT_SECRET || "c9f8a3d72b5e1a4f8c6d0e3b9a7f2c5e1d8b4a0f7c2e9d3a6b8f1c4e7d0a2b5";
        if (!jwtSecret) {
            console.error("❌ CRITICAL: JWT_SECRET environment variable is missing.");
            return res.status(500).json({ message: "Authentication configuration error", error: "Authentication configuration error" });
        }

        const token = jwt.sign(
            { email: adminRow[0], role: "admin" },
            jwtSecret,
            { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
        );

        await logAudit({
            adminEmail: adminRow[0],
            action: 'LOGIN',
            entity: 'AUTH',
            status: 'SUCCESS',
            details: 'Admin login successful',
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Login success", email: adminRow[0], token });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

// LOGOUT
exports.logoutAdmin = async (req, res) => {
    const adminEmail = req.user?.email || 'Admin';
    await logAudit({
        adminEmail,
        action: 'LOGOUT',
        entity: 'AUTH',
        status: 'SUCCESS',
        details: 'Admin logged out',
        ipAddress: getClientIp(req)
    });
    res.json({ message: "Logout successful" });
};


// SEND OTP
exports.sendOTP = async (req, res) => {
    const { email } = req.body;

    try {
        // Check email exists
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "admin login!A2:A",
        });

        const rows = response.data.values || [];
        const emailExists = rows.some((row) => row[0] === email);

        if (!emailExists) {
            return res.status(404).json({ message: "Email not found in admin records" });
        }

        // Generate OTP
        const otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false,
        });

        // Store OTP
        otpStore[email] = {
            otp,
            expires: Date.now() + 10 * 60 * 1000,
        };

        console.log(`Password reset OTP dispatched for ${email}`);

        // Send Email using Brevo REST API
        const https = require('https');
        const payloadString = JSON.stringify({
            sender: { name: "VTAB Square", email: process.env.EMAIL_USER },
            to: [{ email: email }],
            subject: "🔐 Your OTP — VTAB Square Invoice",
            htmlContent: `
                <div style="font-family: Inter, sans-serif; max-width:480px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px">
                    <h2>Password Reset OTP</h2>
                    <p>Your verification code is:</p>
                    <h1 style="letter-spacing:6px; color: #0f172a;">${otp}</h1>
                    <p>This OTP will expire in 10 minutes.</p>
                    <hr style="border:0;border-top:1px solid #eee;margin:20px 0">
                    <p style="color:#666;font-size:12px">VTAB Square Invoice</p>
                </div>
            `
        });

        const options = {
            hostname: 'api.brevo.com',
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                "api-key": process.env.BREVO_API_KEY,
                "Content-Type": "application/json",
                "accept": "application/json",
                "Content-Length": Buffer.byteLength(payloadString)
            }
        };

        await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`Brevo Error ${res.statusCode}: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payloadString);
            req.end();
        });

        res.json({ message: "OTP sent successfully to your email" });

    } catch (error) {
        return handleServerError(res, error, req, "Failed to send verification OTP");
    }
};

// SEND INVOICE EMAIL
exports.sendInvoiceEmail = async (req, res) => {
    const { invoiceNo, clientEmail, pdfBase64, clientName, toEmails, ccEmails, bccEmails, subject, content } = req.body;

    // We either need clientEmail (old way) or toEmails (new way)
    if (!invoiceNo || (!clientEmail && !toEmails) || !pdfBase64 || !clientName) {
        return res.status(400).json({ message: "Missing required fields for email." });
    }

    try {
        const parseEmails = (emails) => {
            if (!emails) return [];
            if (Array.isArray(emails)) return emails.map(e => ({ email: e.trim() }));
            return emails.split(",").map(e => ({ email: e.trim() })).filter(e => e.email !== "");
        };

        const to = toEmails ? parseEmails(toEmails) : [{ email: clientEmail }];
        const cc = parseEmails(ccEmails);
        const bcc = parseEmails(bccEmails);

        console.log(`\n📧 Sending invoice #${invoiceNo} to ${to.length} recipients...`);
        
        // Strip data: URI prefix to get raw base64 string
        let base64Data = pdfBase64;
        if (pdfBase64.includes(",")) {
            base64Data = pdfBase64.split(",")[1];
        }
        
        const pdfBuffer = Buffer.from(base64Data, 'base64');
        console.log(`📊 PDF Buffer Size: ${pdfBuffer.length} bytes`);

        if (pdfBuffer.length < 1000) {
            console.error("❌ ERROR: Generated PDF is corrupt or empty (less than 1KB).");
            return res.status(400).json({ error: "PDF generation failed on client. Please try closing and reopening the preview." });
        }

        // Use Brevo REST API
        const brevoPayload = {
            sender: { name: "VTAB Square", email: process.env.EMAIL_USER },
            to: to,
            cc: cc.length > 0 ? cc : undefined,
            bcc: bcc.length > 0 ? bcc : undefined,
            subject: subject || `Invoice #${invoiceNo} from VTAB Square - ${new Date().toLocaleTimeString()}`,
            htmlContent: content || `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <p>Hello ${clientName},</p>
                    <p>Please find attached your invoice (<strong>#${invoiceNo}</strong>).</p>
                    <p>If you have any questions, feel free to reply to this email.</p>
                    <br/>
                    <p>Regards,<br/><strong>VTAB Square Private Limited</strong></p>
                </div>
            `,
            attachment: [
                {
                    name: `Invoice_${invoiceNo}.pdf`,
                    content: base64Data
                }
            ]
        };

        // Use native HTTPS to avoid Node.js fetch memory bloat/socket reset bugs
        const https = require('https');
        
        const payloadString = JSON.stringify(brevoPayload);
        const options = {
            hostname: 'api.brevo.com',
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                "api-key": process.env.BREVO_API_KEY,
                "Content-Type": "application/json",
                "accept": "application/json",
                "Content-Length": Buffer.byteLength(payloadString)
            }
        };

        const responseData = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`Brevo Error: ${parsed.message || data}`));
                        }
                    } catch (e) {
                         reject(new Error(`Brevo Error ${res.statusCode}: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payloadString);
            req.end();
        });

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'SEND_EMAIL',
            entity: 'INVOICE',
            entityId: String(invoiceNo || ''),
            status: 'SUCCESS',
            details: `Invoice email dispatched to ${to.length} recipient(s)`,
            ipAddress: getClientIp(req)
        });

        console.log(`✅ Successfully sent email via Brevo. Message ID: ${responseData?.messageId}`);
        res.json({ message: "Email sent successfully!" });
    } catch (err) {
        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'SEND_EMAIL',
            entity: 'INVOICE',
            entityId: String(invoiceNo || ''),
            status: 'FAILED',
            details: 'Invoice email dispatch failed',
            ipAddress: getClientIp(req)
        });
        return handleServerError(res, err, req, "Failed to send invoice email");
    }
};

// VERIFY OTP
exports.verifyOTP = (req, res) => {
    const { email, otp } = req.body;

    const storedData = otpStore[email];

    if (!storedData || storedData.otp !== otp || Date.now() > storedData.expires) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    res.json({ message: "OTP verified successfully" });
};


// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    const storedData = otpStore[email];

    if (!storedData || storedData.otp !== otp || Date.now() > storedData.expires) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "admin login!A2:A",
        });

        const rows = response.data.values || [];
        const index = rows.findIndex((row) => row[0] === email);

        if (index === -1) {
            return res.status(404).json({ message: "Email not found" });
        }

        // Store new password securely as a bcrypt hash
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `admin login!B${index + 2}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[hashedPassword]],
            },
        });

        delete otpStore[email];

        await logAudit({
            adminEmail: email,
            action: 'PASSWORD_RESET',
            entity: 'AUTH',
            status: 'SUCCESS',
            details: 'Password reset completed',
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Password updated successfully" });

    } catch (error) {
        return handleServerError(res, error, req, "Failed to update password");
    }
};

// exports.sendOTP = async (req, res) => {
//     const { email } = req.body;

//     try {
//         // Check if email exists in admin sheet
//         const response = await sheets.spreadsheets.values.get({
//             spreadsheetId: SPREADSHEET_ID,
//             range: "admin login!A2:A",
//         });

//         const rows = response.data.values || [];
//         const emailExists = rows.some((row) => row[0] === email);

//         if (!emailExists) {
//             return res.status(404).json({ message: "Email not found in admin records" });
//         }

//         const otp = otpGenerator.generate(6, {
//             upperCaseAlphabets: false,
//             specialChars: false,
//             lowerCaseAlphabets: false,
//         });

//         otpStore[email] = {
//             otp,
//             expires: Date.now() + 10 * 60 * 1000, // 10 minutes
//         };

//         console.log("\n===========================================");
//         console.log(`OTP for ${email}: ${otp}`);
//         console.log("===========================================\n");

//         // Try to send email - but don't fail if it doesn't work
//         let emailSent = false;
//         try {
//             const transporter = nodemailer.createTransport({
//                 service: "gmail",
//                 auth: {
//                     user: process.env.EMAIL_USER,
//                     pass: process.env.EMAIL_PASS,
//                 },
//             });

//             await transporter.sendMail({
//                 from: `"VTAB Square Invoice" <${process.env.EMAIL_USER}>`,
//                 to: email,
//                 subject: "🔐 Your OTP — VTAB Square Invoice",
//                 html: `
//                     <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
//                         <h2 style="color: #0f172a; margin-bottom: 0.5rem;">Password Reset OTP</h2>
//                         <p style="color: #64748b; margin-bottom: 1.5rem;">Use the code below to reset your password. Valid for <strong>10 minutes</strong>.</p>
//                         <div style="background: #0f172a; color: white; font-size: 2rem; font-weight: 800; letter-spacing: 0.5em; text-align: center; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem;">
//                             ${otp}
//                         </div>
//                         <p style="color: #94a3b8; font-size: 0.875rem;">© 2026 VTAB Square Invoice</p>
//                     </div>
//                 `,
//             });
//             emailSent = true;
//         } catch (emailError) {
//             console.error("Email send failed:", emailError.message);
//         }

//         res.json({
//             message: emailSent
//                 ? "OTP sent to your email successfully!"
//                 : "OTP generated! Check the backend terminal for the OTP code.",
//             otp: otp, // Always return OTP for now to simplify testing
//         });
//     } catch (error) {
//         console.error("OTP Error:", error.message);
//         res.status(500).json({ error: error.message });
//     }
// };

// exports.verifyOTP = (req, res) => {
//     const { email, otp } = req.body;

//     const storedData = otpStore[email];

//     if (!storedData || storedData.otp !== otp || Date.now() > storedData.expires) {
//         return res.status(400).json({ message: "Invalid or expired OTP" });
//     }

//     res.json({ message: "OTP verified" });
// };

// exports.changePassword = async (req, res) => {
//     const { email, otp, newPassword } = req.body;

//     const storedData = otpStore[email];

//     if (!storedData || storedData.otp !== otp || Date.now() > storedData.expires) {
//         return res.status(400).json({ message: "Invalid or expired OTP" });
//     }

//     try {
//         const response = await sheets.spreadsheets.values.get({
//             spreadsheetId: SPREADSHEET_ID,
//             range: "admin login!A2:A",
//         });

//         const rows = response.data.values || [];
//         const index = rows.findIndex((row) => row[0] === email);

//         if (index === -1) {
//             return res.status(404).json({ message: "Email not found" });
//         }

//         // Store password in plain text as per user request
//         const plainPassword = newPassword;

//         await sheets.spreadsheets.values.update({
//             spreadsheetId: SPREADSHEET_ID,
//             range: `admin login!B${index + 2}`,
//             valueInputOption: "RAW",
//             requestBody: {
//                 values: [[plainPassword]],
//             },
//         });

//         delete otpStore[email];
//         res.json({ message: "Password updated successfully" });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };



// Clients Management

exports.getClients = async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Client!A2:M",
        });

        const rows = response.data.values || [];
        const clients = rows.map((row) => ({
            serialNo: row[0],
            name: row[1],
            industry: row[2],
            email: row[3],
            contact: row[4],
            address1: row[5],
            address2: row[6],
            city: row[7],
            state: row[8],
            country: row[9],
            pincode: row[10],
            taxNo: row[11],
            gstNo: row[12],
        }));

        res.json(clients);
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.addClient = async (req, res) => {
    console.log("Add Client Request Received for:", req.body?.name);
    const {
        name, industry, email, contact,
        address1, address2, country, state, city, pincode,
        taxNo, gstNo
    } = req.body;

    // Comprehensive server-side validation
    const validation = validateClientInput(req.body);
    if (!validation.isValid) {
        console.error("Validation Failed:", validation.message);
        return res.status(400).json({ message: validation.message });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "Client";

        // Get current clients to check for duplicates and determine next Serial No
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:E`, // Fetch up to Contact No column
        });

        const rows = response.data.values || [];

        // Duplicate Checks
        const duplicateName = rows.find(row => row[1] && row[1].toLowerCase() === name.toLowerCase());
        const duplicateEmail = rows.find(row => row[3] && row[3].toLowerCase() === email.toLowerCase());
        const duplicateContact = rows.find(row => row[4] && row[4] === contact);

        if (duplicateName) return res.status(400).json({ message: "Client Name already exists" });
        if (duplicateEmail) return res.status(400).json({ message: "Client Email already exists" });
        if (duplicateContact) return res.status(400).json({ message: "Contact Number already exists" });

        let nextSerial = "00001";
        if (rows.length > 0) {
            console.log("Existing rows found:", rows.length);
            // Filter out legacy serial numbers (e.g., 123456) to start fresh from 00001
            const validSerials = rows.map(r => parseInt(r[0])).filter(n => !isNaN(n) && n < 100000);
            console.log("Filtered valid serials:", validSerials);
            if (validSerials.length > 0) {
                nextSerial = (Math.max(...validSerials) + 1).toString().padStart(5, '0');
            }
        }
        console.log("Determined nextSerial:", nextSerial);

        // Updated Order to match screenshot: City (H), State (I), Country (J)
        const newClient = [
            nextSerial.toString(), // A
            name,                  // B
            industry,              // C
            email,                 // D
            contact,               // E
            address1,              // F
            address2,              // G
            city,                  // H
            state,                 // I
            country,               // J
            pincode,               // K
            taxNo || "",           // L
            gstNo || ""            // M
        ];

        console.log("Appending Client to Sheet:", newClient);

        const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A1`, // Start from A1 to let it find the next row
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
                values: [newClient],
            },
        });

        console.log("Google Sheets Append Response:", appendResponse.statusText);
        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'CREATE',
            entity: 'CLIENT',
            entityId: String(nextSerial),
            status: 'SUCCESS',
            details: `Client created: ${name}`,
            ipAddress: getClientIp(req)
        });
        res.json({ message: "Client added successfully", serialNo: nextSerial });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.updateClient = async (req, res) => {
    const { serialNo } = req.params;
    const updateData = req.body;
    console.log(`Update Client Request for Serial No: ${serialNo}`, updateData);

    if (!isValidIdentifier(serialNo)) {
        return res.status(400).json({ message: "Invalid client serial number" });
    }

    const validation = validateClientInput(updateData);
    if (!validation.isValid) {
        return res.status(400).json({ message: validation.message });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "Client";

        // Find the row index by Serial No
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:A`,
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (rowIndex === -1) {
            return res.status(404).json({ message: "Client not found" });
        }

        // Google Sheets rows are 1-indexed, and we skipped the header (A2:A)
        const sheetRowIndex = rowIndex + 2;

        const updatedClient = [
            serialNo,              // A
            updateData.name,       // B
            updateData.industry,   // C
            updateData.email,      // D
            updateData.contact,    // E
            updateData.address1,   // F
            updateData.address2,   // G
            updateData.city,       // H
            updateData.state,      // I
            updateData.country,    // J
            updateData.pincode,    // K
            updateData.taxNo || "",// L
            updateData.gstNo || "" // M
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A${sheetRowIndex}:M${sheetRowIndex}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [updatedClient],
            },
        });

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'UPDATE',
            entity: 'CLIENT',
            entityId: String(serialNo),
            status: 'SUCCESS',
            details: `Client updated: ${serialNo}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Client updated successfully" });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.deleteClient = async (req, res) => {
    const { serialNo } = req.params;
    console.log(`Delete Client Request for Serial No: ${serialNo}`);

    if (!isValidIdentifier(serialNo)) {
        return res.status(400).json({ message: "Invalid client serial number" });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "Client";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:B`,
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (rowIndex === -1) {
            return res.status(404).json({ message: "Client not found" });
        }

        const clientName = rows[rowIndex][1]?.toString().trim();

        // Referential integrity check: protect client if linked to historical invoices (Column F)
        if (clientName) {
            try {
                const invoiceResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: "'invoice header'!F2:F",
                });
                const invoiceRows = invoiceResponse.data.values || [];
                const isLinked = invoiceRows.some(row => row[0]?.toString().trim().toLowerCase() === clientName.toLowerCase());
                if (isLinked) {
                    return res.status(409).json({
                        message: `Cannot delete client "${clientName}". Historical invoices are linked to this client. In accordance with the Data Retention Policy, please archive rather than delete.`
                    });
                }
            } catch (checkErr) {
                return handleServerError(res, checkErr, req);
            }
        }

        const sheetRowIndex = rowIndex + 2;

        const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = sheetResponse.data.sheets.find(s => s.properties.title === tabName);
        const sheetId = sheet.properties.sheetId;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: "ROWS",
                                startIndex: sheetRowIndex - 1,
                                endIndex: sheetRowIndex
                            }
                        }
                    }
                ]
            }
        });

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'DELETE',
            entity: 'CLIENT',
            entityId: String(serialNo),
            status: 'SUCCESS',
            details: `Client deleted: ${serialNo}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Client deleted successfully" });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.getProfiles = async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "profile!A2:O",
        });

        const rows = response.data.values || [];
        const profiles = rows.map((row) => ({
            serialNo: row[0],
            companyName: row[1],
            pointOfContact: row[2],
            email: row[3],
            contactNo: row[4],
            address1: row[5],
            address2: row[6],
            city: row[7],
            state: row[8],
            country: row[9],
            pincode: row[10],
            gstNo: row[11],
            teamSize: row[12],
            industry: row[13] || "",
            taxNo: row[14] || "",
        }));

        res.json(profiles);
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.addProfile = async (req, res) => {
    console.log("Add Profile Request Received:", req.body);
    const {
        companyName, pointOfContact, email, contactNo,
        address1, address2, city, state, country, pincode,
        gstNo, teamSize, industry, taxNo
    } = req.body;

    // Comprehensive server-side validation
    const validation = validateProfileInput(req.body);
    if (!validation.isValid) {
        console.error("Validation Failed:", validation.message);
        return res.status(400).json({ message: validation.message });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "profile";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:E`,
        });

        const rows = response.data.values || [];
        const duplicateName = rows.find(row => row[1] && row[1].toLowerCase() === companyName.toLowerCase());
        const duplicateEmail = rows.find(row => row[3] && row[3].toLowerCase() === email.toLowerCase());
        const duplicateContact = rows.find(row => row[4] && row[4] === contactNo);

        if (duplicateName) return res.status(400).json({ message: "Company Name already exists" });
        if (duplicateEmail) return res.status(400).json({ message: "Email Id already exists" });
        if (duplicateContact) return res.status(400).json({ message: "Contact Number already exists" });

        let nextSerial = "00001";
        if (rows.length > 0) {
            console.log("Existing rows found:", rows.length);
            // Filter out legacy serial numbers to start fresh from 00001
            const validSerials = rows.map(r => parseInt(r[0])).filter(n => !isNaN(n) && n < 100000);
            console.log("Filtered valid serials:", validSerials);
            if (validSerials.length > 0) {
                nextSerial = (Math.max(...validSerials) + 1).toString().padStart(5, '0');
            }
        }
        console.log("Determined nextSerial:", nextSerial);

        const newProfile = [
            nextSerial.toString(), // A
            companyName,          // B
            pointOfContact,       // C
            email,                 // D
            contactNo,             // E
            address1,              // F
            address2,              // G
            city,                  // H
            state,                 // I
            country,               // J
            pincode,               // K
            gstNo || "",           // L
            teamSize,              // M
            industry || "",        // N
            taxNo || ""            // O
        ];

        const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A1`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
                values: [newProfile],
            },
        });

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'CREATE',
            entity: 'PROFILE',
            entityId: String(nextSerial),
            status: 'SUCCESS',
            details: `Profile created: ${companyName}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Profile created successfully", serialNo: nextSerial });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.updateProfile = async (req, res) => {
    const { serialNo } = req.params;
    const updateData = req.body;
    console.log(`Update Profile Request for Serial No: ${serialNo}`, updateData);

    if (!isValidIdentifier(serialNo)) {
        return res.status(400).json({ message: "Invalid profile serial number" });
    }

    const validation = validateProfileInput(updateData);
    if (!validation.isValid) {
        return res.status(400).json({ message: validation.message });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "profile";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:A`,
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (rowIndex === -1) {
            return res.status(404).json({ message: "Profile not found" });
        }

        const sheetRowIndex = rowIndex + 2;

        const updatedProfile = [
            serialNo,              // A
            updateData.companyName, // B
            updateData.pointOfContact, // C
            updateData.email,      // D
            updateData.contactNo,  // E
            updateData.address1,   // F
            updateData.address2,   // G
            updateData.city,       // H
            updateData.state,      // I
            updateData.country,    // J
            updateData.pincode,    // K
            updateData.gstNo || "",// L
            updateData.teamSize,   // M
            updateData.industry || "", // N
            updateData.taxNo || ""     // O
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A${sheetRowIndex}:O${sheetRowIndex}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [updatedProfile],
            },
        });

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'UPDATE',
            entity: 'PROFILE',
            entityId: String(serialNo),
            status: 'SUCCESS',
            details: `Profile updated: ${serialNo}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Profile updated successfully" });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.deleteProfile = async (req, res) => {
    const { serialNo } = req.params;
    console.log(`Delete Profile Request for Serial No: ${serialNo}`);

    if (!isValidIdentifier(serialNo)) {
        return res.status(400).json({ message: "Invalid profile serial number" });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "profile";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:B`,
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (rowIndex === -1) {
            return res.status(404).json({ message: "Profile not found" });
        }

        const profileName = rows[rowIndex][1]?.toString().trim();

        // Referential integrity check: protect profile if linked to historical invoices (Column E)
        if (profileName) {
            try {
                const invoiceResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: "'invoice header'!E2:E",
                });
                const invoiceRows = invoiceResponse.data.values || [];
                const isLinked = invoiceRows.some(row => row[0]?.toString().trim().toLowerCase() === profileName.toLowerCase());
                if (isLinked) {
                    return res.status(409).json({
                        message: `Cannot delete profile "${profileName}". Historical invoices are linked to this issuer profile. In accordance with the Data Retention Policy, please archive rather than delete.`
                    });
                }
            } catch (checkErr) {
                return handleServerError(res, checkErr, req);
            }
        }

        const sheetRowIndex = rowIndex + 2;

        const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = sheetResponse.data.sheets.find(s => s.properties.title === tabName);
        const sheetId = sheet.properties.sheetId;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: "ROWS",
                                startIndex: sheetRowIndex - 1,
                                endIndex: sheetRowIndex
                            }
                        }
                    }
                ]
            }
        });

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'DELETE',
            entity: 'PROFILE',
            entityId: String(serialNo),
            status: 'SUCCESS',
            details: `Profile deleted: ${serialNo}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Profile deleted successfully" });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

//invoice

const formatNumeric = (val) => {
    const num = parseFloat(val) || 0;
    // Return as a number for better Google Sheets integration
    return Number(num.toFixed(2));
};

exports.addInvoice = async (req, res) => {
    console.log("Add Invoice Request Received for invoiceNo:", req.body?.invoiceNo);
    const {
        invoiceNo, invoiceDate, dueDate, profileName, clientName,
        lineItems, signature,
        accountHolderName, accountNo, confirmAccountNo,
        branchLocation, ifscCode, accountType, bankName
    } = req.body;

    // Comprehensive server-side validation
    const validation = validateInvoiceInput(req.body);
    if (!validation.isValid) {
        return res.status(400).json({ message: validation.message });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const headerTab = "invoice header";
        const detailsTab = "invoice details";

        // Get next Serial No
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${headerTab}!A2:V`, // Extended range to include column V
        });
        const headerRows = headerResponse.data.values || [];

        let nextSerial = "00001";
        if (headerRows.length > 0) {
            console.log("Existing rows found:", headerRows.length);
            // Filter out legacy serial numbers to start fresh from 00001
            const validSerials = headerRows.map(r => parseInt(r[0])).filter(n => !isNaN(n) && n < 100000);
            console.log("Filtered valid serials:", validSerials);
            if (validSerials.length > 0) {
                nextSerial = (Math.max(...validSerials) + 1).toString().padStart(5, '0');
            }
        }
        console.log("Determined nextSerial:", nextSerial);
        
        if (dueDate < invoiceDate) {
            return res.status(400).json({ message: "Due Date cannot be earlier than Invoice Date" });
        }

        // Ensure invoiceNo is unique (moved after sequence check)
        const existingInvoiceRow = headerRows.find(row => row[1]?.toString().trim() === invoiceNo.toString().trim());
        if (existingInvoiceRow) {
            return res.status(400).json({ message: "Invoice Number already exists." });
        }

        let totalAmount = 0;
        let totalSgst = 0;
        let totalCgst = 0;
        let totalTax = 0;
        let totalGrand = 0;

        const detailsData = lineItems.map((item) => {
            const amt = parseFloat(item.amount) || 0;
            const qty = parseFloat(item.quantity) || 1;
            const sRate = parseFloat(item.sgstRate) || 9;
            const cRate = parseFloat(item.cgstRate) || 9;
            const baseAmount = Number((amt * qty).toFixed(2));

            const sgst = Number((baseAmount * (sRate / 100)).toFixed(2));
            const cgst = Number((baseAmount * (cRate / 100)).toFixed(2));
            const tax = Number((baseAmount * 0.10).toFixed(2));
            const total = Number((baseAmount + sgst + cgst).toFixed(2));

            totalAmount = Number((totalAmount + baseAmount).toFixed(2));
            totalSgst = Number((totalSgst + sgst).toFixed(2));
            totalCgst = Number((totalCgst + cgst).toFixed(2));
            totalTax = Number((totalTax + tax).toFixed(2));
            totalGrand = Number((totalAmount + totalSgst + totalCgst).toFixed(2));

            return [
                nextSerial.toString(),
                invoiceNo,
                invoiceDate,
                dueDate || "",
                profileName,
                clientName,
                formatNumeric(baseAmount),
                item.item || "",
                formatNumeric(sgst),
                formatNumeric(cgst),
                formatNumeric(tax),
                formatNumeric(total),
                item.description || "", // M (Index 12)
                formatNumeric(amt),      // N (Index 13)
                qty.toString(),          // O (Index 14)
                sRate.toString(),        // P (Index 15)
                cRate.toString()         // Q (Index 16)
            ];
        });

        const headerRow = [[
            nextSerial.toString(),
            invoiceNo,
            invoiceDate,
            dueDate || "",
            profileName,
            clientName,
            formatNumeric(totalAmount),
            formatNumeric(totalSgst),
            formatNumeric(totalCgst),
            formatNumeric(totalTax),
            formatNumeric(totalGrand),
            signature || "",
            accountHolderName || "",
            accountNo || "",
            confirmAccountNo || "",
            branchLocation || "",
            ifscCode || "",
            accountType || "",
            "Pending",          // S (Index 18) - Invoice Status
            "Not Filed",        // T (Index 19) - GST Status
            "Fund Pending",     // U (Index 20) - Accounts Status
            bankName || ""      // V (Index 21)
        ]];

        // Save to invoice header
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${headerTab}!A1`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: headerRow },
        });
        console.log("Appended Header Row to Sheet for serial:", nextSerial);

        // Save to invoice details
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${detailsTab}!A1`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: detailsData },
        });

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'CREATE',
            entity: 'INVOICE',
            entityId: String(req.body.invoiceNo || nextSerial),
            status: 'SUCCESS',
            details: `Invoice created: ${req.body.invoiceNo || nextSerial}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Invoice saved successfully", serialNo: nextSerial });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.getInvoices = async (req, res) => {
    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "invoice header";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:V`,
        });

        const rows = response.data.values || [];
        const invoices = rows
            .filter(row => {
                const serial = row[0] ? String(row[0]).trim() : "";
                const invNo = row[1] ? String(row[1]).trim() : "";
                return serial !== "" && invNo !== "";
            })
            .map(row => ({
                serialNo: row[0],
                invoiceNo: row[1],
            invoiceDate: row[2],
            dueDate: row[3],
            profileName: row[4],
            clientName: row[5],
            amount: row[6],
            sgst: row[7],
            cgst: row[8],
            tds: row[9],
            tax: row[9],
            total: row[10],
            signature: row[11] || "",
            accountHolderName: row[12] || "",
            accountNo: row[13] || "",
            confirmAccountNo: row[14] || "",
            branchLocation: row[15] || "",
            ifscCode: row[16] || "",
            accountType: row[17] || "",
            invoiceStatus: row[18] || "Pending",
            gstStatus: row[19] || "Not Filed",
            accountsStatus: row[20] || "Fund Pending",
            bankName: row[21] || "" // V
        }));

        res.json(invoices);
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.getInvoiceBySerial = async (req, res) => {
    const { serialNo } = req.params;
    if (!isValidIdentifier(serialNo)) {
        return res.status(400).json({ message: "Invalid invoice serial number" });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const headerTab = "invoice header";
        const detailsTab = "invoice details";

        // Fetch header and detail rows in a single batch request to eliminate sequential Google Sheets API roundtrips
        const batchRes = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: [`${headerTab}!A2:V`, `${detailsTab}!A2:Q`],
        });

        const headerRows = batchRes.data?.valueRanges?.[0]?.values || [];
        const headerRow = headerRows.find(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (!headerRow) {
            return res.status(404).json({ message: "Invoice not found" });
        }

        const invoice = {
            serialNo: headerRow[0],
            invoiceNo: headerRow[1],
            invoiceDate: headerRow[2],
            dueDate: headerRow[3],
            profileName: headerRow[4],
            clientName: headerRow[5],
            amount: headerRow[6],
            sgst: headerRow[7],
            cgst: headerRow[8],
            tax: headerRow[9],
            total: headerRow[10],
            signature: headerRow[11] || "",
            accountHolderName: headerRow[12] || "",
            accountNo: headerRow[13] || "",
            confirmAccountNo: headerRow[14] || "",
            branchLocation: headerRow[15] || "",
            ifscCode: headerRow[16] || "",
            accountType: headerRow[17] || "",
            invoiceStatus: headerRow[18] || "Pending",
            gstStatus: headerRow[19] || "Not Filed",
            accountsStatus: headerRow[20] || "Fund Pending",
            bankName: headerRow[21] || "" // V
        };

        const detailsRows = batchRes.data?.valueRanges?.[1]?.values || [];
        const lineItems = detailsRows
            .filter(row => row[0]?.toString().trim() === serialNo.toString().trim())
            .map(row => ({
                item: row[7],
                description: row[12] || "",
                amount: row[13] ? parseFloat(row[13]) : (parseFloat(row[6]) / (parseFloat(row[14]) || 1)),
                quantity: row[14] ? parseFloat(row[14]) : 1,
                baseAmount: row[6],
                sgst: row[8],
                cgst: row[9],
                tax: row[10],
                total: row[11],
                sgstRate: row[15] ? parseFloat(row[15]) : 9,
                cgstRate: row[16] ? parseFloat(row[16]) : 9
            }));

        res.json({ ...invoice, lineItems });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.updateInvoice = async (req, res) => {
    const { serialNo } = req.params;
    const {
        invoiceNo, invoiceDate, dueDate, profileName, clientName,
        lineItems, signature,
        accountHolderName, accountNo, confirmAccountNo,
        branchLocation, ifscCode, accountType, bankName
    } = req.body;

    if (!isValidIdentifier(serialNo)) {
        return res.status(400).json({ message: "Invalid invoice serial number" });
    }

    // Comprehensive server-side validation
    const validation = validateInvoiceInput(req.body);
    if (!validation.isValid) {
        return res.status(400).json({ message: validation.message });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const headerTab = "invoice header";
        const detailsTab = "invoice details";

        // 1. Update Header (Update ALL matching rows in case of duplicates)
        console.log(`Update Invoice Request received for Serial: ${serialNo}`);
        console.log("Request Body:", JSON.stringify(req.body, null, 2));

        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${headerTab}!A:V`, // Fetch up to V
        });
        const headerRows = headerResponse.data.values || [];

        // Find all indices that match serialNo (A is column 0)
        const headerIndicesToUpdate = [];
        headerRows.forEach((row, idx) => {
            if (row[0]?.toString().trim() === serialNo.toString().trim()) {
                headerIndicesToUpdate.push(idx + 1); // 1-indexed
            }
        });

        console.log(`Matching Header Rows found at:`, headerIndicesToUpdate);

        if (headerIndicesToUpdate.length === 0) {
            console.error(`Invoice with Serial No ${serialNo} not found in header rows:`, headerRows.slice(0, 20).map(r => r[0]));
            return res.status(404).json({ message: "Invoice not found" });
        }

        // 1. Update Header (Update ALL matching rows in case of duplicates)

        let totalAmount = 0;
        let totalSgst = 0;
        let totalCgst = 0;
        let totalTax = 0;
        let totalGrand = 0;

        const updatedDetails = lineItems.map((item) => {
            const amt = parseFloat(item.amount) || 0;
            const qty = parseFloat(item.quantity) || 1;
            const sRate = parseFloat(item.sgstRate) || 9;
            const cRate = parseFloat(item.cgstRate) || 9;
            const baseAmount = Number((amt * qty).toFixed(2));

            const sgst = Number((baseAmount * (sRate / 100)).toFixed(2));
            const cgst = Number((baseAmount * (cRate / 100)).toFixed(2));
            const tax = Number((baseAmount * 0.10).toFixed(2));
            const total = Number((baseAmount + sgst + cgst).toFixed(2));

            totalAmount = Number((totalAmount + baseAmount).toFixed(2));
            totalSgst = Number((totalSgst + sgst).toFixed(2));
            totalCgst = Number((totalCgst + cgst).toFixed(2));
            totalTax = Number((totalTax + tax).toFixed(2));
            totalGrand = Number((totalAmount + totalSgst + totalCgst).toFixed(2));

            return [
                serialNo,
                invoiceNo,
                invoiceDate,
                dueDate || "",
                profileName,
                clientName,
                formatNumeric(baseAmount),
                item.item || "",
                formatNumeric(sgst),
                formatNumeric(cgst),
                formatNumeric(tax),
                formatNumeric(total),
                item.description || "", // M (Index 12)
                formatNumeric(amt),      // N (Index 13)
                qty.toString(),          // O (Index 14)
                sRate.toString(),        // P (Index 15)
                cRate.toString()         // Q (Index 16)
            ];
        });

        const originalRow = headerRows[headerIndicesToUpdate[0] - 1]; // Get the data of the first matching row
        
        const updatedHeaderRow = [
            serialNo,
            invoiceNo,
            invoiceDate,
            dueDate || "",
            profileName,
            clientName,
            formatNumeric(totalAmount),
            formatNumeric(totalSgst),
            formatNumeric(totalCgst),
            formatNumeric(totalTax),
            formatNumeric(totalGrand),
            signature || "",
            accountHolderName || "",
            accountNo || "",
            confirmAccountNo || "",
            branchLocation || "",
            ifscCode || "",
            accountType || "",
            originalRow[18] || "Pending", // S
            originalRow[19] || "Not Filed", // T
            originalRow[20] || "Fund Pending", // U
            bankName || "" // V
        ];

        console.log("Updating Header Row(s) with values:", updatedHeaderRow);

        // Update each matching row
        for (const rowIdx of headerIndicesToUpdate) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${headerTab}!A${rowIdx}:V${rowIdx}`,
                valueInputOption: "RAW",
                requestBody: { values: [updatedHeaderRow] },
            });
        }

        // 2. Update Details In-place
        const detailsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${detailsTab}!A2:A`,
        });
        const detailsRows = detailsResponse.data.values || [];

        // Find existing indices
        const existingDetailRowIndices = [];
        detailsRows.forEach((row, index) => {
            if (row[0]?.toString().trim() === serialNo.toString().trim()) {
                existingDetailRowIndices.push(index + 2); // 1-indexed and skip header
            }
        });

        const updates = [];
        const appends = [];
        for (let i = 0; i < updatedDetails.length; i++) {
            if (i < existingDetailRowIndices.length) {
                updates.push({
                    range: `${detailsTab}!A${existingDetailRowIndices[i]}:Q${existingDetailRowIndices[i]}`,
                    values: [updatedDetails[i]]
                });
            } else {
                appends.push(updatedDetails[i]);
            }
        }

        // Apply in-place updates
        if (updates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: "RAW",
                    data: updates
                }
            });
        }

        // Add any brand new lines
        if (appends.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${detailsTab}!A1`,
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values: appends },
            });
        }

        // Delete left-over duplicate rows if the updated invoice has fewer line items than before
        if (existingDetailRowIndices.length > updatedDetails.length) {
            const indicesToDelete = existingDetailRowIndices.slice(updatedDetails.length);
            
            const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
            const sheet = sheetMeta.data.sheets.find(s => s.properties.title === detailsTab);
            const sheetId = sheet.properties.sheetId;

            indicesToDelete.sort((a, b) => b - a);
            const deleteRequests = indicesToDelete.map(idx => ({
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: "ROWS",
                        startIndex: idx - 1,
                        endIndex: idx
                    }
                }
            }));

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: deleteRequests }
            });
        }

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'UPDATE',
            entity: 'INVOICE',
            entityId: String(serialNo),
            status: 'SUCCESS',
            details: `Invoice updated: ${serialNo}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Invoice updated successfully" });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

exports.deleteInvoice = async (req, res) => {
    const { serialNo } = req.params;
    if (!isValidIdentifier(serialNo)) {
        return res.status(400).json({ message: "Invalid invoice serial number" });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const headerTab = "invoice header";
        const detailsTab = "invoice details";

        // Delete from Header
        const headerRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${headerTab}!A2:A`,
        });
        const headerRows = headerRes.data.values || [];
        const headerIndex = headerRows.findIndex(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (headerIndex !== -1) {
            const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
            const headerSheet = sheetMeta.data.sheets.find(s => s.properties.title === headerTab);

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: headerSheet.properties.sheetId,
                                dimension: "ROWS",
                                startIndex: headerIndex + 1,
                                endIndex: headerIndex + 2
                            }
                        }
                    }]
                }
            });
        }

        // Delete from Details
        const detailsRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${detailsTab}!A2:A`,
        });
        const detailsRows = detailsRes.data.values || [];
        const detailIndices = [];
        detailsRows.forEach((row, index) => {
            if (row[0]?.toString().trim() === serialNo.toString().trim()) detailIndices.push(index + 2);
        });

        if (detailIndices.length > 0) {
            const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
            const detailsSheet = sheetMeta.data.sheets.find(s => s.properties.title === detailsTab);

            detailIndices.sort((a, b) => b - a);
            const deleteRequests = detailIndices.map(idx => ({
                deleteDimension: {
                    range: {
                        sheetId: detailsSheet.properties.sheetId,
                        dimension: "ROWS",
                        startIndex: idx - 1,
                        endIndex: idx
                    }
                }
            }));

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: deleteRequests }
            });
        }

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: 'DELETE',
            entity: 'INVOICE',
            entityId: String(serialNo),
            status: 'SUCCESS',
            details: `Invoice deleted: ${serialNo}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};
exports.updateInvoiceStatuses = async (req, res) => {
    const { serialNo } = req.params;
    const { invoiceStatus, gstStatus, accountsStatus } = req.body;

    if (!isValidIdentifier(serialNo)) {
        return res.status(400).json({ message: "Invalid invoice serial number" });
    }

    if (!invoiceStatus && !gstStatus && !accountsStatus) {
        return res.status(400).json({ message: "At least one status field must be provided" });
    }

    if ((invoiceStatus && (typeof invoiceStatus !== 'string' || invoiceStatus.length > 50)) ||
        (gstStatus && (typeof gstStatus !== 'string' || gstStatus.length > 50)) ||
        (accountsStatus && (typeof accountsStatus !== 'string' || accountsStatus.length > 50))) {
        return res.status(400).json({ message: "Invalid status value format or length exceeds 50 characters" });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const headerTab = "invoice header";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${headerTab}!A:S`, // Fetch up to Column S (Invoice Status) for previous status inspection
        });
        const rows = response.data.values || [];
        console.log(`Searching for Serial No: "${serialNo}" in ${rows.length} rows`);
        const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (rowIndex === -1) {
            console.error(`Invoice with Serial No "${serialNo}" NOT FOUND in sheet.`);
            return res.status(404).json({ message: `Invoice #${serialNo} not found.` });
        }

        const sheetRowIndex = rowIndex + 1; // 1-indexed for sheets
        const updates = [];

        if (invoiceStatus) {
            updates.push({
                range: `${headerTab}!S${sheetRowIndex}`,
                values: [[invoiceStatus]]
            });
        }
        if (gstStatus) {
            updates.push({
                range: `${headerTab}!T${sheetRowIndex}`,
                values: [[gstStatus]]
            });
        }
        if (accountsStatus) {
            updates.push({
                range: `${headerTab}!U${sheetRowIndex}`,
                values: [[accountsStatus]]
            });
        }

        if (updates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: "RAW",
                    data: updates
                }
            });
        }

        // Determine audit action type: ARCHIVE, UNARCHIVE, or STATUS_UPDATE
        let actionType = 'STATUS_UPDATE';
        if (invoiceStatus) {
            const currentStatusLower = invoiceStatus.trim().toLowerCase();
            const prevStatusLower = (rows[rowIndex]?.[18] || '').toString().trim().toLowerCase();
            if (currentStatusLower === 'archived') {
                actionType = 'ARCHIVE';
            } else if (prevStatusLower === 'archived') {
                actionType = 'UNARCHIVE';
            }
        }

        await logAudit({
            adminEmail: req.user?.email || 'Admin',
            action: actionType,
            entity: 'INVOICE',
            entityId: String(serialNo),
            status: 'SUCCESS',
            details: `Invoice status updated: invoiceStatus=${invoiceStatus || 'unchanged'}, gstStatus=${gstStatus || 'unchanged'}, accountsStatus=${accountsStatus || 'unchanged'}${actionType === 'ARCHIVE' ? ' (Archived for retention)' : actionType === 'UNARCHIVE' ? ' (Restored from archive)' : ''}`,
            ipAddress: getClientIp(req)
        });

        res.json({ message: "Statuses updated successfully" });
    } catch (error) {
        return handleServerError(res, error, req);
    }
};

/*
================================
 BACKUP & RECOVERY (Protected)
================================
*/

exports.createBackup = async (req, res) => {
    const adminEmail = req.user?.email || 'admin';
    const ipAddress = getClientIp(req);

    try {
        const options = {
            includeCsv: req.body?.includeCsv === true,
        };

        const result = await backupService.createBackup(options);

        // Record successful backup in audit trail (failure-safe)
        logAudit({
            adminEmail,
            action: 'BACKUP',
            entity: 'SYSTEM',
            status: 'SUCCESS',
            details: `Backup created: ${result.filename} (${result.summary.totalRows} rows across ${result.summary.totalSheets} sheets)`,
            ipAddress,
        }).catch(() => {});

        return res.status(201).json({
            message: "Backup created successfully",
            ...result,
        });
    } catch (error) {
        // Record failed backup in audit trail (failure-safe, no secrets/stack traces)
        logAudit({
            adminEmail,
            action: 'BACKUP',
            entity: 'SYSTEM',
            status: 'FAILED',
            details: 'Backup creation failed',
            ipAddress,
        }).catch(() => {});

        return handleServerError(res, error, req, "Failed to create backup.");
    }
};

exports.listBackups = async (req, res) => {
    try {
        const backups = backupService.listBackups();
        return res.status(200).json({ backups });
    } catch (error) {
        return handleServerError(res, error, req, "Failed to list backups.");
    }
};

