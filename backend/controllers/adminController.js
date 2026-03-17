const { sheets, SPREADSHEET_ID } = require("../config/googleSheet");
const otpGenerator = require("otp-generator");
//const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const otpStore = require("../utils/otpStore");

const resend = new Resend(process.env.RESEND_API_KEY);

//login

exports.loginAdmin = async (req, res) => {

    const { email, password } = req.body;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "admin login!A2:B",
        });

        const rows = response.data.values || [];
        const adminRow = rows.find((row) => row[0] === email);

        if (!adminRow) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Using plain text comparison as per user request
        const isMatch = (password === adminRow[1]);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.json({ message: "Login success", email: adminRow[0] });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: error.message });
    }
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

        console.log(`OTP for ${email}: ${otp}`);

        // Send Email using Resend
        await resend.emails.send({
            from: "VTAB Invoice <onboarding@resend.dev>",
            to: email,
            subject: "🔐 Your OTP — VTAB Square Invoice",
            html: `
                <div style="font-family: Inter, sans-serif; max-width:480px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px">
                    <h2>Password Reset OTP</h2>
                    <p>Your verification code is:</p>
                    <h1 style="letter-spacing:6px">${otp}</h1>
                    <p>This OTP will expire in 10 minutes.</p>
                    <p>VTAB Square Invoice</p>
                </div>
            `,
        });

        res.json({ message: "OTP sent successfully to your email" });

    } catch (error) {
        console.error("OTP Error:", error);
        res.status(500).json({ error: error.message });
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

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `admin login!B${index + 2}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[newPassword]],
            },
        });

        delete otpStore[email];

        res.json({ message: "Password updated successfully" });

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ error: error.message });
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
        console.error("Get Clients Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.addClient = async (req, res) => {
    console.log("Add Client Request Received:", req.body);
    const {
        name, industry, email, contact,
        address1, address2, country, state, city, pincode,
        taxNo, gstNo
    } = req.body;

    // Basic validation
    if (!name || !email || !contact || !address1 || !address2 || !country || !state || !city || !pincode || !taxNo || !gstNo) {
        console.error("Validation Failed. Missing fields.");
        return res.status(400).json({ message: "All required fields must be filled (including TAN and GST)" });
    }

    const alphaRegex = /^[a-zA-Z\s]*$/;
    if (!alphaRegex.test(name)) {
        return res.status(400).json({ message: "Client Name must contain only alphabets" });
    }
    if (contact.length !== 10) {
        return res.status(400).json({ message: "Contact Number must be exactly 10 digits" });
    }
    if (pincode.length !== 6) {
        return res.status(400).json({ message: "Pincode must be exactly 6 digits" });
    }
    if (taxNo.length < 11 || taxNo.length > 16) {
        return res.status(400).json({ message: "TAN Number must be 11 to 16 characters" });
    }
    if (gstNo.length < 11 || gstNo.length > 16) {
        return res.status(400).json({ message: "GST Number must be 11 to 16 characters" });
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
        res.json({ message: "Client added successfully", serialNo: nextSerial });
    } catch (error) {
        console.error("Add Client Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.updateClient = async (req, res) => {
    const { serialNo } = req.params;
    const updateData = req.body;
    console.log(`Update Client Request for Serial No: ${serialNo}`, updateData);

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

        if (!updateData.name || !updateData.email || !updateData.contact || !updateData.address1 || !updateData.address2 || !updateData.country || !updateData.state || !updateData.city || !updateData.pincode || !updateData.taxNo || !updateData.gstNo) {
            return res.status(400).json({ message: "All required fields must be filled" });
        }

        const alphaRegex = /^[a-zA-Z\s]*$/;
        if (!alphaRegex.test(updateData.name)) {
            return res.status(400).json({ message: "Client Name must contain only alphabets" });
        }
        if (updateData.contact.length !== 10) {
            return res.status(400).json({ message: "Contact Number must be exactly 10 digits" });
        }
        if (updateData.pincode.length !== 6) {
            return res.status(400).json({ message: "Pincode must be exactly 6 digits" });
        }
        if (updateData.taxNo.length < 11 || updateData.taxNo.length > 16) {
            return res.status(400).json({ message: "TAN Number must be 11 to 16 characters" });
        }
        if (updateData.gstNo.length < 11 || updateData.gstNo.length > 16) {
            return res.status(400).json({ message: "GST Number must be 11 to 16 characters" });
        }

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

        res.json({ message: "Client updated successfully" });
    } catch (error) {
        console.error("Update Client Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteClient = async (req, res) => {
    const { serialNo } = req.params;
    console.log(`Delete Client Request for Serial No: ${serialNo}`);

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "Client";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:A`,
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (rowIndex === -1) {
            return res.status(404).json({ message: "Client not found" });
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

        res.json({ message: "Client deleted successfully" });
    } catch (error) {
        console.error("Delete Client Error:", error.message);
        res.status(500).json({ error: error.message });
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
        console.error("Get Profiles Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.addProfile = async (req, res) => {
    console.log("Add Profile Request Received:", req.body);
    const {
        companyName, pointOfContact, email, contactNo,
        address1, address2, city, state, country, pincode,
        gstNo, teamSize, industry, taxNo
    } = req.body;

    if (!companyName || !email || !contactNo || !address1 || !address2 || !city || !state || !country || !pincode || !teamSize || !gstNo || !taxNo || !industry || !pointOfContact) {
        console.error("Validation Failed. Missing fields.");
        return res.status(400).json({ message: "All required fields must be filled (including Industry and Point of Contact)" });
    }

    const alphaRegex = /^[a-zA-Z\s]*$/;
    if (!alphaRegex.test(companyName)) {
        return res.status(400).json({ message: "Business Name must contain only alphabets" });
    }
    if (!alphaRegex.test(industry)) {
        return res.status(400).json({ message: "Industry must contain only alphabets" });
    }
    if (!alphaRegex.test(pointOfContact)) {
        return res.status(400).json({ message: "Point of Contact must contain only alphabets" });
    }
    if (contactNo.length !== 10) {
        return res.status(400).json({ message: "Contact Number must be exactly 10 digits" });
    }
    if (pincode.length !== 6) {
        return res.status(400).json({ message: "Pincode must be exactly 6 digits" });
    }
    if (gstNo.length < 11 || gstNo.length > 16) {
        return res.status(400).json({ message: "GST Number must be 11 to 16 characters" });
    }
    if (taxNo.length < 11 || taxNo.length > 16) {
        return res.status(400).json({ message: "TAN Number must be 11 to 16 characters" });
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

        res.json({ message: "Profile created successfully", serialNo: nextSerial });
    } catch (error) {
        console.error("Add Profile Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    const { serialNo } = req.params;
    const updateData = req.body;
    console.log(`Update Profile Request for Serial No: ${serialNo}`, updateData);

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "profile";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:A`,
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === serialNo.toString().trim());

        if (!updateData.companyName || !updateData.email || !updateData.contactNo || !updateData.address1 || !updateData.address2 || !updateData.city || !updateData.state || !updateData.country || !updateData.pincode || !updateData.teamSize || !updateData.gstNo || !updateData.taxNo || !updateData.industry || !updateData.pointOfContact) {
            return res.status(400).json({ message: "All required fields must be filled" });
        }

        const alphaRegex = /^[a-zA-Z\s]*$/;
        if (!alphaRegex.test(updateData.companyName)) {
            return res.status(400).json({ message: "Business Name must contain only alphabets" });
        }
        if (!alphaRegex.test(updateData.industry)) {
            return res.status(400).json({ message: "Industry must contain only alphabets" });
        }
        if (!alphaRegex.test(updateData.pointOfContact)) {
            return res.status(400).json({ message: "Point of Contact must contain only alphabets" });
        }
        if (updateData.contactNo.length !== 10) {
            return res.status(400).json({ message: "Contact Number must be exactly 10 digits" });
        }
        if (updateData.pincode.length !== 6) {
            return res.status(400).json({ message: "Pincode must be exactly 6 digits" });
        }
        if (updateData.gstNo.length < 11 || updateData.gstNo.length > 16) {
            return res.status(400).json({ message: "GST Number must be 11 to 16 characters" });
        }
        if (updateData.taxNo.length < 11 || updateData.taxNo.length > 16) {
            return res.status(400).json({ message: "TAN Number must be 11 to 16 characters" });
        }

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

        res.json({ message: "Profile updated successfully" });
    } catch (error) {
        console.error("Update Profile Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProfile = async (req, res) => {
    const { serialNo } = req.params;
    console.log(`Delete Profile Request for Serial No: ${serialNo}`);

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

        res.json({ message: "Profile deleted successfully" });
    } catch (error) {
        console.error("Delete Profile Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

//invoice

const formatNumeric = (val) => {
    const num = parseFloat(val) || 0;
    // Return as a number for better Google Sheets integration
    return Number(num.toFixed(2));
};

exports.addInvoice = async (req, res) => {
    console.log("Add Invoice Request Received:", req.body);
    const {
        invoiceNo, invoiceDate, dueDate, profileName, clientName,
        lineItems, signature,
        accountHolderName, accountNo, confirmAccountNo,
        branchLocation, ifscCode, accountType
    } = req.body;

    if (!invoiceNo || !invoiceDate || !profileName || !clientName || !lineItems || lineItems.length === 0 || !dueDate || !accountHolderName || !accountNo || !branchLocation || !ifscCode || !accountType) {
        return res.status(400).json({ message: "Missing required invoice fields (including Bank Details and Due Date)" });
    }

    const today = new Date().toISOString().split('T')[0];
    if (dueDate < today) {
        return res.status(400).json({ message: "Due Date must be a current or future date" });
    }

    const alphaRegex = /^[a-zA-Z\s]*$/;
    if (!alphaRegex.test(accountHolderName)) {
        return res.status(400).json({ message: "Account Holder Name must contain only alphabets" });
    }
    if (!alphaRegex.test(branchLocation)) {
        return res.status(400).json({ message: "Branch Location must contain only alphabets" });
    }
    if (ifscCode.length < 11 || ifscCode.length > 13) {
        return res.status(400).json({ message: "IFSC Code must be 11 to 13 characters" });
    }

    try {
        const spreadsheetId = SPREADSHEET_ID;
        const headerTab = "invoice header";
        const detailsTab = "invoice details";

        // Get next Serial No
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${headerTab}!A2:A`,
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
        
        // Ensure invoiceNo is unique
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
            accountType || ""
        ]];

        // Save to invoice header
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${headerTab}!A1`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: headerRow },
        });

        // Save to invoice details
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${detailsTab}!A1`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: detailsData },
        });

        res.json({ message: "Invoice saved successfully", serialNo: nextSerial });
    } catch (error) {
        console.error("Add Invoice Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.getInvoices = async (req, res) => {
    try {
        const spreadsheetId = SPREADSHEET_ID;
        const tabName = "invoice header";

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A2:R`,
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
            tax: row[9],
            total: row[10],
            signature: row[11] || "",
            accountHolderName: row[12] || "",
            accountNo: row[13] || "",
            confirmAccountNo: row[14] || "",
            branchLocation: row[15] || "",
            ifscCode: row[16] || "",
            accountType: row[17] || ""
        }));

        res.json(invoices);
    } catch (error) {
        console.error("Get Invoices Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.getInvoiceBySerial = async (req, res) => {
    const { serialNo } = req.params;
    try {
        const spreadsheetId = SPREADSHEET_ID;
        const headerTab = "invoice header";
        const detailsTab = "invoice details";

        // Get Header
        const headerRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${headerTab}!A2:R`,
        });
        const headerRows = headerRes.data.values || [];
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
            accountType: headerRow[17] || ""
        };

        // Get Details
        const detailsRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${detailsTab}!A2:Q`,
        });
        const detailsRows = detailsRes.data.values || [];
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
        console.error("Get Invoice Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.updateInvoice = async (req, res) => {
    const { serialNo } = req.params;
    const {
        invoiceNo, invoiceDate, dueDate, profileName, clientName,
        lineItems, signature,
        accountHolderName, accountNo, confirmAccountNo,
        branchLocation, ifscCode, accountType
    } = req.body;

    if (!invoiceNo || !invoiceDate || !profileName || !clientName || !lineItems || lineItems.length === 0 || !dueDate || !accountHolderName || !accountNo || !branchLocation || !ifscCode || !accountType) {
        return res.status(400).json({ message: "Missing required invoice fields (including Bank Details and Due Date)" });
    }

    const today = new Date().toISOString().split('T')[0];
    if (dueDate < today) {
        return res.status(400).json({ message: "Due Date must be a current or future date" });
    }

    const alphaRegex = /^[a-zA-Z\s]*$/;
    if (!alphaRegex.test(accountHolderName)) {
        return res.status(400).json({ message: "Account Holder Name must contain only alphabets" });
    }
    if (!alphaRegex.test(branchLocation)) {
        return res.status(400).json({ message: "Branch Location must contain only alphabets" });
    }
    if (ifscCode.length < 11 || ifscCode.length > 13) {
        return res.status(400).json({ message: "IFSC Code must be 11 to 13 characters" });
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
            range: `${headerTab}!A:A`, // Fetch whole column A to be safe
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
            accountType || ""
        ];

        console.log("Updating Header Row(s) with values:", updatedHeaderRow);

        // Update each matching row
        for (const rowIdx of headerIndicesToUpdate) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${headerTab}!A${rowIdx}:R${rowIdx}`,
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

        res.json({ message: "Invoice updated successfully" });
    } catch (error) {
        console.error("Update Invoice Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteInvoice = async (req, res) => {
    const { serialNo } = req.params;
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

        res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
        console.error("Delete Invoice Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};
