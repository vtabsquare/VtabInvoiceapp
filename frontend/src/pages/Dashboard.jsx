import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, UserCircle, Clock, ChevronRight, Calendar, Filter, Download } from 'lucide-react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import API_BASE_URL from '../api';

const Dashboard = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters State
    const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
    const [selectedClient, setSelectedClient] = useState('All Clients');
    const [selectedProfile, setSelectedProfile] = useState('All Profiles');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [clientsRes, profilesRes, invoicesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/clients`),
                axios.get(`${API_BASE_URL}/profiles`),
                axios.get(`${API_BASE_URL}/invoices`)
            ]);

            setClients(clientsRes.data);
            setProfiles(profilesRes.data);
            setInvoices(invoicesRes.data);

        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const dateMatch = (!dateFilter.from || inv.invoiceDate >= dateFilter.from) &&
                             (!dateFilter.to || inv.invoiceDate <= dateFilter.to);
            const clientMatch = selectedClient === 'All Clients' || inv.clientName === selectedClient;
            const profileMatch = selectedProfile === 'All Profiles' || inv.profileName === selectedProfile;
            return dateMatch && clientMatch && profileMatch;
        });
    }, [invoices, dateFilter, selectedClient, selectedProfile]);

    // Totals Calculation
    const totals = useMemo(() => {
        return filteredInvoices.reduce((acc, inv) => {
            const getNum = (val) => parseFloat(String(val || 0).replace(/[^\d.-]/g, '')) || 0;
            acc.amount += getNum(inv.amount);
            acc.cgst += getNum(inv.cgst);
            acc.sgst += getNum(inv.sgst);
            acc.tds += getNum(inv.tds || inv.tax);
            acc.total += getNum(inv.total);
            return acc;
        }, { amount: 0, cgst: 0, sgst: 0, tds: 0, total: 0 });
    }, [filteredInvoices]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(val);
    };

    const stats = [
        { label: 'Total Invoice Amount (Without Tax)', value: formatCurrency(totals.amount), icon: FileText, color: '#2563eb', bg: '#eff6ff' },
        { label: 'Total CGST', value: formatCurrency(totals.cgst), icon: FileText, color: '#9333ea', bg: '#faf5ff' },
        { label: 'Total SGST', value: formatCurrency(totals.sgst), icon: FileText, color: '#16a34a', bg: '#f0fdf4' },
        { label: 'Total TDS', value: formatCurrency(totals.tds), icon: Clock, color: '#ea580c', bg: '#fff7ed' },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
            <Sidebar activePage="dashboard" />

            <main style={{ flex: 1, overflow: 'auto' }} className="main-content">
                <header style={{
                    background: 'white',
                    padding: '1.25rem 2rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div>
                        <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#0f172a', margin: 0 }}>Invoice Dashboard</h2>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                            Comprehensive filtered overview and dynamic calculations.
                        </p>
                    </div>
                    <div style={{
                        background: '#eff6ff', color: '#2563eb',
                        padding: '0.5rem 1rem', borderRadius: '2rem',
                        fontSize: '0.813rem', fontWeight: 600,
                        border: '1px solid #bfdbfe'
                    }}>
                        {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                </header>

                <div style={{ padding: '2rem' }}>
                    {/* Filters Section */}
                    <div style={{ 
                        background: 'white', borderRadius: '1rem', padding: '1.5rem', 
                        border: '1px solid #e2e8f0', marginBottom: '1.5rem',
                        display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end'
                    }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>DATE RANGE</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input 
                                    type="date" 
                                    value={dateFilter.from} 
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                                    style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.875rem' }} 
                                />
                                <span style={{ color: '#94a3b8' }}>to</span>
                                <input 
                                    type="date" 
                                    value={dateFilter.to} 
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                                    style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.875rem' }} 
                                />
                            </div>
                        </div>

                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>CLIENT FILTER</label>
                            <select 
                                value={selectedClient} 
                                onChange={(e) => setSelectedClient(e.target.value)}
                                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.875rem', background: 'white' }}
                            >
                                <option>All Clients</option>
                                {clients.map(c => <option key={c.serialNo} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>

                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>PROFILE FILTER</label>
                            <select 
                                value={selectedProfile} 
                                onChange={(e) => setSelectedProfile(e.target.value)}
                                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.875rem', background: 'white' }}
                            >
                                <option>All Profiles</option>
                                {profiles.map(p => <option key={p.serialNo} value={p.companyName}>{p.companyName}</option>)}
                            </select>
                        </div>

                        <button 
                            onClick={() => {
                                setDateFilter({ from: '', to: '' });
                                setSelectedClient('All Clients');
                                setSelectedProfile('All Profiles');
                            }}
                            style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Reset
                        </button>
                    </div>

                    {/* Summary Section - Counts */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        {[
                            { label: 'Total Invoices', value: filteredInvoices.length, icon: FileText, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Total Clients', value: clients.length, icon: Users, color: '#16a34a', bg: '#f0fdf4' },
                            { label: 'Total Profiles', value: profiles.length, icon: UserCircle, color: '#9333ea', bg: '#faf5ff' },
                            { label: 'Invoice Approved', value: filteredInvoices.length, icon: Clock, color: '#ea580c', bg: '#fff7ed' },
                        ].map((stat) => (
                            <div key={stat.label} style={{
                                background: 'white', borderRadius: '1rem',
                                padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                display: 'flex', alignItems: 'center', gap: '1rem'
                            }}>
                                <div style={{
                                    width: '3rem', height: '3rem', borderRadius: '0.75rem',
                                    background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <stat.icon style={{ width: '1.25rem', height: '1.25rem', color: stat.color }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.125rem 0 0 0' }}>{loading ? '...' : stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary Section - Amounts */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                        {[
                            { label: 'Total Invoice Amount (Without Tax)', value: formatCurrency(totals.amount), icon: FileText, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Total CGST', value: formatCurrency(totals.cgst), icon: FileText, color: '#9333ea', bg: '#faf5ff' },
                            { label: 'Total SGST', value: formatCurrency(totals.sgst), icon: FileText, color: '#16a34a', bg: '#f0fdf4' },
                            { label: 'Total TDS (Tax)', value: formatCurrency(totals.tds), icon: Clock, color: '#ea580c', bg: '#fff7ed' },
                        ].map((stat) => (
                            <div key={stat.label} style={{
                                background: 'white', borderRadius: '1rem',
                                padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                display: 'flex', alignItems: 'center', gap: '1rem'
                            }}>
                                <div style={{
                                    width: '3rem', height: '3rem', borderRadius: '0.75rem',
                                    background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <stat.icon style={{ width: '1.25rem', height: '1.25rem', color: stat.color }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</p>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0.125rem 0 0 0' }}>{loading ? '...' : stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Invoices Table */}
                    <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '1.125rem' }}>Filtered Invoices</h3>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.813rem', color: '#64748b' }}>Showing {filteredInvoices.length} records</p>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
                                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <tr>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Invoice & Date</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Client & Profile</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Amount (Net)</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>CGST</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>SGST</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Total</th>
                                        {/* <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Status</th> */}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading data...</td>
                                        </tr>
                                    ) : filteredInvoices.length > 0 ? (
                                        filteredInvoices.map((inv, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fcfdfe' }}>
                                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>#{inv.invoiceNo}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{inv.invoiceDate}</div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>{inv.clientName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{inv.profileName}</div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 600 }}>₹{parseFloat(inv.amount || 0).toLocaleString()}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', color: '#64748b' }}>₹{parseFloat(inv.cgst || 0).toLocaleString()}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', color: '#64748b' }}>₹{parseFloat(inv.sgst || 0).toLocaleString()}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>₹{parseFloat(inv.total || 0).toLocaleString()}</td>
                                                {/* <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                                                    <span style={{ 
                                                        fontSize: '0.688rem', padding: '0.25rem 0.75rem', borderRadius: '1rem', 
                                                        background: '#dcfce7', color: '#16a34a', fontWeight: 700,
                                                        display: 'inline-block', whiteSpace: 'nowrap'
                                                    }}>
                                                        INVOICE APPROVED
                                                    </span>
                                                </td> */}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                                <div style={{ opacity: 0.5, marginBottom: '0.5rem' }}><Filter size={32} style={{ margin: '0 auto' }} /></div>
                                                No invoices match the current filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            <style>{`
                input:focus, select:focus {
                    outline: 2px solid #2563eb20;
                    border-color: #2563eb !important;
                }
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: #f1f5f9; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; borderRadius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
};

export default Dashboard;
