import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users as UsersIcon, Building2,
    FileText, Settings, LogOut, IndianRupee, Menu, X
} from 'lucide-react';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = React.useState(false);
    const adminEmail = localStorage.getItem('adminEmail') || 'Admin';

    const navItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Clients', icon: UsersIcon, path: '/clients' },
        { label: 'Profiles', icon: Building2, path: '/profiles' },
        { label: 'Invoices', icon: FileText, path: '/invoices' },
    ];

    const handleLogout = () => {
        localStorage.removeItem('adminEmail');
        navigate('/login');
    };

    return (
        <>
            {/* Mobile Header */}
            <header style={{
                display: 'none',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: 'white',
                borderBottom: '1px solid #e2e8f0',
                padding: '0 1rem',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 40
            }} className="mobile-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img 
                            src="/vtab.jpeg" 
                            alt="VTAB Logo" 
                            style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                borderRadius: '2px'
                            }} 
                        /> 
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>VTAB Square Invoice</span>
                </div>
                <button
                    onClick={() => setIsOpen(true)}
                    style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', color: '#64748b' }}
                >
                    <Menu size={24} />
                </button>
            </header>

            {/* Backdrop */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 50 }}
                />
            )}

            {/* laptop */}

            <aside style={{
                width: '280px',
                background: 'white',
                borderRight: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                position: 'sticky',
                top: 0,
                height: '100vh',
                flexShrink: 0,
                transition: 'transform 0.3s ease',
            }} className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div style={{
                    padding: '2rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    borderBottom: '1px solid #f1f5f9'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <img
                            src="/vtab.jpeg"
                            alt="VTAB Logo"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '2px'
                            }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>VTAB Square Invoice</span>
                    </div>
                    <button
                        className="mobile-close"
                        onClick={() => setIsOpen(false)}
                        style={{ display: 'none', background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', color: '#64748b' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav style={{ padding: '1.5rem 1rem', flex: 1 }}>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.label}
                                onClick={() => {
                                    navigate(item.path);
                                    setIsOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    width: '100%',
                                    padding: '0.875rem 1rem',
                                    marginBottom: '0.5rem',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: isActive ? '#eff6ff' : 'transparent',
                                    color: isActive ? '#2563eb' : '#64748b',
                                    fontWeight: isActive ? 600 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = '#f8fafc';
                                        e.currentTarget.style.color = '#0f172a';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#64748b';
                                    }
                                }}
                            >
                                <item.icon style={{ width: '20px' }} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div style={{ padding: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        marginBottom: '1rem',
                        paddingLeft: '0.5rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {adminEmail}
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#fef2f2',
                            color: '#ef4444',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#fef2f2'}
                    >
                        <LogOut style={{ width: '18px' }} /> Logout
                    </button>
                </div>
            </aside>

            <style>{`
                @media (max-width: 1024px) {
                    .sidebar {
                        position: fixed !important;
                        z-index: 60;
                        transform: translateX(-100%);
                        box-shadow: 20px 0 50px rgba(0,0,0,0.1);
                    }
                    .sidebar.open {
                        transform: translateX(0);
                    }
                    .mobile-header {
                        display: flex !important;
                    }
                    .mobile-close {
                        display: block !important;
                    }
                }
            `}</style>
        </>
    );
};

export default Sidebar;
