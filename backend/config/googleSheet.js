const { google } = require("googleapis");
const path = require("path");
require("dotenv").config();

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../google-service-account.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1IKk4iyAxKfggaV8yVDHBvKAhjGfHSHTJYXCL1PsYyG8";

module.exports = { sheets, SPREADSHEET_ID };
