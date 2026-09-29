# VTAB Square Invoice Application — Finance Operator User Guide

Welcome to the **VTAB Square Invoice Application User Guide**. This document provides step-by-step instructions for finance operators, billing specialists, and accountants to manage clients, business profiles, and GST-compliant invoices efficiently and securely.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Logging In & Session Management](#2-logging-in--session-management)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Client Management](#4-client-management)
5. [Business Profile Management](#5-business-profile-management)
6. [Invoice Management Workflow](#6-invoice-management-workflow)
7. [PDF Document Generation](#7-pdf-document-generation)
8. [Emailing an Invoice to a Client](#8-emailing-an-invoice-to-a-client)
9. [Password Reset & OTP Workflow](#9-password-reset--otp-workflow)
10. [Data Backup & Point-in-Time Snapshots](#10-data-backup--point-in-time-snapshots)
11. [Audit Trail & Compliance](#11-audit-trail--compliance)
12. [Application Health & System Status](#12-application-health--system-status)
13. [Common Problems & Troubleshooting](#13-common-problems--troubleshooting)
14. [Operator Security Guidelines](#14-operator-security-guidelines)
15. [When to Contact the Technical Administrator](#15-when-to-contact-the-technical-administrator)

---

## 1. Introduction

The **VTAB Square Invoice Application** is a specialized billing and invoicing platform designed for finance operations. 

### Key Capabilities
* **Client Directory**: Store verified client addresses, contact information, TAN, and GSTIN numbers.
* **Issuer Profiles**: Manage company branding, registered business addresses, and banking wire instructions.
* **GST-Compliant Invoicing**: Automatically calculate item taxable amounts, CGST, SGST, and grand totals with automatic Indian currency number-to-words conversion.
* **Accounting Status Tracking**: Track invoice lifecycle statuses (Pending/Paid), GST filing status, and fund reconciliation.
* **Document Delivery**: Instantly render printable A4 invoice PDFs and dispatch them directly to clients via email.
* **Audit & Data Protection**: Automatically log business transactions and safeguard client information.

---

## 2. Logging In & Session Management

### How to Access
1. Open a supported desktop browser (Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari).
2. Navigate to the application URL provided by your administrator (e.g., `http://your-domain.com/login`).

### Logging In
1. On the login screen, enter your registered **Email Address**.
2. Enter your **Password**.
3. Click the **Login** button.
4. Upon successful authentication:
   * A secure session token is established.
   * Your operator email appears in the sidebar.
   * You are automatically redirected to the **Dashboard**.

### Login Protection
* The application employs **login rate limiting** to protect against unauthorized attempts. Entering incorrect passwords repeatedly will result in a temporary lockout notice. If you forget your password, use the **Forgot Password** link rather than guessing.

### Logging Out
1. Locate the **Logout** button at the bottom of the left navigation sidebar.
2. Click **Logout**.
3. Your active session token is immediately cleared, and you will be redirected to the login screen.
4. *Always log out when stepping away from your workstation.*

---

## 3. Dashboard Overview

The **Dashboard** serves as your financial command center, summarizing billing metrics and recent activity in real time.

### 1. Key Performance Indicators (KPIs)
* **Total Clients**: Number of active clients registered in the system.
* **Total Profiles**: Number of active company issuer profiles.
* **Total Invoices**: Cumulative count of all generated invoices.

### 2. Financial Summary Cards
Reflects live totals based on selected filter criteria:
* **Base Amount**: Net taxable value before tax across filtered invoices.
* **CGST**: Central Goods and Services Tax total.
* **SGST**: State Goods and Services Tax total.
* **Total Tax / TDS**: Total tax amount.
* **Grand Total**: Combined total receivable formatted in Indian Rupees (`₹`).

### 3. Filters
* **Date Range**: Filter invoices between a specific **From Date** and **To Date**.
* **Client Filter**: Select a specific client or choose **All Clients**.
* **Profile Filter**: Select a specific business profile or choose **All Profiles**.

### 4. Summary CSV Export
* Click the **Export CSV** button in the dashboard header to download a spreadsheet (`invoices_summary_<timestamp>.csv`) containing the currently filtered invoices, complete with invoice numbers, dates, client names, and tax totals.

### 5. Recent Invoices Table
* Displays the latest generated invoices with quick links to preview or edit each invoice.

---

## 4. Client Management

Navigate to **Client** in the sidebar (`/clients`) to manage client billing profiles.

### Viewing & Searching Clients
* Browse clients displayed in structured cards.
* Use the **Search Bar** at the top to filter clients by **Client Name**, **Email**, or **Contact Number**.

### Creating a New Client
1. Click the **+ Add Client** button in the top-right corner.
2. In the modal, fill in the required billing information:
   * **Client Name**: Company or individual name (letters and spaces only).
   * **Industry**: Choose from standard industry categories (e.g., *IT & ITeS*, *Apparel & Fashion*, *Manufacturing*, etc.) or choose *Others*.
   * **Email Address**: Official billing email (used for invoice delivery).
   * **Contact Number**: Exactly **10 digits** (numbers only).
   * **Address Line 1 & Line 2**: Street address, building, or suite number.
   * **Country**: Select country (e.g., *India*, *USA*, *UK*, etc.).
   * **State**: Select state from the dropdown.
   * **City**: Select city from the state-filtered dropdown (or enter custom city if *Others* is selected).
   * **Pincode**: Exactly **6 digits** (numbers only).
   * **Tax No (TAN)**: Client Tax Deduction and Collection Account Number.
   * **GST No**: 15-character uppercase alphanumeric Goods and Services Tax Identification Number (e.g., `33AAAAA0000A1Z5`).
3. Click **Submit**. A success modal will confirm creation and display the assigned serial number.

### Editing a Client
1. Locate the client card and click the **Edit** icon.
2. Update the contact, address, or tax details.
3. Click **Save Changes**.

### Quick Invoice Creation
* Each client card features a direct **Create Invoice** shortcut button. Clicking it opens the invoice creation form with the client pre-selected.

---

## 5. Business Profile Management

Navigate to **Profile** in the sidebar (`/profiles`) to view and maintain your issuing company profiles.

### Creating or Updating an Issuer Profile
1. Click **+ Add Profile** or click **Edit** on an existing profile.
2. Complete the required company information:
   * **Company Name**: Registered legal name of your entity (letters and spaces only).
   * **Point of Contact (POC)**: Primary billing representative (letters only).
   * **Email Address**: Official corporate billing email.
   * **Contact Number**: 10-digit primary telephone/mobile number.
   * **Address Line 1 & Line 2**: Registered office address.
   * **Country, State, City, Pincode**: Official location details (Pincode must be 6 digits).
   * **GST No**: Official 15-character company GSTIN.
   * **Tax No (TAN)**: Corporate Tax Deduction Account Number.
   * **Team Size**: Select organization headcount band (e.g., *2-10*, *10-20*, *20-50*, etc.).
   * **Industry**: Sector description.
3. Click **Save**.

---

## 6. Invoice Management Workflow

Navigate to **Invoice** in the sidebar (`/invoices`) or click **+ Add Invoice** (`/add-invoice`).

### Step-by-Step Invoice Creation
1. **Invoice Number**: Automatically calculated and sequential (e.g., `0001`, `0002`). Operators may adjust if specific custom prefixes are authorized.
2. **Select Business Profile**: Choose your company's issuing entity from the dropdown.
3. **Select Client**: Select the recipient client. The client's billing address and GSTIN populate automatically.
4. **Invoice Dates**:
   * **Invoice Date**: Creation/issue date.
   * **Due Date**: Payment deadline. *Rule: Due Date cannot be earlier than Invoice Date.*
5. **Bank Details (Remittance Instructions)**:
   * **Account Holder Name**: Entity name as registered with the bank.
   * **Bank Name**: Name of the commercial bank (e.g., *HDFC Bank*).
   * **Account Number & Confirm Account Number**: Must match exactly.
   * **IFSC Code**: 11-character bank branch code (e.g., `HDFC0001234`).
   * **Branch Location**: Physical branch town/city.
   * **Account Type**: Select *Current* or *Savings*.
6. **Adding Line Items**:
   * **Item / Service**: Name of the service or product delivered.
   * **Description**: Itemized scope, milestones, or project notes.
   * **Quantity**: Number of units/hours (must be greater than 0).
   * **Rate / Amount**: Unit price in INR.
   * **SGST Rate %**: Default is 9% (State GST).
   * **CGST Rate %**: Default is 9% (Central GST).
   * *Calculation*: Base Amount, SGST, CGST, and Line Total calculate automatically.
   * Click **+ Add Item** to append additional services.
7. **Authorized Signature**: Upload a clean PNG/JPEG image of the company seal or authorized sign-off.
8. **Grand Total & Number to Words**: The system sums all taxable values and taxes, and converts the total into Indian legal words (*e.g., "Rupees Fifty-Nine Thousand Only"*).
9. Click **Create Invoice** to save.

### Updating Invoice Lifecycle Statuses
On the **Invoices** list (`/invoices`), operators can update tracking statuses via direct dropdowns:
* **Invoice Status**: `Pending`, `Approved`, `Rejected`, or `Archived`.
* **GST Status**: `Filed` or `Not Filed`.
* **Accounts Status**: `Fund Received` or `Fund Pending`.

### Archiving vs. Deleting Financial Records
> **Core Principle: Archive rather than destroy.**

* **Legal Retention Requirement**: Under Section 36 of the CGST Act and Section 128 of the Companies Act, businesses must retain financial transaction records for **at least 8 years**.
* **How to Archive**: Select **Archived** from the **Inv Status** dropdown. The status badge will update to a subtle grey tone (`#64748b`), signifying the invoice is retired from active processing.
* **Non-Destructive Archival Guarantee**: Marking an invoice as *Archived* does **not** delete any data. All invoice headers, customer details, bank remittance information, and individual line items remain intact in the database.
* **Finding Archived Invoices**: Type `Archived` or the invoice number in the search bar on the `/invoices` page to instantly view archived records.
* **Restoring an Archived Invoice**: If an invoice was archived by mistake, simply select **Pending** or **Approved** from the dropdown. The system automatically records the restoration (`UNARCHIVE`) in the audit log.
* **Physical Deletion (`Trash` icon)**: Only use the Delete button for erroneous test entries created during setup or testing. Do not use deletion for genuine customer invoices. Every deletion is permanently logged with the operator's identity in the Audit Trail.

---

## 7. PDF Document Generation

Every invoice can be viewed and printed as an official PDF.

### How to Generate & Download
1. On the **Invoices** list, click the **Preview / Eye** icon next to any invoice, or navigate to `/invoice/preview/:serialNo`.
2. Review the rendered A4 invoice layout on screen.
3. Click the **Download PDF** button in the upper toolbar.
4. The system compiles and downloads an official document named `Invoice-<invoiceNo>.pdf`.

### Document Contents
* Company Header with registered address, contact, and GSTIN.
* "Billed To" Client section with delivery coordinates.
* Invoice Reference Table (Invoice Number, Issue Date, Payment Due Date).
* Itemized Table (Item, Description, QTY, Unit Rate, Taxable Value, SGST, CGST, Line Total).
* Bank Transfer Instructions box for client remittance.
* Grand Total in numerals and formal Indian currency in words.
* Authorized signatory seal and signature.

---

## 8. Emailing an Invoice to a Client

Invoices can be emailed directly to clients with the PDF document attached.

### How to Send
1. Open the invoice in **Invoice Preview** (`/invoice/preview/:serialNo`).
2. Click the **Send Email** button in the toolbar.
3. The **Compose Email** modal opens:
   * **To**: Pre-populated with the client's registered email address.
   * **Cc / Bcc**: Enter additional recipient emails separated by commas if required.
   * **Subject**: Pre-filled with standard formal subject (*e.g., "Invoice 0001 from VTAB Square"*).
   * **Message Body**: Pre-filled with formal greeting, total amount, and due date. Operators may customize this text.
4. Verify all email addresses carefully.
5. Click **Send**.
6. A success notification will appear once the email is dispatched.

---

## 9. Password Reset & OTP Workflow

If an operator forgets their login credentials, they can reset their password using a one-time password (OTP).

### Step-by-Step Reset
1. On the login screen, click **Forgot Password?**.
2. Enter your registered operator email address and click **Send OTP**.
3. Check your email inbox for the 6-digit verification code.
4. Enter the received code on the **Verify OTP** screen and click **Verify**.
5. On the **Reset Password** screen, enter your **New Password**.
6. Click **Change Password**.
7. Upon success, you are returned to the login screen to sign in with your new credentials.

*Note: OTP codes expire within 5 minutes. If your code expires, click "Resend OTP".*

---

## 10. Data Backup & Point-in-Time Snapshots

The application includes an automated backup mechanism that captures complete point-in-time snapshots of all business records.

### How Backups Work
* Backups capture 100% of business data: **Clients**, **Profiles**, **Invoice Headers**, **Invoice Line Items**, and the **Audit Log**.
* Backups are exportable in structured **JSON** and multi-sheet **CSV** formats.
* Each backup file is timestamped (e.g., `backup_20260929_143000.json`) and stored securely. Previous backups are never overwritten.
* Backups are **read-only snapshots** and do not alter or disrupt live application operations.
* *Security Note*: Authentication secrets and passwords are strictly excluded from backup files to preserve security.

---

## 11. Audit Trail & Compliance

Every critical administrative and financial action is recorded in the system's **Audit Trail**.

### What Is Recorded
* Operator logins and failed authentication attempts.
* Client additions, edits, and deletions.
* Profile additions and updates.
* Invoice creation, line item changes, and status updates.
* Invoice archiving (`ARCHIVE`) and restoration (`UNARCHIVE`) actions.
* Invoice email transmissions.
* Password reset requests and completions.
* Backup creation events.

### Information Logged
Each audit entry includes: `Timestamp (UTC)`, `Operator Email`, `Action`, `Entity`, `Entity ID`, `Status (SUCCESS/FAILED)`, `Details`, and `IP Address`.

### Operator Guidance
* The audit trail provides legal and regulatory traceability. If a discrepancy arises regarding an invoice modification or client change, consult the audit log to identify who made the change and when.

---

## 12. Application Health & System Status

The application provides real-time health verification via the `/health` endpoint to monitor system and database connectivity.

### Status Meaning
* **`status: "ok"` (HTTP 200)**: The API application and Google Sheets database connection are operating normally.
* **`status: "degraded"` (HTTP 503)**: The server is running, but live communication with the Google Sheets database is temporarily interrupted or Google Cloud rate limits were reached.

### Operator Actions on "Degraded"
* Pause data entry for 1–2 minutes to allow Google Cloud API rate limits to reset.
* If degraded status persists, contact your technical administrator.

---

## 13. Common Problems & Troubleshooting

| Problem | What the Operator Should Check | Recommended Action |
| :--- | :--- | :--- |
| **Cannot log in** | Password accuracy, Caps Lock, or account status | Double-check credentials. If locked out by rate limiting, wait 5 minutes or use **Forgot Password?**. |
| **Validation Error: "Contact Number must be exactly 10 digits"** | Client or Profile contact field | Ensure only 10 numerical digits are entered without spaces, dashes, or `+91`. |
| **Validation Error: "Pincode must be 6 digits"** | Postal code field | Ensure exactly 6 numerical digits are entered. |
| **Validation Error: "Business Name must contain only alphabets"** | Company or Client name | Remove numbers or special symbols from the business name field. |
| **Invoice Due Date Error** | Selected Invoice Date and Due Date | Ensure the Due Date is set to the same day or a date **after** the Invoice Date. |
| **Invoice Line Item Error** | Line items table in invoice editor | Verify that at least one line item exists, with quantity > 0 and amount >= 0. |
| **Bank Account Mismatch** | Remittance account fields | Confirm that "Account No" and "Confirm Account No" match character-for-character. |
| **PDF Download Fails or Blank** | Browser popup blockers or download settings | Allow popups for the invoice application URL, refresh the page, and retry. |
| **Email Fails to Send** | Client email address syntax | Confirm the recipient email is valid (e.g., `client@company.com`). Verify that your internet connection is active. |
| **System Reports "Degraded" or Slow Save** | Live Google Sheets connection | Wait 60 seconds and retry saving. Avoid rapid repeated button clicks. |

---

## 14. Operator Security Guidelines

To maintain data protection, regulatory compliance, and confidentiality:

1. **Keep Credentials Confidential**: Never share your login credentials or allow other team members to use your account.
2. **Protect OTPs**: Never disclose one-time passwords received via email to anyone.
3. **Log Out When Away**: Always click **Logout** before stepping away from your desk or leaving a shared computer.
4. **Verify Recipient Information**: Double-check client email addresses before clicking "Send Email" to prevent inadvertent disclosure of financial data.
5. **Do Not Manually Alter Raw Sheets**: Do not manually reorder, rename, or delete columns in Google Sheets without technical administrator guidance, as this may disrupt automatic formula mapping.
6. **Archive Over Delete for Financial Compliance**: Always set invoices to **Archived** status rather than deleting them. Financial regulations require retaining invoice records for at least 8 years. Never purge historical transaction rows from Google Sheets.
7. **Report Anomalies**: Report any suspicious login notices, unrecognized audit entries, or unexplained errors immediately.

---

## 15. When to Contact the Technical Administrator

Stop retrying and immediately escalate to your technical administrator under the following circumstances:

* **Persistent Google Sheets 503 Errors**: Application remains in degraded mode for more than 5 minutes.
* **Persistent Email Dispatch Failure**: Invoices consistently fail to send despite verifying client email addresses.
* **Database Discrepancies**: Client, profile, or invoice numbers appear missing or misaligned.
* **Repeated Login Lockout**: Operator cannot receive OTP emails or cannot reset password.
* **Server Downtime**: Web portal fails to load or displays server connection errors.
