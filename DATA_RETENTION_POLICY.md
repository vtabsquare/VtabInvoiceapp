# Data Retention & Deletion Policy
**VTAB Square Invoice Application**

**Document Version:** 1.0.0  
**Effective Date:** September 2026  
**Applicability:** All administrative operators, finance teams, and system administrators  
**Classification:** Internal Operational Policy  

---

## 1. Executive Summary & Core Principle

The VTAB Square Invoice Application governs the generation, distribution, and archival of financial invoices, client master records, business profiles, and system audit logs.

### Core Principle
> **"Do not delete financial records. Archive rather than destroy."**

Under statutory commercial and taxation regulations, financial transaction records must be permanently or long-term preserved for legal compliance, tax assessments, and audits. Standard business operations must never destroy or physically delete financial records. Deletion is replaced with a **non-destructive archival model**.

---

## 2. Statutory & Regulatory Framework

This policy complies with applicable Indian and international taxation and record-keeping mandates:

1. **Central Goods and Services Tax (CGST) Act, 2017 (Section 36):**
   Every registered person must keep and maintain books of account and other records until the expiry of **seventy-two months (6 years)** from the due date of furnishing of the annual return for the year pertaining to such accounts and records (effective statutory retention of **7+ years**).
2. **Companies Act, 2013 (Section 128):**
   Books of accounts, vouchers, and relevant financial papers of every company relating to a period of not less than **eight financial years** immediately preceding a financial year must be preserved in good order.
3. **Income Tax Act, 1961 (Section 44AA & Rule 6F):**
   Books of account and other documents must be kept and maintained for a minimum period of **6 to 8 years** from the end of the relevant assessment year.
4. **Information Technology Act, 2000 & IT Rules:**
   Mandates retention of system logs, electronic records, and audit trails for evidentiary verification.

---

## 3. Data Retention Schedule Matrix

The following schedule defines the mandatory retention lifecycle for each data entity in the application:

| Entity / Category | Storage Location | Retention Period | Action at End of Active Life | Destructive Deletion Allowed? |
| :--- | :--- | :--- | :--- | :--- |
| **Invoices (`invoice header`)** | Google Sheet `invoice header` | **Minimum 8 Years** (Statutory) | Set `invoiceStatus` to `Archived` | ❌ **PROHIBITED** in normal operations |
| **Invoice Details (`invoice details`)** | Google Sheet `invoice details` | **Minimum 8 Years** (Statutory) | Retained with parent invoice | ❌ **PROHIBITED** in normal operations |
| **Client Master Records (`Client`)** | Google Sheet `Client` | **Permanent / 8 Years** post-cessation | Retained for referential integrity | ❌ **PROHIBITED** if linked to any invoice |
| **Business Profiles (`profile`)** | Google Sheet `profile` | **Permanent / 8 Years** post-cessation | Retained for historical tax validation | ❌ **PROHIBITED** if referenced in invoices |
| **System Audit Logs (`audit_log`)** | Google Sheet `audit_log` | **Permanent (Append-Only)** | Retained indefinitely for security | ❌ **STRICTLY PROHIBITED** |
| **System Data Backups** | `backend/backups/` (JSON / CSV) | **Hot: 90 Days; Cold: 8 Years** | Rotated / moved to cold storage | ⚠️ Only during scheduled backup rotation |
| **Authentication Tokens (JWT)** | Client `sessionStorage` / Headers | **24 Hours** | Automatic expiration (`jwt.verify`) | ✅ Automatic session expiry |
| **Password Reset OTPs** | In-Memory (`otpStore`) | **10 Minutes** | Automatic expiry & post-reset purge | ✅ Immediate memory cleanup |

---

## 4. Archival Architecture & Workflow

### 4.1 Non-Destructive Archival Method
Instead of physically removing records, the application provides an **Archival status**:
- The `invoice header` sheet utilizes Column S (`invoice status`).
- Permitted status values: `Pending`, `Approved`, `Rejected`, and `Archived`.
- When an invoice lifecycle is concluded, settled, or retired, operators transition its status to `Archived`.

### 4.2 Record Integrity Guarantees
When an invoice is marked as `Archived`:
1. **Header Preserved:** All columns (Serial No, Invoice No, Client, Profile, Dates, Subtotal, Taxes, Total, Bank details) remain intact in `invoice header`.
2. **Line Items Preserved:** All associated item rows remain intact in `invoice details` (Item description, Quantity, Rate, Amount).
3. **Audit Trail Logged:** The transition automatically records an entry in `audit_log`:
   - `action`: `ARCHIVE`
   - `entity`: `INVOICE`
   - `entityId`: `<SerialNo>`
   - `status`: `SUCCESS`
   - `adminEmail`: Authenticated operator's email
   - `ipAddress`: Client IP address
4. **PDF Generation Operational:** Archived invoices can still be viewed, printed, and downloaded as PDFs with historical accuracy at any future date.
5. **Backup Inclusion:** Backup exports (`POST /api/admin/backup`) include all archived invoices, ensuring full historical preservation.

### 4.3 Reversibility (Unarchiving)
If an invoice was archived by mistake:
- The operator transitions `invoiceStatus` back to `Pending` or `Approved`.
- The system automatically logs `action: UNARCHIVE` in `audit_log`.

---

## 5. Deletion Safeguards & Exception Handling

### 5.1 When Is Deletion Prohibited?
- Invoices that have been issued, billed, filed for GST, or settled must **never** be deleted.
- Clients or Profiles that are referenced in any historical invoice must **never** be deleted.

### 5.2 Exceptional Deletion Protocol
Physical deletion via `DELETE /api/admin/invoices/:serialNo` is strictly restricted to:
1. Mistakenly created test records during system staging.
2. Legally mandated regulatory erasure orders (where statutory tax retention is not applicable).

**Mandatory Deletion Safeguards:**
1. **Authentication:** Only authenticated operators with valid JWT credentials can invoke deletion endpoints.
2. **Pre-Deletion Backup:** Operators must create a manual backup via `POST /api/admin/backup` prior to performing any deletion.
3. **Permanent Audit Recording:** Every deletion invokes `logAudit` with `action: DELETE`, `entity: INVOICE` or `CLIENT`, capturing the operator email and timestamp.
4. **No Cascade Destruction:** Deletion of an invoice header is coordinated with line items to prevent orphaned records.

---

## 6. Audit Trail & Verification

The `audit_log` tab in Google Sheets maintains an immutable, append-only history of all data modification and retention events:

```text
[Timestamp] | [Admin Email] | [Action] | [Entity] | [Entity ID] | [Status] | [IP Address] | [Details]
```

Audit records are never deleted, even if the referenced business entity is archived.

---

## 7. Compliance Checklist for Finance Operators

- [ ] **Always Archive Instead of Deleting:** When an invoice is complete, cancelled, or superseded, change its status to **Archived**.
- [ ] **Search Archived Records:** Use the search bar on the Invoices page to find archived records by typing `Archived`, invoice number, or client name.
- [ ] **Verify Backups Before Year-End Close:** Execute a full JSON/CSV backup before conducting financial year-end closing.
- [ ] **Preserve Google Sheet Columns:** Never manually delete columns or change sheet tab names in the Google Sheets workbook.
