const { google } = require("googleapis");
const path = require("path");
require("dotenv").config();

const keyFile = path.join(__dirname, "../google-service-account.json");

let auth;
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    console.log("Google Auth initialized using environment variable.");
  } catch (err) {
    console.error("Failed to parse GOOGLE_CREDENTIALS environment variable. Falling back to keyFile.");
    auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
} else {
  auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1IKk4iyAxKfggaV8yVDHBvKAhjGfHSHTJYXCL1PsYyG8";

module.exports = { sheets, SPREADSHEET_ID };
