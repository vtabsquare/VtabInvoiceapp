import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users as UsersIcon, Building2,
    FileText, TrendingUp, Settings, LogOut, IndianRupee, Menu, X
} from 'lucide-react';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = React.useState(false);
    const adminEmail = localStorage.getItem('adminEmail') || 'Admin';

    const navItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Client', icon: UsersIcon, path: '/clients' },
        { label: 'Profile', icon: Building2, path: '/profiles' },
        { label: 'Invoice', icon: FileText, path: '/invoices' },
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
                    <div style={{ width: '45px', height: '45px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                            src="/vtab.jpeg"
                            alt="VTAB Logo"
                            style={{
                                width: '45px',
                                height: '45px',
                                objectFit: 'cover',
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
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '1rem',
                    borderBottom: '1px solid #f1f5f9'
                }}>
                    <div style={{
                        width: '180px',
                        height: '180px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        padding: '2px', // subtle border effect
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                    }}>
                        <img
                            src="/vtab.jpeg"
                            alt="VTAB Logo"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                    </div>
                    <div style={{ flex: 1, marginTop: '0.5rem' }}>
                        <span style={{ 
                            fontSize: '1.25rem', 
                            fontWeight: 800, 
                            color: '#6c6ceaff', 
                            letterSpacing: '-0.02em',
                            display: 'block',
                            lineHeight: 1.2
                        }}>
                            VTAB Square
                        </span>
                    </div>
                    <button
                        className="mobile-close"
                        onClick={() => setIsOpen(false)}
                        style={{ display: 'none', background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', color: '#64748b' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Blue Navigation Area */}
                <div style={{
                    flex: 1,
                    // background: '#6262eeff', // Exact black-blue as requested
                    background: '#4B4BB7',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1.5rem 1rem'
                }}>
                    <nav style={{ flex: 1 }}>
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
                                        marginBottom: '0.625rem',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: isActive ? '#2bce64ff' : 'transparent', // Light Green active
                                        color: isActive ? '#14532d' : '#f8fafc', // Dark green text if active, white if not
                                        fontWeight: isActive ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.transform = 'translateX(4px)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.transform = 'translateX(0)';
                                        }
                                    }}
                                >
                                    <item.icon style={{ 
                                        width: '20px', 
                                        color: isActive ? '#16a34a' : '#f8fafc' 
                                    }} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>

                    <div style={{ 
                        marginTop: 'auto',
                        paddingTop: '1.5rem', 
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)' 
                    }}>
                        <div style={{
                            fontSize: '0.75rem',
                            color: '#090909ff',
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
                                background: 'rgba(225, 212, 212, 0.94)',
                                color: '#101010ff',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                                e.currentTarget.style.color = '#161616ff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(225, 212, 212, 0.94)';
                                e.currentTarget.style.color = '#090909ff';
                            }}
                        >
                            <LogOut style={{ width: '18px' }} /> Logout
                        </button>
                    </div>
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
