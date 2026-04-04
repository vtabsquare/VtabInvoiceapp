import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    ArrowLeft,
    Download,
    Mail,
    Check,
    X,
    Loader2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import API_BASE_URL from '../api';
import { numberToWords } from '../utils/numberToWords';

const InvoicePreview = () => {
    const { serialNo } = useParams();
    const navigate = useNavigate();

    const [invoice, setInvoice] = useState(null);
    const [profile, setProfile] = useState({});
    const [client, setClient] = useState({});
    const [lineItems, setLineItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const generatedPdfRef = useRef(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [toastType, setToastType] = useState('success');
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const [invRes, profRes, cliRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/invoices/${serialNo}`),
                    axios.get(`${API_BASE_URL}/profiles`),
                    axios.get(`${API_BASE_URL}/clients`)
                ]);
                
                const inv = invRes.data;
                const profilesList = profRes.data || [];
                const cliList = cliRes.data || [];
                
                setInvoice(inv);
                setLineItems(inv.lineItems || []);
                
                const selectedProfile = profilesList.find(p => p.companyName?.toLowerCase().trim() === inv.profileName?.toLowerCase().trim());
                const selectedClient = cliList.find(c => c.name?.toLowerCase().trim() === inv.clientName?.toLowerCase().trim());
                
                setProfile(selectedProfile || {});
                setClient(selectedClient || {});
                
            } catch (err) {
                console.error('Error fetching invoice:', err);
                showToast('Failed to load invoice.', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchInvoice();
    }, [serialNo]);

    const showToast = (msg, type = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: num % 1 === 0 ? 0 : 2
        });
    };

    const calculateTotals = useCallback(() => {
        let subtotal = 0;
        let sgst = 0;
        let cgst = 0;
        let tax = 0;
        let total = 0;

        lineItems.forEach(i => {
            const qty = parseFloat(i.quantity) || 1;
            const amt = parseFloat(i.amount) || 0;
            const baseAmount = qty * amt;

            const sRate = parseFloat(i.sgstRate) || 9;
            const cRate = parseFloat(i.cgstRate) || 9;

            const itemSgst = baseAmount * (sRate / 100);
            const itemCgst = baseAmount * (cRate / 100);
            const itemTax = baseAmount * 0.10;
            const itemTotal = baseAmount + itemSgst + itemCgst;

            subtotal += baseAmount;
            sgst += itemSgst;
            cgst += itemCgst;
            tax += itemTax;
            total += itemTotal;
        });

        return { subtotal, sgst, cgst, tax, total };
    }, [lineItems]);

    const generatePDFDocument = useCallback(async () => {
        if (!invoice) return null;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const indigoColor = [79, 70, 229];
        const lavenderBg = [240, 240, 255];
        const borderColor = [220, 220, 220];
        const sigHeightNeeded = 45;
        const sigSpaceLimit = pageHeight - sigHeightNeeded - 25;

        let logoBase64 = null;
        try {
            const logoUrl = `${window.location.origin}/vtab.jpeg?v=${Date.now()}`;
            logoBase64 = await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = () => resolve(null);
                img.src = logoUrl;
            });
        } catch (e) { console.error("Logo load failed", e); }

        const drawPageElements = () => {
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.setDrawColor(230, 230, 230);
            doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);
            doc.text(
                `${invoice.profileCompany || invoice.profileName || ''} | GST: ${invoice.profileGst || 'N/A'} | PAN: ${invoice.profilePan || 'N/A'} | Email: ${invoice.profileEmail || ''}`,
                pageWidth / 2, pageHeight - 10, { align: "center" }
            );

            doc.setFont("helvetica", "bold");
            doc.setFontSize(32);
            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.text("Invoice", 12, 25);

            if (logoBase64) {
                const logoX = pageWidth - 40;
                const logoY = 10;
                doc.addImage(logoBase64, 'PNG', logoX, logoY, 25, 25);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(0, 0, 0);
                doc.text("VTAB Square Private Limited", logoX + 12.5, logoY + 32, { align: "center" });
            }

            const startX = 10;
            let hy = 32;
            const rowHeight = 8;
            const col1W = 35;
            const col2W = 40;

            doc.setFontSize(8.5);
            doc.setLineWidth(0.1);
            doc.setDrawColor(220, 220, 220);

            const details = [
                ['Invoice No #', invoice.invoiceNo],
                ['Invoice Date', new Date(invoice.invoiceDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })],
                ['Due Date', invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-']
            ];

            details.forEach(row => {
                doc.setFillColor(248, 250, 252);
                doc.rect(startX, hy, col1W, rowHeight, 'FD');
                doc.setFillColor(255, 255, 255);
                doc.rect(startX + col1W, hy, col2W, rowHeight, 'FD');

                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text(row[0], startX + 3, hy + 5.5);
                doc.text(row[1], startX + col1W + 3, hy + 5.5);
                hy += rowHeight;
            });
        };

        drawPageElements();

        let currentY = 62;

        const loadIcon = (iconName) => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = `${window.location.origin}/icons/${iconName}.png?v=${Date.now()}`;
        });

        const [iconUser, iconLocation, iconMail, iconPhone, iconCompany, iconGstin, iconPan] =
            await Promise.all(['user', 'location', 'mail', 'phone', 'company', 'gstin', 'pan'].map(loadIcon));

        const colW = (pageWidth - 20) / 2;
        const leftX = 10;
        const rightX = 10 + colW;
        const iconSize = 3.0;
        const iconTextGap = 1.0;
        const textStartOffset = iconSize + iconTextGap;
        const lineH = 3.8;
        const rowGap = 1.0;

        const billedFs = 8;
        doc.setFontSize(billedFs);
        const innerW = colW - 8 - textStartOffset;

        const profileAddr = `${profile?.address1 || ''}${profile?.city ? ', ' + profile.city : ''}${profile?.state ? ', ' + profile.state : ''}${profile?.pincode ? ' ' + profile.pincode : ''}`;
        const clientAddr = `${client?.address1 || ''}${client?.address2 ? ', ' + client.address2 : ''}${client?.city ? ', ' + client.city : ''}${client?.state ? ', ' + client.state : ''}${client?.pincode ? ' - ' + client.pincode : ''}`;

        const byAddrLines = doc.splitTextToSize(profileAddr, innerW);
        const toAddrLines = doc.splitTextToSize(clientAddr, innerW);

        const byRows = [
            { icon: iconUser, lines: doc.splitTextToSize(profile?.companyName || invoice.profileName || '', innerW) },
            ...(profileAddr.trim() ? [{ icon: iconLocation, lines: byAddrLines }] : []),
            ...(profile?.gstNo ? [{ icon: iconGstin, lines: [`GSTIN: ${profile.gstNo}`] }] : []),
            ...(profile?.taxNo ? [{ icon: iconPan, lines: [`TAN: ${profile.taxNo}`] }] : []),
            ...(profile?.email ? [{ icon: iconMail, lines: [`${profile.email}`] }] : []),
            ...(profile?.contactNo ? [{ icon: iconPhone, lines: [`${profile.contactNo}`] }] : []),
        ];
        
        const toRows = [
            { icon: iconCompany, lines: doc.splitTextToSize(client?.name || invoice.clientName || '', innerW) },
            ...(clientAddr.trim() ? [{ icon: iconLocation, lines: toAddrLines }] : []),
            ...(client?.gstNo ? [{ icon: iconGstin, lines: [`GSTIN: ${client.gstNo}`] }] : []),
            ...(client?.taxNo ? [{ icon: iconPan, lines: [`TAN: ${client.taxNo}`] }] : []),
            ...(client?.email ? [{ icon: iconMail, lines: [`${client.email}`] }] : []),
            ...(client?.contact ? [{ icon: iconPhone, lines: [`${client.contact}`] }] : []),
        ];

        const calcColHeight = (rows) => rows.reduce((h, r) => h + Math.max(iconSize, r.lines.length * lineH) + rowGap, 0);
        const byH = calcColHeight(byRows);
        const toH = calcColHeight(toRows);
        const boxH = Math.max(byH, toH) + 20;

        doc.setFillColor(lavenderBg[0], lavenderBg[1], lavenderBg[2]);
        doc.rect(leftX, currentY, pageWidth - 20, 10, 'F');

        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.rect(leftX, currentY + 10, pageWidth - 20, boxH - 10, 'FD');

        doc.setDrawColor(210, 210, 230);
        doc.line(rightX, currentY + 2, rightX, currentY + boxH - 2);

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
        doc.text("Billed By", leftX + 4, currentY + 7);
        doc.text("Billed To", rightX + 4, currentY + 7);

        const drawRows = (rows, startX, startY) => {
            let y = startY;
            rows.forEach(({ icon, lines }) => {
                const rowH = Math.max(iconSize, lines.length * lineH);
                if (icon) doc.addImage(icon, 'PNG', startX + 3, y, iconSize, iconSize);
                doc.setFontSize(billedFs);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(50, 50, 50);
                lines.forEach((line, i) => {
                    doc.text(line, startX + 3 + textStartOffset, y + (i * lineH) + 2.8);
                });
                y += rowH + rowGap;
            });
        };

        const contentStartYActual = currentY + 12;
        drawRows(byRows, leftX, contentStartYActual);
        drawRows(toRows, rightX, contentStartYActual);

        currentY = currentY + boxH + 8;

        const tableRows = lineItems.map(item => [
            { content: item.item, styles: { fontStyle: 'bold' } },
            { content: item.description || '' },
            { content: String(item.quantity || 1), styles: { halign: 'center' } },
            { content: formatCurrency(item.amount), styles: { halign: 'right' } },
            { content: `${item.sgstRate || 9}%`, styles: { halign: 'center' } },
            { content: `${item.cgstRate || 9}%`, styles: { halign: 'center' } },
            { content: `10%`, styles: { halign: 'center' } },
            { content: formatCurrency(item.total), styles: { halign: 'right', fontStyle: 'bold' } },
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['ITEM', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'SGST', 'CGST', 'TAX (10%)', 'AMOUNT']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6, lineWidth: 0.1 },
            styles: { fontSize: 9.5, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
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
            margin: { top: 62, left: 10, right: 10 },
            didDrawPage: () => { drawPageElements(); }
        });
        currentY = doc.lastAutoTable.finalY + 6;

        const finalTotals = calculateTotals();
        const totalAmount = finalTotals.subtotal + finalTotals.sgst + finalTotals.cgst;

        const amountInWords = numberToWords(Math.round(totalAmount));
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 50, 50);
        doc.text("Amount in Words:", 12, currentY + 10);
        doc.setFont("helvetica", "normal");
        const splitWords = doc.splitTextToSize(amountInWords, pageWidth - 130);
        doc.text(splitWords, 12, currentY + 14);

        if (currentY > pageHeight - 80) {
            doc.addPage();
            drawPageElements();
            currentY = 62;
        }

        autoTable(doc, {
            startY: currentY,
            body: [
                ['TOTAL (INR):', { content: formatCurrency(finalTotals.subtotal), styles: { halign: 'right' } }],
                ['SGST:', { content: formatCurrency(finalTotals.sgst), styles: { halign: 'right' } }],
                ['CGST:', { content: formatCurrency(finalTotals.cgst), styles: { halign: 'right' } }],
                ['Tax (10%) Less:', { content: formatCurrency(finalTotals.tax), styles: { halign: 'right', textColor: [150, 0, 0] } }],
                [
                    { content: 'TOTAL DUE (INR)', styles: { fontStyle: 'bold', fillColor: [0, 0, 0], textColor: [255, 255, 255] } },
                    { content: formatCurrency(totalAmount), styles: { halign: 'right', fontStyle: 'bold', fillColor: [0, 0, 0], textColor: [255, 255, 255] } }
                ],
            ],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [0, 0, 0], cellWidth: 60 },
                1: { textColor: [0, 0, 0], cellWidth: 40 },
            },
            tableWidth: 100,
            margin: { top: 62, left: pageWidth - 110, right: 10 },
            didDrawPage: () => { drawPageElements(); }
        });
        currentY = doc.lastAutoTable.finalY + 8;

        if (invoice.accountNo) {
            if (currentY > pageHeight - 65) {
                doc.addPage();
                drawPageElements();
                currentY = 62;
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
                margin: { top: 62, left: 10, right: 10 },
                didDrawPage: () => { drawPageElements(); }
            });
            currentY = doc.lastAutoTable.finalY + 10;
        }

        const termsItems = [
            { title: 'Payment Terms', text: 'Payment must be made within the due date mentioned in the invoice. Late payments may attract additional charges or interest as applicable.' },
            { title: 'Scope of Work', text: 'The charges mentioned are based on the agreed scope of work and hours. Any additional work outside the agreed scope will be billed separately.' },
            { title: 'Taxes', text: 'All applicable taxes (including GST) are included/excluded as specified in the invoice and are payable by the client.' },
            { title: 'Non-Refund Policy', text: 'Payments once made are non-refundable after the completion of services or delivery of agreed milestones.' },
            { title: 'Dispute Resolution', text: 'Any disputes arising from this invoice shall be subject to the jurisdiction of Coimbatore, Tamil Nadu.' },
        ];

        const innerTextWidth = pageWidth - 36;
        let termsBoxHeight = 16;
        termsItems.forEach(term => {
            const wrapped = doc.splitTextToSize(term.text, innerTextWidth);
            termsBoxHeight += 3 + (wrapped.length * 3.8) + 2;
        });
        termsBoxHeight += 3;

        let isNewPageForTerms = false;
        if (currentY + termsBoxHeight > sigSpaceLimit) {
            doc.addPage();
            drawPageElements();
            currentY = 62;
            isNewPageForTerms = true;
        }

        if (isNewPageForTerms) {
            const availableH = sigSpaceLimit - 62;
            if (termsBoxHeight < availableH) {
                currentY = 62 + (availableH - termsBoxHeight) / 2;
            }
        } else {
            const availableGap = sigSpaceLimit - (currentY + termsBoxHeight);
            if (availableGap > 20) {
                currentY += availableGap / 2;
            } else {
                currentY += 10;
            }
        }

        doc.setFillColor(245, 245, 255);
        doc.setDrawColor(210, 210, 245);
        doc.setLineWidth(0.3);
        doc.roundedRect(10, currentY, pageWidth - 20, termsBoxHeight, 3, 3, 'FD');

        doc.setFillColor(79, 70, 229);
        doc.rect(10, currentY, 2.5, termsBoxHeight, 'F');

        currentY += 6;

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229);
        doc.text("Terms & Conditions", 16, currentY);
        currentY += 5;

        doc.setDrawColor(79, 70, 229);
        doc.setLineWidth(0.2);
        doc.line(16, currentY, pageWidth - 14, currentY);
        currentY += 5;

        termsItems.forEach(term => {
            if (currentY > pageHeight - 40) {
                doc.addPage();
                drawPageElements();
                currentY = 62;
            }
            doc.setFillColor(79, 70, 229);
            doc.circle(18, currentY - 1.2, 0.9, 'F');

            doc.setFontSize(9.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(40, 40, 80);
            doc.text(term.title, 21, currentY);
            currentY += 3;

            doc.setFont("helvetica", "normal");
            doc.setTextColor(80, 80, 100);
            const wrappedText = doc.splitTextToSize(term.text, innerTextWidth);
            doc.text(wrappedText, 21, currentY);
            currentY += (wrappedText.length * 3.8) + 2;
        });

        currentY += 4;

        if (currentY > sigSpaceLimit) {
            doc.addPage();
            drawPageElements();
        }

        currentY = pageHeight - sigHeightNeeded - 20;
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
        doc.text("VTAB Square Pvt Ltd", sigX, currentY);

        return doc;
    }, [invoice, lineItems, calculateTotals, profile, client]);

    useEffect(() => {
        let objectUrl = null;
        const loadPdfPreview = async () => {
            if (invoice) {
                try {
                    setGeneratingPdf(true);
                    const doc = await generatePDFDocument();
                    if (doc) {
                        generatedPdfRef.current = doc;
                        const blob = doc.output('blob');
                        objectUrl = URL.createObjectURL(blob);
                        setPdfUrl(objectUrl);
                    }
                } catch (e) {
                    console.error("PDF generation failed:", e);
                    showToast("Failed to generate PDF preview", "error");
                } finally {
                    setGeneratingPdf(false);
                }
            }
        };
        
        loadPdfPreview();

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [invoice, generatePDFDocument]);

    const handleDownload = async () => {
        if (!invoice) return;
        try {
            const doc = generatedPdfRef.current || await generatePDFDocument();
            if (doc) {
                const sanitize = (name) => name ? name.toUpperCase().replace(/\s+/g, '_') : 'UNKNOWN';
                const fileName = `INVOICE_${invoice.invoiceNo}_${sanitize(invoice.profileName)}_${sanitize(invoice.clientName)}.pdf`;
                doc.save(fileName);
            }
        } catch (err) {
            console.error("PDF download failed", err);
            showToast("Failed to generate PDF download.", "error");
        }
    };

    const handleSendEmail = async () => {
        if (!invoice) return;
        setSendingEmail(true);
        // Force a tiny pause so React can visually render the loading spinner on the button!
        await new Promise(resolve => setTimeout(resolve, 0));
        try {
            const doc = generatedPdfRef.current || await generatePDFDocument();
            if (!doc) throw new Error("Could not generate PDF");

            const pdfBase64 = doc.output('datauristring');
            
            let targetEmail = client?.email;
            if (!targetEmail) {
                targetEmail = prompt("Client email not found. Please enter an email address to proceed:", "");
                if (!targetEmail) {
                    setSendingEmail(false);
                    return;
                }
            }

            await axios.post(`${API_BASE_URL}/invoice/send-email`, {
                invoiceNo: invoice.invoiceNo,
                clientName: invoice.clientName,
                clientEmail: targetEmail,
                pdfBase64: pdfBase64
            });

            showToast("Email sent successfully!");
        } catch (err) {
            console.error("Email send failed", err);
            const errMsg = err.response?.data?.error || err.message || "Failed to send email";
            showToast(`Failed: ${errMsg}`, "error");
        } finally {
            setSendingEmail(false);
        }
    };

    const isAppReady = !loading && invoice && !generatingPdf && pdfUrl;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
            {/* Global Styles for Shimmer */}
            <style>
                {`
                @keyframes shimmer {
                    0% { background-position: -1000px 0; }
                    100% { background-position: 1000px 0; }
                }
                .shimmer {
                    animation: shimmer 2s infinite linear;
                    background: linear-gradient(to right, #f1f5f9 4s, #e2e8f0 25%, #f1f5f9 50%);
                    background-size: 1000px 100%;
                }
                `}
            </style>

            <Sidebar activePage="invoices" />

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                
                {/* Sticky Action Bar */}
                <div style={{ 
                    background: 'rgba(255, 255, 255, 0.95)', 
                    borderBottom: '1px solid #e2e8f0', 
                    padding: '1rem 2rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    height: '80px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => navigate('/invoices')}
                            style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '12px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            {loading || !invoice ? (
                                <>
                                    <div className="shimmer" style={{ width: '150px', height: '24px', borderRadius: '4px', marginBottom: '8px' }}></div>
                                    <div className="shimmer" style={{ width: '100px', height: '16px', borderRadius: '4px' }}></div>
                                </>
                            ) : (
                                <>
                                    <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Preview Invoice #{invoice.invoiceNo}</h1>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{invoice.clientName}</p>
                                </>
                            )}
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button 
                            onClick={handleDownload}
                            disabled={!isAppReady}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                background: '#e0e7ff', color: '#4338ca', padding: '0.625rem 1rem', 
                                borderRadius: '12px', fontWeight: 700, border: 'none', 
                                cursor: isAppReady ? 'pointer' : 'not-allowed',
                                opacity: isAppReady ? 1 : 0.5,
                                transition: 'all 0.2s'
                            }}
                        >
                            <Download size={18} />
                            Download PDF
                        </button>
                        <button 
                            onClick={handleSendEmail}
                            disabled={!isAppReady || sendingEmail}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                background: '#4f46e5', color: 'white', padding: '0.625rem 1.25rem', 
                                borderRadius: '12px', fontWeight: 700, border: 'none', 
                                cursor: (!isAppReady || sendingEmail) ? 'not-allowed' : 'pointer',
                                opacity: (!isAppReady || sendingEmail) ? 0.5 : 1,
                                transition: 'all 0.2s'
                            }}
                        >
                            {sendingEmail ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                            {sendingEmail ? 'Sending...' : 'Send to Email'}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, width: '100%', display: 'flex', backgroundColor: '#f8fafc', position: 'relative' }}>
                    {!isAppReady ? (
                        !loading && !invoice ? (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', zIndex: 10 }}>
                                <X size={48} color="#dc2626" style={{ marginBottom: '1rem' }} />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Failed to Load Invoice</h2>
                                <p style={{ color: '#64748b' }}>We could not find the invoice data you are looking for.</p>
                            </div>
                        ) : (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', zIndex: 10 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                                    <p style={{ color: '#4f46e5', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                        {loading ? 'Fetching Invoice Details...' : 'Loading PDF...'}
                                    </p>
                                </div>
                            </div>
                        )
                    ) : null}
                    
                    {isAppReady && (
                         <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                             <iframe 
                                 src={`${pdfUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=0`} 
                                 title="PDF Exact Preview"
                                 style={{ 
                                     position: 'absolute',
                                     top: '-15px',
                                     left: '-20px',
                                     width: 'calc(100% + 42px)', 
                                     height: 'calc(100% + 15px)', 
                                     border: 'none', 
                                     opacity: 1, 
                                     transition: 'opacity 0.5s ease-in-out' 
                                 }}
                             />
                         </div>
                    )}
                </div>
            </main>

            {/* Toast Notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 50,
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem',
                    borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    background: toastType === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${toastType === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: toastType === 'success' ? '#166534' : '#991b1b',
                    fontWeight: 700
                }}>
                    {toastType === 'success' ? <Check size={20} color="#16a34a" /> : <X size={20} color="#dc2626" />}
                    <p style={{ margin: 0 }}>{toastMessage}</p>
                </div>
            )}
        </div>
    );
};

export default InvoicePreview;
