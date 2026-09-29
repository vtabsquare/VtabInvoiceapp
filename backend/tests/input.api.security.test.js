const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');
const {
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
} = require('../utils/validators');

let server;
let baseURL;
let validToken;
let expiredToken;
let invalidToken;

// Helper to make HTTP requests
function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseURL);
        const headers = { ...options.headers };
        const reqOptions = {
            method: options.method || 'GET',
            headers,
        };

        const req = http.request(url, reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (_) {
                    // plain text response
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                });
            });
        });

        req.on('error', reject);

        if (options.body) {
            const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('Content-Length', Buffer.byteLength(bodyStr));
            req.write(bodyStr);
        }

        req.end();
    });
}

describe('Input & API Security Tests', () => {

    before(async () => {
        validToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
        expiredToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, JWT_SECRET, { expiresIn: '-10s' });
        invalidToken = jwt.sign({ email: 'admin@vtab.com', role: 'admin' }, 'different_tampered_secret', { expiresIn: '1h' });

        await new Promise((resolve) => {
            server = app.listen(0, () => {
                baseURL = `http://localhost:${server.address().port}`;
                resolve();
            });
        });
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    /* ====================================================================
       1. Validator Unit Tests
       ==================================================================== */
    describe('1. Validator Function Unit Tests', () => {
        it('isValidEmail correctly identifies valid and invalid emails', () => {
            assert.strictEqual(isValidEmail('admin@vtab.com'), true);
            assert.strictEqual(isValidEmail('user.name+tag@sub.domain.co'), true);
            assert.strictEqual(isValidEmail('plainaddress'), false);
            assert.strictEqual(isValidEmail('@missingusername.com'), false);
            assert.strictEqual(isValidEmail('missingdomain@.com'), false);
            assert.strictEqual(isValidEmail(''), false);
            assert.strictEqual(isValidEmail(null), false);
            assert.strictEqual(isValidEmail(12345), false);
        });

        it('isValidPhone accepts strict 10 digits and rejects invalid formats', () => {
            assert.strictEqual(isValidPhone('9876543210'), true);
            assert.strictEqual(isValidPhone(9876543210), true);
            assert.strictEqual(isValidPhone('123456789'), false); // 9 digits
            assert.strictEqual(isValidPhone('12345678901'), false); // 11 digits
            assert.strictEqual(isValidPhone('987654321a'), false); // alpha
            assert.strictEqual(isValidPhone(''), false);
            assert.strictEqual(isValidPhone(null), false);
        });

        it('isValidPincode accepts strict 6 digits and rejects invalid formats', () => {
            assert.strictEqual(isValidPincode('600001'), true);
            assert.strictEqual(isValidPincode(600001), true);
            assert.strictEqual(isValidPincode('60001'), false); // 5 digits
            assert.strictEqual(isValidPincode('6000001'), false); // 7 digits
            assert.strictEqual(isValidPincode('60000A'), false); // alpha
            assert.strictEqual(isValidPincode(''), false);
            assert.strictEqual(isValidPincode(null), false);
        });

        it('isValidFiniteNumber accepts finite numbers and strictly rejects NaN / Infinity', () => {
            assert.strictEqual(isValidFiniteNumber(100), true);
            assert.strictEqual(isValidFiniteNumber(0), true);
            assert.strictEqual(isValidFiniteNumber(-50.25), true);
            assert.strictEqual(isValidFiniteNumber('45.99'), true);
            assert.strictEqual(isValidFiniteNumber(NaN), false);
            assert.strictEqual(isValidFiniteNumber(Infinity), false);
            assert.strictEqual(isValidFiniteNumber(-Infinity), false);
            assert.strictEqual(isValidFiniteNumber('Infinity'), false);
            assert.strictEqual(isValidFiniteNumber('NaN'), false);
            assert.strictEqual(isValidFiniteNumber(''), false);
            assert.strictEqual(isValidFiniteNumber(null), false);
            assert.strictEqual(isValidFiniteNumber(undefined), false);
            assert.strictEqual(isValidFiniteNumber(true), false);
            assert.strictEqual(isValidFiniteNumber({}), false);
        });

        it('isValidPositiveNumber accepts non-negative finite numbers', () => {
            assert.strictEqual(isValidPositiveNumber(0), true);
            assert.strictEqual(isValidPositiveNumber(150), true);
            assert.strictEqual(isValidPositiveNumber('25.5'), true);
            assert.strictEqual(isValidPositiveNumber(-1), false);
            assert.strictEqual(isValidPositiveNumber('-0.01'), false);
            assert.strictEqual(isValidPositiveNumber(NaN), false);
            assert.strictEqual(isValidPositiveNumber(Infinity), false);
        });

        it('isValidIdentifier validates safe route identifiers and rejects dangerous patterns', () => {
            assert.strictEqual(isValidIdentifier('00001'), true);
            assert.strictEqual(isValidIdentifier('INV-2026-001'), true);
            assert.strictEqual(isValidIdentifier('client_abc-123'), true);
            assert.strictEqual(isValidIdentifier('../../../etc/passwd'), false);
            assert.strictEqual(isValidIdentifier('<script>alert(1)</script>'), false);
            assert.strictEqual(isValidIdentifier('id with spaces and tabs\t'), false);
            assert.strictEqual(isValidIdentifier('a'.repeat(101)), false); // exceeds 100 chars
            assert.strictEqual(isValidIdentifier(''), false);
            assert.strictEqual(isValidIdentifier(null), false);
        });

        it('validateClientInput verifies client payload integrity', () => {
            const validClient = {
                name: 'Alpha Technologies',
                industry: 'Information Technology',
                email: 'contact@alpha.com',
                contact: '9876543210',
                address1: '123 Tech Park',
                address2: 'OMR Road',
                city: 'Chennai',
                state: 'Tamil Nadu',
                country: 'India',
                pincode: '600096',
                taxNo: 'CHNA12345B1',
                gstNo: '33AAAAA0000A1Z5'
            };
            const result = validateClientInput(validClient);
            assert.strictEqual(result.isValid, true);

            // Rejects non-alphabetic client name
            const invalidNameResult = validateClientInput({ ...validClient, name: 'Client 1234' });
            assert.strictEqual(invalidNameResult.isValid, false);
            assert.ok(invalidNameResult.message.includes('only alphabets'));

            // Rejects invalid phone
            const invalidPhoneResult = validateClientInput({ ...validClient, contact: '12345' });
            assert.strictEqual(invalidPhoneResult.isValid, false);
            assert.ok(invalidPhoneResult.message.includes('10 digits'));

            // Rejects invalid email
            const invalidEmailResult = validateClientInput({ ...validClient, email: 'not-an-email' });
            assert.strictEqual(invalidEmailResult.isValid, false);
            assert.ok(invalidEmailResult.message.includes('email'));
        });

        it('validateInvoiceInput verifies invoice and line items constraints', () => {
            const validInvoice = {
                invoiceNo: 'INV-2026-001',
                invoiceDate: '2026-03-01',
                dueDate: '2026-03-15',
                profileName: 'VTAB Square',
                clientName: 'Alpha Tech',
                accountHolderName: 'VTAB Square Private Limited',
                accountNo: '123456789012',
                confirmAccountNo: '123456789012',
                branchLocation: 'Chennai OMR',
                ifscCode: 'HDFC0001234',
                accountType: 'Current',
                bankName: 'HDFC Bank',
                lineItems: [
                    { item: 'Consulting', description: 'Monthly fee', amount: 50000, quantity: 1, sgstRate: 9, cgstRate: 9 }
                ]
            };
            const validResult = validateInvoiceInput(validInvoice);
            assert.strictEqual(validResult.isValid, true);

            // Rejects empty line items
            const emptyItems = validateInvoiceInput({ ...validInvoice, lineItems: [] });
            assert.strictEqual(emptyItems.isValid, false);
            assert.ok(emptyItems.message.includes('required invoice fields'));

            // Rejects excessive line items (> 100)
            const excessiveItems = validateInvoiceInput({
                ...validInvoice,
                lineItems: Array(101).fill({ item: 'Service', amount: 100, quantity: 1 })
            });
            assert.strictEqual(excessiveItems.isValid, false);
            assert.ok(excessiveItems.message.includes('maximum permitted line items limit'));

            // Rejects due date earlier than invoice date
            const badDates = validateInvoiceInput({
                ...validInvoice,
                invoiceDate: '2026-03-20',
                dueDate: '2026-03-01'
            });
            assert.strictEqual(badDates.isValid, false);
            assert.ok(badDates.message.includes('earlier than Invoice Date'));

            // Rejects non-finite amount (NaN / Infinity)
            const nanAmount = validateInvoiceInput({
                ...validInvoice,
                lineItems: [{ item: 'Service', amount: 'Infinity', quantity: 1 }]
            });
            assert.strictEqual(nanAmount.isValid, false);
            assert.ok(nanAmount.message.includes('valid positive number'));

            // Rejects non-positive quantity (<= 0)
            const zeroQty = validateInvoiceInput({
                ...validInvoice,
                lineItems: [{ item: 'Service', amount: 1000, quantity: 0 }]
            });
            assert.strictEqual(zeroQty.isValid, false);
            assert.ok(zeroQty.message.includes('greater than zero'));
        });
    });

    /* ====================================================================
       2. API Authentication Protection Tests
       ==================================================================== */
    describe('2. Administrative Endpoint Authentication Enforcement', () => {
        it('rejects unauthenticated GET /api/admin/clients with 401', async () => {
            const res = await request('/api/admin/clients');
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Authorization token required');
        });

        it('rejects unauthenticated POST /api/admin/clients with 401', async () => {
            const res = await request('/api/admin/clients', { method: 'POST', body: { name: 'Test' } });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated PUT /api/admin/clients/:serialNo with 401', async () => {
            const res = await request('/api/admin/clients/00001', { method: 'PUT', body: { name: 'Test' } });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated DELETE /api/admin/clients/:serialNo with 401', async () => {
            const res = await request('/api/admin/clients/00001', { method: 'DELETE' });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated GET /api/admin/profiles with 401', async () => {
            const res = await request('/api/admin/profiles');
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated POST /api/admin/profiles with 401', async () => {
            const res = await request('/api/admin/profiles', { method: 'POST', body: { companyName: 'Test' } });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated PUT /api/admin/profiles/:serialNo with 401', async () => {
            const res = await request('/api/admin/profiles/00001', { method: 'PUT', body: { companyName: 'Test' } });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated DELETE /api/admin/profiles/:serialNo with 401', async () => {
            const res = await request('/api/admin/profiles/00001', { method: 'DELETE' });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated GET /api/admin/invoices with 401', async () => {
            const res = await request('/api/admin/invoices');
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated POST /api/admin/invoices with 401', async () => {
            const res = await request('/api/admin/invoices', { method: 'POST', body: { invoiceNo: 'INV-1' } });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated GET /api/admin/invoices/:serialNo with 401', async () => {
            const res = await request('/api/admin/invoices/00001');
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated PUT /api/admin/invoices/:serialNo with 401', async () => {
            const res = await request('/api/admin/invoices/00001', { method: 'PUT', body: { invoiceNo: 'INV-1' } });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated DELETE /api/admin/invoices/:serialNo with 401', async () => {
            const res = await request('/api/admin/invoices/00001', { method: 'DELETE' });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated PATCH /api/admin/invoices/:serialNo/status with 401', async () => {
            const res = await request('/api/admin/invoices/00001/status', { method: 'PATCH', body: { invoiceStatus: 'Paid' } });
            assert.strictEqual(res.status, 401);
        });

        it('rejects unauthenticated POST /api/admin/invoice/send-email with 401', async () => {
            const res = await request('/api/admin/invoice/send-email', { method: 'POST', body: { invoiceNo: '00001' } });
            assert.strictEqual(res.status, 401);
        });

        it('rejects expired token with 401', async () => {
            const res = await request('/api/admin/clients', {
                headers: { Authorization: `Bearer ${expiredToken}` }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Token expired. Please login again.');
        });

        it('rejects invalid or tampered token with 401', async () => {
            const res = await request('/api/admin/clients', {
                headers: { Authorization: `Bearer ${invalidToken}` }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, 'Invalid authorization token');
        });

        it('public endpoints remain accessible without Bearer token', async () => {
            const healthRes = await request('/');
            assert.strictEqual(healthRes.status, 200);

            const loginRes = await request('/api/admin/login', {
                method: 'POST',
                body: { email: 'baduser@vtab.com', password: 'badpassword' }
            });
            assert.strictEqual(loginRes.status, 401);
            assert.strictEqual(loginRes.body.message, 'Invalid credentials');
        });
    });

    /* ====================================================================
       3. Server-Side Input Validation Tests (Authenticated)
       ==================================================================== */
    describe('3. Server-Side Input Validation Checks', () => {
        it('POST /api/admin/clients rejects missing required fields with 400', async () => {
            const res = await request('/api/admin/clients', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { name: 'Acme Corp' } // missing email, contact, etc.
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('required fields'));
        });

        it('POST /api/admin/clients rejects invalid contact number format with 400', async () => {
            const res = await request('/api/admin/clients', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    name: 'Acme Corp',
                    industry: 'Tech',
                    email: 'test@acme.com',
                    contact: '123', // invalid contact length
                    address1: 'Street 1',
                    address2: 'Street 2',
                    city: 'City',
                    state: 'State',
                    country: 'India',
                    pincode: '600001',
                    taxNo: 'CHNA12345B',
                    gstNo: '33AAAAA0000A1Z5'
                }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('10 digits'));
        });

        it('PUT /api/admin/clients/:serialNo rejects invalid identifier with 400', async () => {
            const res = await request('/api/admin/clients/bad*id', {
                method: 'PUT',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { name: 'Test' }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Invalid client serial number'));
        });

        it('DELETE /api/admin/clients/:serialNo rejects invalid identifier with 400', async () => {
            const res = await request('/api/admin/clients/bad*id', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Invalid client serial number'));
        });

        it('POST /api/admin/profiles rejects non-alphabetic business name with 400', async () => {
            const res = await request('/api/admin/profiles', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    companyName: 'Company 1234',
                    pointOfContact: 'John Doe',
                    email: 'poc@company.com',
                    contactNo: '9876543210',
                    address1: 'Main St',
                    address2: 'Suite 100',
                    city: 'City',
                    state: 'State',
                    country: 'India',
                    pincode: '600001',
                    teamSize: '10',
                    gstNo: '33AAAAA0000A1Z5',
                    taxNo: 'CHNA12345B1',
                    industry: 'Technology'
                }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('only alphabets'));
        });

        it('PUT /api/admin/profiles/:serialNo rejects invalid identifier with 400', async () => {
            const res = await request('/api/admin/profiles/bad*id', {
                method: 'PUT',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { companyName: 'Valid Name' }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Invalid profile serial number'));
        });

        it('DELETE /api/admin/profiles/:serialNo rejects invalid identifier with 400', async () => {
            const res = await request('/api/admin/profiles/bad*id', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Invalid profile serial number'));
        });

        it('POST /api/admin/invoices rejects empty lineItems array with 400', async () => {
            const res = await request('/api/admin/invoices', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    invoiceNo: 'TEST-INV',
                    invoiceDate: '2026-03-01',
                    dueDate: '2026-03-10',
                    profileName: 'VTAB',
                    clientName: 'Client',
                    accountHolderName: 'VTAB Square',
                    accountNo: '123456789012',
                    branchLocation: 'Chennai',
                    ifscCode: 'HDFC0001234',
                    accountType: 'Current',
                    bankName: 'HDFC Bank',
                    lineItems: []
                }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Missing required invoice fields'));
        });

        it('POST /api/admin/invoices rejects NaN / Infinity in line items with 400', async () => {
            const res = await request('/api/admin/invoices', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    invoiceNo: 'TEST-INV-NAN',
                    invoiceDate: '2026-03-01',
                    dueDate: '2026-03-10',
                    profileName: 'VTAB',
                    clientName: 'Client',
                    accountHolderName: 'VTAB Square',
                    accountNo: '123456789012',
                    branchLocation: 'Chennai',
                    ifscCode: 'HDFC0001234',
                    accountType: 'Current',
                    bankName: 'HDFC Bank',
                    lineItems: [
                        { item: 'Service', amount: 'Infinity', quantity: 1 }
                    ]
                }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('valid positive number'));
        });

        it('POST /api/admin/invoices rejects negative or zero quantity with 400', async () => {
            const res = await request('/api/admin/invoices', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    invoiceNo: 'TEST-INV-QTY',
                    invoiceDate: '2026-03-01',
                    dueDate: '2026-03-10',
                    profileName: 'VTAB',
                    clientName: 'Client',
                    accountHolderName: 'VTAB Square',
                    accountNo: '123456789012',
                    branchLocation: 'Chennai',
                    ifscCode: 'HDFC0001234',
                    accountType: 'Current',
                    bankName: 'HDFC Bank',
                    lineItems: [
                        { item: 'Service', amount: 500, quantity: -2 }
                    ]
                }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('greater than zero'));
        });

        it('POST /api/admin/invoices rejects dueDate earlier than invoiceDate with 400', async () => {
            const res = await request('/api/admin/invoices', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    invoiceNo: 'TEST-INV-DATES',
                    invoiceDate: '2026-03-25',
                    dueDate: '2026-03-01',
                    profileName: 'VTAB',
                    clientName: 'Client',
                    accountHolderName: 'VTAB Square',
                    accountNo: '123456789012',
                    branchLocation: 'Chennai',
                    ifscCode: 'HDFC0001234',
                    accountType: 'Current',
                    bankName: 'HDFC Bank',
                    lineItems: [
                        { item: 'Service', amount: 500, quantity: 1 }
                    ]
                }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('earlier than Invoice Date'));
        });

        it('GET /api/admin/invoices/:serialNo rejects invalid identifier with 400', async () => {
            const res = await request('/api/admin/invoices/bad*id', {
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Invalid invoice serial number'));
        });

        it('PUT /api/admin/invoices/:serialNo rejects invalid identifier with 400', async () => {
            const res = await request('/api/admin/invoices/bad*id', {
                method: 'PUT',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { invoiceNo: 'INV-1' }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Invalid invoice serial number'));
        });

        it('DELETE /api/admin/invoices/:serialNo rejects invalid identifier with 400', async () => {
            const res = await request('/api/admin/invoices/bad*id', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Invalid invoice serial number'));
        });

        it('PATCH /api/admin/invoices/:serialNo/status rejects invalid identifier with 400', async () => {
            const res = await request('/api/admin/invoices/bad*id/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { invoiceStatus: 'Paid' }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('Invalid invoice serial number'));
        });

        it('PATCH /api/admin/invoices/:serialNo/status rejects empty payload with 400', async () => {
            const res = await request('/api/admin/invoices/00001/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: {} // No status provided
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('At least one status field must be provided'));
        });

        it('PATCH /api/admin/invoices/:serialNo/status rejects status exceeding 50 chars with 400', async () => {
            const res = await request('/api/admin/invoices/00001/status', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { invoiceStatus: 'A'.repeat(51) }
            });
            assert.strictEqual(res.status, 400);
            assert.ok(res.body.message && res.body.message.includes('50 characters'));
        });
    });

    /* ====================================================================
       4. Data Protection & Response Security Verification
       ==================================================================== */
    describe('4. Data Protection & Response Security Verification', () => {
        it('server responses never expose X-Powered-By header', async () => {
            const res = await request('/');
            assert.strictEqual(res.headers['x-powered-by'], undefined);
        });

        it('error responses never leak internal filesystem paths or passwords', async () => {
            const res = await request('/api/admin/clients/test', {
                method: 'POST',
                headers: { Authorization: `Bearer ${validToken}` },
                body: { name: 'Acme', password: 'secretPassword123' }
            });
            const bodyStr = JSON.stringify(res.body);
            assert.strictEqual(bodyStr.includes('secretPassword123'), false);
            assert.strictEqual(bodyStr.includes('C:\\'), false);
            assert.strictEqual(bodyStr.includes('/home/'), false);
        });
    });
});
