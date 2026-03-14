const { google } = require("googleapis");
const path = require("path");
require("dotenv").config();

let auth;

// If GOOGLE_CREDENTIALS is provided (Render / Production)
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    auth = new google.auth.GoogleAuth({
      credentials: {
        ...credentials,
        // Fix for Render newline issue in private key
        private_key: credentials.private_key.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    console.log("✅ Google Auth initialized using environment variable.");
  } catch (error) {
    console.error("❌ Failed to parse GOOGLE_CREDENTIALS:", error);
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