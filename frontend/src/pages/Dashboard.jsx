import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, UserCircle, Clock, ChevronRight } from 'lucide-react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import API_BASE_URL from '../api';

const Dashboard = () => {
    const navigate = useNavigate();
    const adminEmail = localStorage.getItem('adminEmail') || 'Admin';

    const [stats, setStats] = useState([
        { label: 'Total Invoices', value: '0', icon: FileText, color: 'blue', bg: '#eff6ff', iconColor: '#2563eb' },
        { label: 'Total Clients', value: '0', icon: Users, color: 'green', bg: '#f0fdf4', iconColor: '#16a34a' },
        { label: 'Total Profiles', value: '0', icon: UserCircle, color: 'purple', bg: '#faf5ff', iconColor: '#9333ea' },
        { label: 'Pending', value: '0', icon: Clock, color: 'orange', bg: '#fff7ed', iconColor: '#ea580c' },
    ]);

    const [recentInvoices, setRecentInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

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

            const clientCount = clientsRes.data.length;
            const profileCount = profilesRes.data.length;
            const invoiceCount = invoicesRes.data.length;

            setStats([
                { label: 'Total Invoices', value: invoiceCount.toString(), icon: FileText, color: 'blue', bg: '#eff6ff', iconColor: '#2563eb' },
                { label: 'Total Clients', value: clientCount.toString(), icon: Users, color: 'green', bg: '#f0fdf4', iconColor: '#16a34a' },
                { label: 'Total Profiles', value: profileCount.toString(), icon: UserCircle, color: 'purple', bg: '#faf5ff', iconColor: '#9333ea' },
                { label: 'Pending', value: '0', icon: Clock, color: 'orange', bg: '#fff7ed', iconColor: '#ea580c' },
            ]);

            // Sort and get recent 5
            const sorted = [...invoicesRes.data].reverse().slice(0, 5);
            setRecentInvoices(sorted);

        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
            <Sidebar />

            {/* Main Content */}
            <main style={{ flex: 1, overflow: 'auto' }} className="main-content">
                <header style={{
                    background: 'white',
                    padding: '1.25rem 2rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }} className="dashboard-header">
                    <div>
                        <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#0f172a', margin: 0 }}>Dashboard</h2>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }} className="header-subtext">
                            Welcome back! Here's your business overview.
                        </p>
                    </div>
                    <div style={{
                        background: '#eff6ff', color: '#2563eb',
                        padding: '0.5rem 1rem', borderRadius: '2rem',
                        fontSize: '0.813rem', fontWeight: 600,
                        border: '1px solid #bfdbfe'
                    }} className="date-badge">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                </header>

                <div style={{ padding: '2rem' }} className="content-container">
                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                        {stats.map((stat) => (
                            <div key={stat.label} style={{
                                background: 'white', borderRadius: '1rem',
                                padding: '1.5rem', border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                display: 'flex', alignItems: 'center', gap: '1rem',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'default',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
                            >
                                <div style={{
                                    width: '3rem', height: '3rem', borderRadius: '0.75rem',
                                    background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <stat.icon style={{ width: '1.375rem', height: '1.375rem', color: stat.iconColor }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: 500 }}>{stat.label}</p>
                                    <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0.125rem 0 0 0', lineHeight: 1 }}>{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions */}
                    <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', fontSize: '1rem' }}>Quick Actions</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                            {[
                                { label: 'New Client', icon: Users, color: '#2563eb', bg: '#eff6ff', path: '/clients' },
                                { label: 'New Profile', icon: UserCircle, color: '#9333ea', bg: '#faf5ff', path: '/profiles' },
                                { label: 'Create Invoice', icon: FileText, color: '#16a34a', bg: '#f0fdf4', path: '/invoices' },
                            ].map(action => (
                                <button key={action.label} onClick={() => navigate(action.path)} style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                                    padding: '1.25rem', borderRadius: '0.75rem',
                                    background: action.bg, border: `1px solid ${action.color}20`,
                                    color: action.color, fontWeight: 600, fontSize: '0.875rem',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${action.color}20`; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    <action.icon style={{ width: '1.5rem', height: '1.5rem' }} />
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #e2e8f0', marginTop: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', animation: 'slideInUp 0.6s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '1rem' }}>Recent Invoices</h3>
                            <button onClick={() => navigate('/invoices')} style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                View All <ChevronRight size={16} />
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                                <div className="spinner" style={{ width: '2rem', height: '2rem', border: '3px solid #f3f3f3', borderTop: '3px solid #2563eb', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }}></div>
                                <p style={{ fontSize: '0.875rem' }}>Loading activity...</p>
                            </div>
                        ) : recentInvoices.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {recentInvoices.map((inv, idx) => (
                                    <div key={idx} style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FileText size={18} color="#64748b" />
                                            </div>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '0.938rem' }}>{inv.clientName}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Invoice #{inv.invoiceNo} • {inv.invoiceDate}</p>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontWeight: 800, color: '#1e293b' }}>₹{parseFloat(inv.total).toFixed(2)}</p>
                                            <span style={{ fontSize: '0.688rem', padding: '0.125rem 0.5rem', borderRadius: '1rem', background: '#dcfce7', color: '#16a34a', fontWeight: 700 }}>PAID</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                                <FileText style={{ width: '2.5rem', height: '2.5rem', margin: '0 auto 0.75rem', opacity: 0.4 }} />
                                <p style={{ margin: 0, fontSize: '0.875rem' }}>No invoices yet. Create your first invoice!</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes slideInUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @media (max-width: 1024px) {
                    .main-content {
                        padding-top: 60px;
                    }
                    .dashboard-header {
                        padding: 1rem !important;
                    }
                    .header-subtext {
                        display: none;
                    }
                    .date-badge {
                        font-size: 0.75rem !important;
                        padding: 0.4rem 0.8rem !important;
                    }
                    .content-container {
                        padding: 1rem !important;
                    }
                }
                @media (max-width: 640px) {
                    .date-badge {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
