const { google } = require("googleapis");
const path = require("path");
require("dotenv").config();

let auth;

// If GOOGLE_CREDENTIALS is provided (Render / Production) or individual env vars
if (process.env.GOOGLE_CREDENTIALS || (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)) {
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

    auth = new google.auth.GoogleAuth({
      credentials: {
        ...credentials,
        // Fix for Render newline issue in private key
        private_key: credentials.private_key.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    console.log("✅ Google Auth initialized using environment variables.");
  } catch (error) {
    console.error("❌ Failed to initialize Google Auth from environment:", error);
    process.exit(1);
  }
} 
// Local development (use JSON file)
else {
  const keyFile = path.join(__dirname, "../google-service-account.json");

  auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  console.log("✅ Google Auth initialized using local key file.");
}

const sheets = google.sheets({
  version: "v4",
  auth,
});

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1IKk4iyAxKfggaV8yVDHBvKAhjGfHSHTJYXCL1PsYyG8";

module.exports = { sheets, SPREADSHEET_ID };