const { google } = require("googleapis");
const path = require("path");
require("dotenv").config();

<<<<<<< HEAD
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../google-service-account.json"),
=======
const keyFile = path.join(__dirname, "../google-service-account.json");

if (!process.env.SPREADSHEET_ID) {
  throw new Error("Missing required environment variable: SPREADSHEET_ID");
}

const auth = new google.auth.GoogleAuth({
  keyFile,
>>>>>>> 00b3bedf4d1cc9e0ea480cb8245c8a8bb2c04238
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

<<<<<<< HEAD
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1IKk4iyAxKfggaV8yVDHBvKAhjGfHSHTJYXCL1PsYyG8";
=======
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
>>>>>>> 00b3bedf4d1cc9e0ea480cb8245c8a8bb2c04238

module.exports = { sheets, SPREADSHEET_ID };
