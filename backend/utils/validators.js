/**
 * Input Validation & Sanitization Utilities
 * VTAB Square Invoice Application
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ALPHA_REGEX = /^[a-zA-Z\s]*$/;
const DIGITS_ONLY_REGEX = /^\d+$/;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-.]+$/;

/**
 * Check if a value is a valid email address
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    return trimmed.length >= 5 && trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

/**
 * Check if a value is a valid 10-digit phone/contact number
 */
function isValidPhone(phone) {
    if (!phone || (typeof phone !== 'string' && typeof phone !== 'number')) return false;
    const str = String(phone).trim();
    return str.length === 10 && DIGITS_ONLY_REGEX.test(str);
}

/**
 * Check if a value is a valid 6-digit pincode
 */
function isValidPincode(pincode) {
    if (!pincode || (typeof pincode !== 'string' && typeof pincode !== 'number')) return false;
    const str = String(pincode).trim();
    return str.length === 6 && DIGITS_ONLY_REGEX.test(str);
}

/**
 * Check if a value is a valid finite real number (rejects NaN, Infinity, -Infinity, null, etc.)
 */
function isValidFiniteNumber(val) {
    if (val === null || val === undefined || typeof val === 'boolean') return false;
    if (typeof val === 'number') {
        return Number.isFinite(val) && !Number.isNaN(val);
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return false;
        const num = Number(trimmed);
        return Number.isFinite(num) && !Number.isNaN(num);
    }
    return false;
}

/**
 * Check if a value is a positive finite number (>= 0)
 */
function isValidPositiveNumber(val) {
    return isValidFiniteNumber(val) && Number(val) >= 0;
}

/**
 * Check if a value is a valid date string
 */
function isValidDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const parsed = Date.parse(dateStr);
    return !isNaN(parsed);
}

/**
 * Check if a route/query parameter identifier is safe
 */
function isValidIdentifier(id) {
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) return false;
    const str = String(id).trim();
    return str.length > 0 && str.length <= 100 && SAFE_ID_REGEX.test(str);
}

/**
 * Validate Client input for Create or Update
 */
function validateClientInput(data) {
    if (!data || typeof data !== 'object') {
        return { isValid: false, message: "Invalid request payload" };
    }

    const {
        name, email, contact,
        address1, address2, country, state, city, pincode,
        taxNo, gstNo
    } = data;

    if (!name || !email || !contact || !address1 || !address2 || !country || !state || !city || !pincode || !taxNo || !gstNo) {
        return { isValid: false, message: "All required fields must be filled (including TAN and GST)" };
    }

    const strName = String(name).trim();
    if (!ALPHA_REGEX.test(strName)) {
        return { isValid: false, message: "Client Name must contain only alphabets" };
    }
    if (strName.length > 150) {
        return { isValid: false, message: "Client Name exceeds maximum length of 150 characters" };
    }

    const strEmail = String(email).trim();
    if (!isValidEmail(strEmail)) {
        return { isValid: false, message: "Invalid email address format" };
    }

    const strContact = String(contact).trim();
    if (strContact.length !== 10 || !DIGITS_ONLY_REGEX.test(strContact)) {
        return { isValid: false, message: "Contact Number must be exactly 10 digits" };
    }

    const strPincode = String(pincode).trim();
    if (strPincode.length !== 6 || !DIGITS_ONLY_REGEX.test(strPincode)) {
        return { isValid: false, message: "Pincode must be exactly 6 digits" };
    }

    const strTaxNo = String(taxNo).trim();
    if (strTaxNo.length < 11 || strTaxNo.length > 16) {
        return { isValid: false, message: "TAN Number must be 11 to 16 characters" };
    }

    const strGstNo = String(gstNo).trim();
    if (strGstNo.length < 11 || strGstNo.length > 16) {
        return { isValid: false, message: "GST Number must be 11 to 16 characters" };
    }

    if (String(address1).length > 255 || String(address2).length > 255) {
        return { isValid: false, message: "Address fields exceed maximum length of 255 characters" };
    }

    return { isValid: true };
}

/**
 * Validate Profile input for Create or Update
 */
function validateProfileInput(data) {
    if (!data || typeof data !== 'object') {
        return { isValid: false, message: "Invalid request payload" };
    }

    const {
        companyName, pointOfContact, email, contactNo,
        address1, address2, city, state, country, pincode,
        gstNo, teamSize, industry, taxNo
    } = data;

    if (!companyName || !email || !contactNo || !address1 || !address2 || !city || !state || !country || !pincode || !teamSize || !gstNo || !taxNo || !industry || !pointOfContact) {
        return { isValid: false, message: "All required fields must be filled (including Industry and Point of Contact)" };
    }

    const strCompany = String(companyName).trim();
    if (!ALPHA_REGEX.test(strCompany)) {
        return { isValid: false, message: "Business Name must contain only alphabets" };
    }
    if (strCompany.length > 150) {
        return { isValid: false, message: "Business Name exceeds maximum length of 150 characters" };
    }

    const strIndustry = String(industry).trim();
    if (!ALPHA_REGEX.test(strIndustry)) {
        return { isValid: false, message: "Industry must contain only alphabets" };
    }

    const strPoc = String(pointOfContact).trim();
    if (!ALPHA_REGEX.test(strPoc)) {
        return { isValid: false, message: "Point of Contact must contain only alphabets" };
    }

    const strEmail = String(email).trim();
    if (!isValidEmail(strEmail)) {
        return { isValid: false, message: "Invalid email address format" };
    }

    const strContact = String(contactNo).trim();
    if (strContact.length !== 10 || !DIGITS_ONLY_REGEX.test(strContact)) {
        return { isValid: false, message: "Contact Number must be exactly 10 digits" };
    }

    const strPincode = String(pincode).trim();
    if (strPincode.length !== 6 || !DIGITS_ONLY_REGEX.test(strPincode)) {
        return { isValid: false, message: "Pincode must be exactly 6 digits" };
    }

    const strGstNo = String(gstNo).trim();
    if (strGstNo.length < 11 || strGstNo.length > 16) {
        return { isValid: false, message: "GST Number must be 11 to 16 characters" };
    }

    const strTaxNo = String(taxNo).trim();
    if (strTaxNo.length < 11 || strTaxNo.length > 16) {
        return { isValid: false, message: "TAN Number must be 11 to 16 characters" };
    }

    return { isValid: true };
}

/**
 * Validate Invoice input for Create or Update
 */
function validateInvoiceInput(data) {
    if (!data || typeof data !== 'object') {
        return { isValid: false, message: "Invalid request payload" };
    }

    const {
        invoiceNo, invoiceDate, dueDate, profileName, clientName,
        lineItems, accountHolderName, accountNo,
        branchLocation, ifscCode, accountType, bankName
    } = data;

    if (!invoiceNo || !invoiceDate || !profileName || !clientName || !lineItems || !dueDate || !accountHolderName || !accountNo || !branchLocation || !ifscCode || !accountType || !bankName) {
        return { isValid: false, message: "Missing required invoice fields (including Bank Details, Bank Account Name, and Due Date)" };
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
        return { isValid: false, message: "Missing required invoice fields (line items cannot be empty)" };
    }

    if (lineItems.length > 100) {
        return { isValid: false, message: "Invoice exceeds maximum permitted line items limit (100)" };
    }

    if (!isValidDateString(invoiceDate) || !isValidDateString(dueDate)) {
        return { isValid: false, message: "Invalid invoice or due date format" };
    }

    if (dueDate < invoiceDate) {
        return { isValid: false, message: "Due Date cannot be earlier than Invoice Date" };
    }

    const strInvoiceNo = String(invoiceNo).trim();
    if (strInvoiceNo.length > 100 || !SAFE_ID_REGEX.test(strInvoiceNo)) {
        return { isValid: false, message: "Invoice Number contains invalid characters or exceeds 100 characters" };
    }

    const strHolder = String(accountHolderName).trim();
    if (!ALPHA_REGEX.test(strHolder)) {
        return { isValid: false, message: "Account Holder Name must contain only alphabets" };
    }

    const strBank = String(bankName).trim();
    if (!ALPHA_REGEX.test(strBank)) {
        return { isValid: false, message: "Bank Account Name must contain only alphabets" };
    }

    const strBranch = String(branchLocation).trim();
    if (!ALPHA_REGEX.test(strBranch)) {
        return { isValid: false, message: "Branch Location must contain only alphabets" };
    }

    const strIfsc = String(ifscCode).trim();
    if (strIfsc.length < 11 || strIfsc.length > 13) {
        return { isValid: false, message: "IFSC Code must be 11 to 13 characters" };
    }

    // Validate each line item
    for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        if (!item || typeof item !== 'object') {
            return { isValid: false, message: `Line item #${i + 1} is malformed` };
        }

        // Amount validation
        if (item.amount !== undefined && item.amount !== null && item.amount !== '') {
            if (!isValidPositiveNumber(item.amount)) {
                return { isValid: false, message: `Line item #${i + 1} amount must be a valid positive number` };
            }
        }

        // Quantity validation
        if (item.quantity !== undefined && item.quantity !== null && item.quantity !== '') {
            if (!isValidPositiveNumber(item.quantity) || Number(item.quantity) <= 0) {
                return { isValid: false, message: `Line item #${i + 1} quantity must be a positive number greater than zero` };
            }
        }

        // Tax rates validation
        if (item.sgstRate !== undefined && item.sgstRate !== null && item.sgstRate !== '') {
            if (!isValidPositiveNumber(item.sgstRate) || Number(item.sgstRate) > 100) {
                return { isValid: false, message: `Line item #${i + 1} SGST rate must be between 0 and 100` };
            }
        }

        if (item.cgstRate !== undefined && item.cgstRate !== null && item.cgstRate !== '') {
            if (!isValidPositiveNumber(item.cgstRate) || Number(item.cgstRate) > 100) {
                return { isValid: false, message: `Line item #${i + 1} CGST rate must be between 0 and 100` };
            }
        }
    }

    return { isValid: true };
}

module.exports = {
    isValidEmail,
    isValidPhone,
    isValidPincode,
    isValidFiniteNumber,
    isValidPositiveNumber,
    isValidDateString,
    isValidIdentifier,
    validateClientInput,
    validateProfileInput,
    validateInvoiceInput,
};
