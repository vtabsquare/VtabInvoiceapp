import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ChevronRight, RefreshCw, KeyRound, ArrowLeft } from 'lucide-react';
import '../index.css';

import API_BASE_URL from '../api';

const Login = () => {
    const navigate = useNavigate();
    const [view, setView] = useState('login'); // login | forgot | otp | reset
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post(`${API_BASE_URL}/login`, { email, password });
            localStorage.setItem('adminEmail', res.data.email || email);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.post(`${API_BASE_URL}/send-otp`, { email });
            setMessage('OTP sent to your console / email.');
            setView('otp');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.post(`${API_BASE_URL}/verify-otp`, { email, otp });
            setView('reset');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.post(`${API_BASE_URL}/change-password`, { email, otp, newPassword });
            setMessage('Password reset successful. Please login.');
            setView('login');
            setPassword('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif',
        }}>
            {/* Decorative blobs */}
            <div style={{
                position: 'absolute', top: '-15%', left: '-15%',
                width: '45%', height: '45%', background: '#bfdbfe',
                borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute', bottom: '-15%', right: '-15%',
                width: '45%', height: '45%', background: '#ddd6fe',
                borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, pointerEvents: 'none'
            }} />

            <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '3rem', height: '3rem', background: 'linear-gradient(135deg, #2563eb, #9333ea)',
                        borderRadius: '0.875rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '1rem', boxShadow: '0 8px 20px rgba(37,99,235,0.3)'
                    }}>
                        <span style={{ fontSize: '1.25rem' }}>⚡</span>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>VTAB Square</h1>
                    <p style={{ color: '#64748b', margin: '0.375rem 0 0 0', fontWeight: 500, fontSize: '0.875rem' }}>Invoice Management System</p>
                </div>

                {/* Alerts */}
                {error && (
                    <div style={{
                        marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fef2f2',
                        border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.875rem',
                        borderRadius: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        ⚠️ {error}
                    </div>
                )}
                {message && !error && (
                    <div style={{
                        marginBottom: '1rem', padding: '0.75rem 1rem', background: '#f0fdf4',
                        border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '0.875rem',
                        borderRadius: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        ✅ {message}
                    </div>
                )}

                {/* LOGIN VIEW */}
                {view === 'login' && (
                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <label className="label">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1.125rem', height: '1.125rem', color: '#94a3b8' }} />
                                <input
                                    type="email"
                                    className="input"
                                    style={{ paddingLeft: '2.75rem' }}
                                    placeholder="admin@vtab.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label className="label" style={{ marginBottom: 0 }}>Password</label>
                                <button
                                    type="button"
                                    onClick={() => { setView('forgot'); setError(''); setMessage(''); }}
                                    style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Forgot Password?
                                </button>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1.125rem', height: '1.125rem', color: '#94a3b8' }} />
                                <input
                                    type="password"
                                    className="input"
                                    style={{ paddingLeft: '2.75rem' }}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                            {loading
                                ? <RefreshCw style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} />
                                : <><span>Sign In</span><ChevronRight style={{ width: '1rem', height: '1rem', marginLeft: 'auto' }} /></>
                            }
                        </button>
                    </form>
                )}

                {/* FORGOT PASSWORD VIEW */}
                {view === 'forgot' && (
                    <form onSubmit={handleSendOTP}>
                        <button type="button" onClick={() => { setView('login'); setError(''); setMessage(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            <ArrowLeft style={{ width: '1rem', height: '1rem' }} /> Back to Login
                        </button>
                        <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#0f172a', marginBottom: '0.5rem' }}>Forgot Password</h2>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Enter your admin email and we'll generate an OTP.</p>

                        <div className="input-group">
                            <label className="label">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1.125rem', height: '1.125rem', color: '#94a3b8' }} />
                                <input
                                    type="email" className="input" style={{ paddingLeft: '2.75rem', backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                                    placeholder="admin@vtab.com" value={email}
                                    onChange={(e) => setEmail(e.target.value)} required
                                    readOnly={true}
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                            {loading
                                ? <RefreshCw style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} />
                                : <><span>Send OTP</span><KeyRound style={{ width: '1rem', height: '1rem', marginLeft: 'auto' }} /></>
                            }
                        </button>
                    </form>
                )}

                {/* OTP VIEW */}
                {view === 'otp' && (
                    <form onSubmit={handleVerifyOTP}>
                        <button type="button" onClick={() => { setView('forgot'); setError(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            <ArrowLeft style={{ width: '1rem', height: '1rem' }} /> Back
                        </button>
                        <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#0f172a', marginBottom: '0.5rem' }}>Verify OTP</h2>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Enter the 6-digit OTP from your backend console.</p>

                        <div className="input-group">
                            <label className="label">6-Digit Code</label>
                            <input
                                type="text" className="input"
                                style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.25rem', fontWeight: 700 }}
                                maxLength="6" value={otp}
                                onChange={(e) => setOtp(e.target.value)} required
                            />
                        </div>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                            {loading ? <RefreshCw style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} /> : 'Verify OTP'}
                        </button>
                    </form>
                )}

                {/* RESET PASSWORD VIEW */}
                {view === 'reset' && (
                    <form onSubmit={handleResetPassword}>
                        <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#0f172a', marginBottom: '0.5rem' }}>Create New Password</h2>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Enter a strong new password below.</p>

                        <div className="input-group">
                            <label className="label">New Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1.125rem', height: '1.125rem', color: '#94a3b8' }} />
                                <input
                                    type="password" className="input" style={{ paddingLeft: '2.75rem' }}
                                    placeholder="••••••••" value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)} required
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                            {loading ? <RefreshCw style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} /> : 'Reset Password'}
                        </button>
                    </form>
                )}
            </div>

            <div style={{
                position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap'
            }}>
                © 2026 VTAB Square Invoice. All rights reserved.
            </div>

            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};

export default Login;
