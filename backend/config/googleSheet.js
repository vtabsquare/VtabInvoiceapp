const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

let auth;

const keyFile = path.join(__dirname, "../google-service-account.json");
const hasLocalKeyFile = fs.existsSync(keyFile);

// Prefer local JSON key file when present
if (hasLocalKeyFile) {
  auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file"
    ],
  });

  console.log("✅ Google Auth initialized using local key file.");
}
// Otherwise use environment variables
else if (process.env.GOOGLE_CREDENTIALS || (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)) {
  try {
    let credentials;
    if (process.env.GOOGLE_CREDENTIALS) {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } else {
      credentials = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
        project_id: process.env.GOOGLE_PROJECT_ID,
      };
    }

    const normalizedPrivateKey = credentials.private_key
      .replace(/^"|"$/g, "")
      .replace(/^'|'$/g, "")
      .replace(/\\n/g, "\n")
      .trim();

    auth = new google.auth.GoogleAuth({
      credentials: {
        ...credentials,
        private_key: normalizedPrivateKey,
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file"
      ],
    });

    console.log("✅ Google Auth initialized using environment variables.");
  } catch (error) {
    console.error("❌ Failed to initialize Google Auth from environment:", error);
    process.exit(1);
  }
} 
// No credentials found
else {
  throw new Error("Google credentials not found. Provide a local google-service-account.json file or configure Google credential environment variables.");
}

const sheets = google.sheets({
  version: "v4",
  auth,
});

const drive = google.drive({
  version: "v3",
  auth,
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

if (!SPREADSHEET_ID) {
  console.warn("⚠️ Warning: SPREADSHEET_ID is not configured in environment variables.");
}

module.exports = {
  sheets,
  drive,
  get SPREADSHEET_ID() {
    return process.env.SPREADSHEET_ID;
  }
};