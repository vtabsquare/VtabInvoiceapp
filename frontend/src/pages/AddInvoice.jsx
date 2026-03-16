import React, { useState, useEffect } from 'react';
import {
    Plus, Search, FileText, Calendar, Building2, User,
    X, Check, ChevronDown, Trash2, Download, Printer,
    Briefcase, Mail, Phone, MapPin, IndianRupee, ArrowLeft
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ClientModal from '../components/ClientModal';
import API_BASE_URL from '../api';

const AddInvoice = () => {
    const navigate = useNavigate();

    // Data States
    const [profiles, setProfiles] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showClientModal, setShowClientModal] = useState(false);
    const [lastSerial, setLastSerial] = useState('');

    const generateInvoiceNo = () => {
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        return `${randomDigits}`;
    };

    // Form State
    const [invoiceData, setInvoiceData] = useState({
        invoiceNo: generateInvoiceNo(),
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        selectedProfile: null,
        selectedClient: null,
        signature: null,
        accountHolderName: '',
        accountNo: '',
        confirmAccountNo: '',
        branchLocation: '',
        ifscCode: '',
        accountType: ''
    });

    const [lineItems, setLineItems] = useState([
        { id: Date.now(), item: '', description: '', quantity: 1, amount: 0, sgstRate: 9, cgstRate: 9, sgst: 0, cgst: 0, tax: 0, total: 0 }
    ]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async (selectClientSerial = null) => {
        try {
            const [profRes, clientRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/profiles`),
                axios.get(`${API_BASE_URL}/clients`)
            ]);
            setProfiles(profRes.data);
            setClients(clientRes.data);

            if (selectClientSerial) {
                const newClient = clientRes.data.find(c => c.serialNo === selectClientSerial);
                if (newClient) {
                    setInvoiceData(prev => ({ ...prev, selectedClient: newClient }));
                }
            }
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    };

    const handleInvoiceChange = (e) => {
        const { name, value } = e.target;
        setInvoiceData(prev => ({ ...prev, [name]: value }));
    };

    const addLineItem = () => {
        setLineItems([...lineItems, { id: Date.now(), item: '', description: '', quantity: 1, amount: 0, sgstRate: 9, cgstRate: 9, sgst: 0, cgst: 0, tax: 0, total: 0 }]);
    };

    const removeLineItem = (itemId) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter(i => i.id !== itemId));
        }
    };

    const handleItemChange = (itemId, field, value) => {
        const updatedItems = lineItems.map(item => {
            if (item.id === itemId) {
                const updatedItem = { ...item, [field]: value };

                const qty = parseFloat(field === 'quantity' ? value : updatedItem.quantity) || 0;
                const amt = parseFloat(field === 'amount' ? value : updatedItem.amount) || 0;
                const sRate = parseFloat(field === 'sgstRate' ? value : updatedItem.sgstRate) || 0;
                const cRate = parseFloat(field === 'cgstRate' ? value : updatedItem.cgstRate) || 0;
                const baseAmount = qty * amt;

                const sgst = baseAmount * (sRate / 100);
                const cgst = baseAmount * (cRate / 100);
                const tax = baseAmount * 0.10;
                const total = baseAmount + sgst + cgst - tax;

                return { ...updatedItem, sgst, cgst, tax, total };
            }
            return item;
        });
        setLineItems(updatedItems);
    };

    const calculateTotals = () => {
        let subtotal = 0;
        let sgst = 0;
        let cgst = 0;
        let tax = 0;
        let total = 0;

        lineItems.forEach(i => {
            const qty = parseFloat(i.quantity) || 0;
            const amt = parseFloat(i.amount) || 0;
            const base = qty * amt;
            subtotal += base;
            sgst += i.sgst;
            cgst += i.cgst;
            tax += i.tax;
            total += i.total;
        });

        return { subtotal, sgst, cgst, tax, total };
    };

    const totals = calculateTotals();

    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: num % 1 === 0 ? 0 : 2
        });
    };

    const handleSignatureUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.src = reader.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300; // Small size is enough for signature
                    const MAX_HEIGHT = 150;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Resize and compress
                    const resizedDataUrl = canvas.toDataURL('image/png', 0.6);
                    setInvoiceData(prev => ({ ...prev, signature: resizedDataUrl }));
                };
            };
            reader.readAsDataURL(file);
        }
    };

    const generatePDF = (invoice, items, finalTotals, logoBase64) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const indigoColor = [79, 70, 229]; // Indigo-600
        const lavenderBg = [240, 240, 255];
        const borderColor = [220, 220, 220];

        const drawPageElements = () => {
            // --- BORDER around the entire page ---
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.5);
            doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

            // --- FOOTER ---
            const prof = invoice.selectedProfile;
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.setDrawColor(230, 230, 230);
            doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);
            doc.text(
                `${prof.companyName} | GST: ${prof.gstNo || 'N/A'} | PAN: ${prof.taxNo || 'N/A'} | Email: ${prof.email || ''}`,
                pageWidth / 2, pageHeight - 10, { align: "center" }
            );
        };

        // Draw page elements on first page
        drawPageElements();

        // 1. HEADER SECTION
        doc.setFont("helvetica", "bold");
        doc.setFontSize(32);
        doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
        doc.text("Invoice", 12, 25);

        // Logo on the right
        if (logoBase64) {
            // Adjusted size for the new logo (approx 35x15)
            doc.addImage(logoBase64, 'PNG', pageWidth - 50, 12, 35, 15);
        }

        // Vertical details below "Invoice"
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        let headerY = 35;
        const details = [
            { label: "Invoice No #", value: invoice.invoiceNo },
            { label: "Invoice Date", value: new Date(invoice.invoiceDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) },
            { label: "Due Date", value: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-' }
        ];

        details.forEach(item => {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text(item.label, 12, headerY);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(item.value, 40, headerY);
            headerY += 5;
        });

        const profile = invoice.selectedProfile;
        const client = invoice.selectedClient;
        let currentY = headerY + 5;

        // 2. ADDRESS BOXES (Lavender)
        const boxWidth = (pageWidth - 25) / 2;
        const billedByContent = `${profile.companyName}\n${profile.address1 || ''}, ${profile.city || ''}, ${profile.state || ''} ${profile.pincode || ''}\nGSTIN: ${profile.gstNo || 'N/A'}\nPAN: ${profile.taxNo || 'N/A'}\nEmail: ${profile.email || ''}\nPhone: ${profile.phone || ''}`;
        const billedToContent = `${client.name}\n${client.address1 || ''}, ${client.address2 ? client.address2 + ', ' : ''}${client.city || ''}, ${client.state || ''} - ${client.pincode || ''}\nGSTIN: ${client.gstNo || 'N/A'}\nPAN: ${client.panNo || 'N/A'}\nEmail: ${client.email || ''}\nPhone: ${client.phone || ''}`;

        autoTable(doc, {
            startY: currentY,
            body: [
                [
                    { content: "Billed By", styles: { fontStyle: 'bold', textColor: indigoColor, fontSize: 13 } },
                    { content: "Billed To", styles: { fontStyle: 'bold', textColor: indigoColor, fontSize: 13 } }
                ],
                [
                    { content: billedByContent, styles: { fontSize: 8.5, textColor: [50, 50, 50], cellPadding: 4 } },
                    { content: billedToContent, styles: { fontSize: 8.5, textColor: [50, 50, 50], cellPadding: 4 } }
                ]
            ],
            theme: 'plain',
            styles: { fillColor: lavenderBg, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: boxWidth },
                1: { cellWidth: boxWidth }
            },
            margin: { left: 10, right: 10 },
            tableWidth: pageWidth - 20
        });

        currentY = doc.lastAutoTable.finalY + 10;

        // --- INVOICE INFO TABLE ---
        autoTable(doc, {
            startY: currentY,
            body: [
                ['Invoice No.', invoice.invoiceNo, 'Issue Date', new Date(invoice.invoiceDate).toLocaleDateString('en-IN')],
                ['Due Date', invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '-', 'Reference', invoice.invoiceNo],
            ],
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [0, 0, 0], cellWidth: 30 },
                1: { fontStyle: 'bold', textColor: [0, 0, 0], cellWidth: 45 },
                2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [0, 0, 0], cellWidth: 30 },
                3: { fontStyle: 'bold', textColor: [0, 0, 0], cellWidth: 45 },
            },
            margin: { left: 10, right: 10 },
            didDrawPage: (data) => {
                drawPageElements();
            }
        });
        currentY = doc.lastAutoTable.finalY + 6;

        // --- LINE ITEMS TABLE ---
        const tableRows = items.map(item => [
            { content: item.item, styles: { fontStyle: 'bold' } },
            { content: item.description || '' },
            { content: String(item.quantity), styles: { halign: 'center' } },
            { content: formatCurrency(item.amount), styles: { halign: 'right' } },
            { content: `${item.sgstRate || 9}%`, styles: { halign: 'center' } },
            { content: `${item.cgstRate || 9}%`, styles: { halign: 'center' } },
            { content: `10%`, styles: { halign: 'center' } },
            { content: formatCurrency(item.total), styles: { halign: 'right', fontStyle: 'bold' } },
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['ITEM NAME', 'DESCRIPTION', 'QUANTITY', 'UNIT PRICE', 'SGST', 'CGST', 'TAX (10%) LESS', 'AMOUNT']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, lineWidth: 0.1 },
            styles: { fontSize: 7.5, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
            alternateRowStyles: { fillColor: [252, 252, 252] },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 'auto' },
                2: { halign: 'center', cellWidth: 15 },
                3: { halign: 'right', cellWidth: 20 },
                4: { halign: 'center', cellWidth: 12 },
                5: { halign: 'center', cellWidth: 12 },
                6: { halign: 'center', cellWidth: 18 },
                7: { halign: 'right', cellWidth: 20 },
            },
            margin: { left: 10, right: 10 },
            didDrawPage: () => {
                drawPageElements();
            }
        });
        currentY = doc.lastAutoTable.finalY + 6;

        // Check if we need a new page for totals + bank
        if (currentY > pageHeight - 80) {
            doc.addPage();
            drawPageElements();
            currentY = 32;
        }

        // --- TOTALS TABLE ---
        autoTable(doc, {
            startY: currentY,
            body: [
                ['TOTAL (INR):', { content: formatCurrency(finalTotals.subtotal + finalTotals.sgst + finalTotals.cgst), styles: { halign: 'right' } }],
                ['SGST:', { content: formatCurrency(finalTotals.sgst), styles: { halign: 'right' } }],
                ['CGST:', { content: formatCurrency(finalTotals.cgst), styles: { halign: 'right' } }],
                ['Tax (10%) Less:', { content: `-${formatCurrency(finalTotals.tax)}`, styles: { halign: 'right', textColor: [150, 0, 0] } }],
                [
                    { content: 'TOTAL DUE (INR)', styles: { fontStyle: 'bold', fillColor: [0, 0, 0], textColor: [255, 255, 255] } },
                    { content: formatCurrency(finalTotals.total), styles: { halign: 'right', fontStyle: 'bold', fillColor: [0, 0, 0], textColor: [255, 255, 255] } }
                ],
            ],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [0, 0, 0], cellWidth: 60 },
                1: { textColor: [0, 0, 0], cellWidth: 40 },
            },
            tableWidth: 100,
            margin: { left: pageWidth - 110, right: 10 },
            didDrawPage: () => { drawPageElements(); }
        });
        currentY = doc.lastAutoTable.finalY + 8;

        // --- BANK DETAILS TABLE ---
        if (invoice.accountNo) {
            if (currentY > pageHeight - 65) {
                doc.addPage();
                drawPageElements();
                currentY = 32;
            }
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text("BANK DETAILS", 10, currentY);
            currentY += 4;

            autoTable(doc, {
                startY: currentY,
                head: [['Account Name', 'Account No', 'IFSC Code', 'Branch']],
                body: [
                    [
                        invoice.accountHolderName || 'N/A',
                        invoice.accountNo,
                        invoice.ifscCode || 'N/A',
                        invoice.branchLocation || 'N/A'
                    ]
                ],
                theme: 'grid',
                headStyles: { fillColor: [248, 250, 252], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
                margin: { left: 10, right: 10 },
                didDrawPage: () => { drawPageElements(); }
            });
            currentY = doc.lastAutoTable.finalY + 10;
        }

        // --- SIGNATURE SECTION ---
        if (currentY > pageHeight - 60) {
            doc.addPage();
            drawPageElements();
            currentY = 32;
        }

        const sigX = pageWidth - 70;
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "bold");
        doc.text("Authorized Signatory", sigX, currentY);
        currentY += 5;

        if (invoice.signature) {
            doc.addImage(invoice.signature, 'PNG', sigX, currentY, 40, 15);
            currentY += 18;
        } else {
            currentY += 15;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text("Vimala C.", sigX, currentY);
        currentY += 4;
        doc.setFont("helvetica", "normal");
        doc.text("Managing Director", sigX, currentY);
        currentY += 4;
        doc.text("VTAB Square Pvt Ltd (Now Part of Siroco)", sigX, currentY);

        doc.save(`Invoice_${invoice.invoiceNo}.pdf`);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mandatory Validations
        if (!invoiceData.selectedProfile || !invoiceData.selectedClient) {
            alert("Please select both Business Profile and Client");
            return;
        }
        if (!invoiceData.dueDate) {
            alert("Please select a Due Date");
            return;
        }
        if (lineItems.some(i => !i.item || i.quantity <= 0 || i.amount <= 0)) {
            alert("Please fill all line item details correctly (Name, Quantity, and Amount)");
            return;
        }
        if (invoiceData.accountNo && (invoiceData.accountNo.length < 9 || invoiceData.accountNo.length > 18)) {
            alert("Account No must be between 9 and 18 digits.");
            return;
        }
        if (invoiceData.accountNo !== invoiceData.confirmAccountNo) {
            alert("Account No and Confirm Account No must match.");
            return;
        }
        if (invoiceData.ifscCode && invoiceData.ifscCode.length !== 11) {
            alert("IFSC Code must be exactly 11 characters.");
            return;
        }

        const alphaRegex = /^[a-zA-Z\s]*$/;
        if (invoiceData.accountHolderName && !alphaRegex.test(invoiceData.accountHolderName)) {
            alert("Account Holder Name must contain only alphabets.");
            return;
        }
        if (invoiceData.branchLocation && !alphaRegex.test(invoiceData.branchLocation)) {
            alert("Branch Location must contain only alphabets.");
            return;
        }

        setLoading(true);
        try {
            const finalData = {
                invoiceNo: invoiceData.invoiceNo,
                invoiceDate: invoiceData.invoiceDate,
                dueDate: invoiceData.dueDate,
                profileName: invoiceData.selectedProfile.companyName,
                clientName: invoiceData.selectedClient.name,
                lineItems: lineItems.map(i => ({
                    item: i.item,
                    description: i.description,
                    quantity: i.quantity,
                    amount: i.amount,
                    sgstRate: i.sgstRate,
                    cgstRate: i.cgstRate
                })),
                signature: invoiceData.signature,
                accountHolderName: invoiceData.accountHolderName,
                accountNo: invoiceData.accountNo,
                confirmAccountNo: invoiceData.confirmAccountNo,
                branchLocation: invoiceData.branchLocation,
                ifscCode: invoiceData.ifscCode,
                accountType: invoiceData.accountType
            };

            const res = await axios.post(`${API_BASE_URL}/invoices`, finalData);
            setLastSerial(res.data.serialNo);

            let logoBase64 = null;
            try {
                const response = await fetch('/image.png');
                if (!response.ok) throw new Error(`Logo not found: ${response.status}`);
                const blob = await response.blob();
                logoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.error("Failed to load logo", e);
            }

            generatePDF(invoiceData, lineItems, totals, logoBase64);
            setShowSuccessModal(true);

            setInvoiceData(prev => ({
                ...prev,
                invoiceNo: generateInvoiceNo(),
                dueDate: '',
                selectedClient: null,
                accountHolderName: '',
                accountNo: '',
                confirmAccountNo: '',
                branchLocation: '',
                ifscCode: '',
                accountType: ''
            }));
            setLineItems([{ id: Date.now(), item: '', description: '', quantity: 1, amount: 0, sgstRate: 9, cgstRate: 9, sgst: 0, cgst: 0, tax: 0, total: 0 }]);

        } catch (err) {
            console.error("Save Invoice Error:", err);
            alert(err.response?.data?.message || "Failed to save invoice");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
            <Sidebar activePage="invoices" />

            <main style={{ flex: 1, overflowY: 'auto' }} className="animate-fade-in-up main-content">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', padding: '1.25rem 2rem' }} className="add-invoice-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <button
                            onClick={() => navigate('/invoices')}
                            style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '12px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                New Invoice <FileText style={{ color: '#6366f1', width: '28px' }} />
                            </h1>
                            <p style={{ color: '#64748b' }}>Create professional tax invoices with 9/9/10 tax rules</p>
                        </div>
                    </div>
                </header>

                <form onSubmit={handleSubmit} style={{ padding: '0 2rem' }} className="content-container">
                    {/* Top Section */}
                    <div style={{ background: 'white', padding: '2.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }} className="invoice-meta-grid">
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Invoice No*</label>
                            <input type="text" name="invoiceNo" value={invoiceData.invoiceNo} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#f8fafc', fontWeight: 700 }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Invoice Date*</label>
                            <input type="date" name="invoiceDate" value={invoiceData.invoiceDate} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Due Date</label>
                            <input type="date" name="dueDate" value={invoiceData.dueDate} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
                        </div>
                    </div>

                    {/* Billed By & Billed To */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }} className="billed-grid">
                        {/* Billed By */}
                        <div style={{ background: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>Billed By</h3>
                            <select
                                value={invoiceData.selectedProfile?.serialNo || ''}
                                onChange={(e) => {
                                    const prof = profiles.find(p => p.serialNo === e.target.value);
                                    setInvoiceData(prev => ({ ...prev, selectedProfile: prof }));
                                }}
                                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}
                            >
                                <option value="">Select a Business Profile</option>
                                {profiles.map(p => <option key={p.serialNo} value={p.serialNo}>{p.companyName}</option>)}
                            </select>
                            {invoiceData.selectedProfile && (
                                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <p style={{ fontWeight: 700, margin: 0 }}>{invoiceData.selectedProfile.companyName}</p>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => navigate('/profiles')} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Edit</button>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{invoiceData.selectedProfile.city}, {invoiceData.selectedProfile.state}</p>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>GST: {invoiceData.selectedProfile.gstNo || 'N/A'}</p>
                                </div>
                            )}
                        </div>

                        {/* Billed To */}
                        <div style={{ background: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Billed To</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowClientModal(true)}
                                    style={{ background: '#f0f9ff', color: '#0ea5e9', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                    <Plus style={{ width: '0.875rem' }} /> New Client
                                </button>
                            </div>
                            <select
                                value={invoiceData.selectedClient?.serialNo || ''}
                                onChange={(e) => {
                                    const client = clients.find(c => c.serialNo === e.target.value);
                                    setInvoiceData(prev => ({ ...prev, selectedClient: client }));
                                }}
                                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1rem', outline: 'none' }}
                                required
                            >
                                <option value="">Select a Client</option>
                                {clients.map(c => <option key={c.serialNo} value={c.serialNo}>{c.name}</option>)}
                            </select>
                            {invoiceData.selectedClient && (
                                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <p style={{ fontWeight: 700, margin: 0 }}>{invoiceData.selectedClient.name}</p>
                                        <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Edit</button>
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{invoiceData.selectedClient.city}</p>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Industry: {invoiceData.selectedClient.industry}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items Table */}
                    <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '2rem', overflowX: 'auto' }}>
                        <table style={{ minWidth: '800px', width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#475569', width: '25%' }}>ITEM</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#475569', width: '25%' }}>DESCRIPTION</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>QTY</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>PRICE</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>SGST %</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>CGST %</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>TOTAL</th>
                                    <th style={{ padding: '1rem', width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <input
                                                type="text"
                                                placeholder="Item Name"
                                                value={item.item}
                                                onChange={(e) => handleItemChange(item.id, 'item', e.target.value)}
                                                style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 600 }}
                                            />
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <input
                                                type="text"
                                                placeholder="Brief description"
                                                value={item.description}
                                                onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                                style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.875rem' }}
                                            />
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                                style={{ width: '50px', border: 'none', outline: 'none', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', padding: '0.25rem' }}
                                            />
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <input
                                                type="number"
                                                value={item.amount}
                                                onChange={(e) => handleItemChange(item.id, 'amount', e.target.value)}
                                                style={{ width: '80px', border: 'none', outline: 'none', textAlign: 'right', fontWeight: 600 }}
                                            />
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                value={item.sgstRate}
                                                onChange={(e) => handleItemChange(item.id, 'sgstRate', e.target.value)}
                                                style={{ width: '45px', border: 'none', outline: 'none', textAlign: 'center', background: '#f0f9ff', borderRadius: '6px', padding: '0.25rem', color: '#0369a1', fontWeight: 700 }}
                                            />
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                value={item.cgstRate}
                                                onChange={(e) => handleItemChange(item.id, 'cgstRate', e.target.value)}
                                                style={{ width: '45px', border: 'none', outline: 'none', textAlign: 'center', background: '#f0f9ff', borderRadius: '6px', padding: '0.25rem', color: '#0369a1', fontWeight: 700 }}
                                            />
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>
                                            ₹{formatCurrency(item.total)}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <button type="button" onClick={() => removeLineItem(item.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ padding: '1rem 2rem', borderTop: '1px solid #f1f5f9' }}>
                            <button
                                type="button"
                                onClick={addLineItem}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                            >
                                <Plus size={16} /> Add New Line
                            </button>
                        </div>
                    </div>

                    {/* Signature and Summary Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem', marginBottom: '3rem' }}>
                        {/* Signature Upload Area */}
                        <div style={{ background: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>Authorized Signature</h3>

                            {!invoiceData.signature ? (
                                <div
                                    onClick={() => document.getElementById('signatureInput').click()}
                                    style={{ border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '2rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: '#f8fafc' }}
                                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                >
                                    <div style={{ width: '40px', height: '40px', background: '#e0e7ff', color: '#6366f1', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                        <Plus size={24} />
                                    </div>
                                    <p style={{ fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Upload Signature</p>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>PNG or JPG (Recommended: transparent background)</p>
                                    <input
                                        type="file"
                                        id="signatureInput"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleSignatureUpload}
                                    />
                                </div>
                            ) : (
                                <div style={{ position: 'relative', background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                                    <img
                                        src={invoiceData.signature}
                                        alt="Signature"
                                        style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceData(prev => ({ ...prev, signature: null }))}
                                        style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Summary Section */}
                        <div style={{ background: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0' }} className="summary-box">
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>Summary</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: '#64748b' }}>
                                <span>Subtotal</span>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{formatCurrency(totals.subtotal)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: '#64748b' }}>
                                <span>SGST</span>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{formatCurrency(totals.sgst)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: '#64748b' }}>
                                <span>CGST</span>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{formatCurrency(totals.cgst)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: '#64748b' }}>
                                <span>Tax (10%) Less</span>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{formatCurrency(totals.tax)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#2563eb', borderRadius: '12px', color: 'white' }}>
                                <span style={{ fontWeight: 700 }}>Grand Total</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>₹{formatCurrency(totals.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Bank Details Area */}
                    <div style={{ background: 'white', padding: '2.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '3rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>Bank Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }} className="bank-details-grid">
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Account Holder Name</label>
                                <input type="text" name="accountHolderName" value={invoiceData.accountHolderName} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} placeholder="e.g. Acme Corp" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Account No*</label>
                                <input type="password" name="accountNo" value={invoiceData.accountNo} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} placeholder="********" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Confirm Account No*</label>
                                <input type="text" name="confirmAccountNo" value={invoiceData.confirmAccountNo} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} placeholder="Account number" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Branch Location</label>
                                <input type="text" name="branchLocation" value={invoiceData.branchLocation} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} placeholder="City Name" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>IFSC Code</label>
                                <input type="text" name="ifscCode" value={invoiceData.ifscCode} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} placeholder="IFSC" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Account Type</label>
                                <select name="accountType" value={invoiceData.accountType} onChange={handleInvoiceChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: 'white' }}>
                                    <option value="">Select Account Type</option>
                                    <option value="Savings">Savings</option>
                                    <option value="Current">Current</option>
                                    <option value="Salary">Salary</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingBottom: '4rem' }} className="actions-footer">
                        <button type="button" onClick={() => navigate('/invoices')} style={{ padding: '0.75rem 2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={loading} style={{ padding: '0.75rem 3rem', borderRadius: '12px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                            {loading ? 'Processing...' : 'Save & Download'}
                        </button>
                    </div>
                </form>
            </main>
            <style>{`
                @media (max-width: 1024px) {
                    .main-content {
                        padding-top: 60px;
                    }
                    .add-invoice-header {
                        padding: 1.5rem !important;
                    }
                    .content-container {
                        padding: 0 1rem !important;
                    }
                }
                @media (max-width: 768px) {
                    .invoice-meta-grid, .billed-grid, .bank-details-grid {
                        grid-template-columns: 1fr !important;
                        gap: 1rem !important;
                        padding: 1.5rem !important;
                    }
                    .summary-box {
                        width: 100% !important;
                    }
                    .actions-footer {
                        flex-direction: column-reverse;
                    }
                    .actions-footer button {
                        width: 100%;
                    }
                }
            `}</style>

            {/* Success Modal */}
            {showSuccessModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="animate-scale-in" style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '3rem 2rem', textAlign: 'center' }}>
                        <div style={{ width: '5rem', height: '5rem', background: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <Check style={{ width: '2.5rem', height: '2.5rem', strokeWidth: 3 }} />
                        </div>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Invoice Ready!</h3>
                        <p style={{ color: '#64748b', fontSize: '1.125rem', marginBottom: '1rem' }}>Saved successfully.</p>
                        <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: '2rem' }}>Serial #{lastSerial}</p>
                        <button onClick={() => { setShowSuccessModal(false); navigate('/invoices'); }} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, cursor: 'pointer' }}>View All Invoices</button>
                    </div>
                </div>
            )}
            <ClientModal
                isOpen={showClientModal}
                onClose={() => setShowClientModal(false)}
                onSuccess={(newClient) => {
                    fetchInitialData(newClient.serialNo);
                }}
            />
        </div>
    );
};

export default AddInvoice;
