import React, { useState, useEffect } from 'react';
import {
    Plus, Search, FileText, Calendar, Building2, User,
    Download, Trash2, IndianRupee, ChevronRight, Filter, ExternalLink, Pencil
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const API_BASE_URL = 'http://localhost:5000/api/admin';

const Invoices = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/invoices`);
            setInvoices(res.data);
        } catch (err) {
            console.error("Error fetching invoices:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (serialNo) => {
        if (!window.confirm(`Are you sure you want to delete invoice #${serialNo}?`)) return;
        try {
            await axios.delete(`${API_BASE_URL}/invoices/${serialNo}`);
            fetchInvoices();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete invoice');
        }
    };

    const filteredInvoices = invoices.filter(inv =>
        inv.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.profileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.serialNo?.includes(searchQuery)
    );

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: num % 1 === 0 ? 0 : 2
        });
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
            <Sidebar activePage="invoices" />

            <main style={{ flex: 1, overflow: 'auto' }} className="animate-fade-in-up main-content">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', padding: '1.25rem 2rem' }} className="invoices-header">
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Invoice Management</h1>
                        <p style={{ color: '#64748b', fontSize: '1rem' }} className="header-subtext">Track and manage all your business invoices</p>
                    </div>
                    <button
                        onClick={() => navigate('/add-invoice')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
                        className="add-invoice-btn"
                    >
                        <Plus style={{ width: '20px' }} /> <span>Add New Invoice</span>
                    </button>
                </header>

                {/* Search Bar */}
                <div style={{ padding: '0 2rem' }} className="content-container">
                    <div style={{ background: 'white', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Search style={{ color: '#94a3b8', width: '20px' }} />
                        <input
                            type="text"
                            placeholder="Search by invoice no, client or business name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', color: '#0f172a' }}
                        />
                    </div>
                </div>
                {/* Invoices List */}
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                    <table style={{ minWidth: '850px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Serial & Invoice</th>
                                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Billed Details</th>
                                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Dates</th>
                                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem', textAlign: 'right' }}>Amount</th>
                                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <p>Loading invoices...</p>
                                    </td>
                                </tr>
                            ) : filteredInvoices.length > 0 ? filteredInvoices.map((inv, idx) => (
                                <tr key={`${inv.serialNo}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1' }}>#{inv.serialNo}</span>
                                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{inv.invoiceNo}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ fontSize: '0.875rem' }}>
                                            <div style={{ color: '#334155', fontWeight: 600 }}>{inv.clientName}</div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>from {inv.profileName}</div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ fontSize: '0.875rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={14} style={{ color: '#94a3b8' }} /> {formatDate(inv.invoiceDate)}
                                            </div>
                                            {inv.dueDate && (
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    Due: {formatDate(inv.dueDate)}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.125rem' }}>
                                            ₹{formatCurrency(inv.total)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button
                                                onClick={() => navigate(`/edit-invoice/${inv.serialNo}`)}
                                                style={{ background: '#f0f9ff', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: '#0ea5e9' }}
                                                title="Edit Invoice"
                                            >
                                                <Pencil style={{ width: '18px' }} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(inv.serialNo)}
                                                style={{ background: '#fef2f2', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: '#ef4444' }}
                                                title="Delete Invoice"
                                            >
                                                <Trash2 style={{ width: '18px' }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <FileText style={{ width: '48px', height: '48px', margin: '0 auto 1rem', opacity: 0.2 }} />
                                        <p>No invoices found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.4s ease-out;
                }
                @media (max-width: 1024px) {
                    .main-content {
                        padding-top: 60px;
                    }
                    .invoices-header {
                        padding: 1.5rem !important;
                        margin-bottom: 1.5rem !important;
                    }
                    .content-container {
                        padding: 1rem !important;
                    }
                }
                @media (max-width: 640px) {
                    .add-invoice-btn span {
                        display: none;
                    }
                    .add-invoice-btn {
                        padding: 0.5rem 0.75rem !important;
                    }
                    .header-subtext {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default Invoices;
