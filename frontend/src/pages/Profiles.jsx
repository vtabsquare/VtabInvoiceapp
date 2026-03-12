import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Building2, User, Mail, Phone, MapPin,
    Globe, Hash, Users, Check, X, Briefcase, IndianRupee, ChevronRight,
    FileText, Trash2
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import API_BASE_URL from '../api';

const Profiles = () => {
    const navigate = useNavigate();
    const adminEmail = localStorage.getItem('adminEmail') || 'Admin';

    const [profiles, setProfiles] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [newProfileSerial, setNewProfileSerial] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingSerial, setEditingSerial] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        companyName: '',
        pointOfContact: '',
        email: '',
        contactNo: '',
        address1: '',
        address2: '',
        country: 'India',
        state: '',
        otherState: '',
        city: '',
        otherCity: '',
        pincode: '',
        gstNo: '',
        teamSize: '',
        industry: '',
        taxNo: ''
    });

    const teamSizes = ["2-10", "10-20", "20-50", "50-100", "100-200", "200-500", "500+"];

    const countries = ["India", "USA", "UK", "Canada", "Singapore"];

    const statesByCountry = {
        "India": [
            "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
            "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
            "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
            "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
            "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Delhi",
            "Jammu and Kashmir", "Ladakh", "Puducherry", "Others"
        ],
        "USA": ["California", "New York", "Texas", "Florida", "Others"],
    };

    const citiesByState = {
        "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Trichy", "Salem", "Tirunelveli", "Erode", "Vellore", "Thanjavur", "Others"],
        "Karnataka": ["Bangalore", "Mysore", "Hubli", "Mangalore", "Belgaum", "Gulbarga", "Davanagere", "Others"],
        "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Amravati", "Others"],
        "Delhi": ["New Delhi", "North Delhi", "South Delhi", "West Delhi", "East Delhi", "Others"],
        "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Ramagundam", "Others"],
        "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Others"],
        "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Kollam", "Thrissur", "Others"],
        "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Others"],
        "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Others"],
        "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Noida", "Ghaziabad", "Meerut", "Others"],
        "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Others"],
        "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Pathankot", "Others"],
        "Haryana": ["Gurgaon", "Faridabad", "Panipat", "Ambala", "Rohtak", "Others"],
        "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Others"],
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/profiles`);
            setProfiles(res.data);
        } catch (err) {
            console.error("Error fetching profiles:", err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Numeric only for contact and pincode
        if ((name === 'contactNo' || name === 'pincode') && value !== '' && !/^\d+$/.test(value)) {
            return;
        }

        // Length limits
        if (name === 'contactNo' && value.length > 10) return;
        if (name === 'pincode' && value.length > 6) return;
        if (name === 'gstNo' && value.length > 15) return;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Final Validation
        if (formData.contactNo.length !== 10) {
            setError('Contact Number must be 10 digits');
            setLoading(false);
            return;
        }
        if (formData.pincode.length !== 6) {
            setError('Pincode must be 6 digits');
            setLoading(false);
            return;
        }

        const finalData = {
            ...formData,
            state: formData.state === 'Others' ? formData.otherState : formData.state,
            city: formData.city === 'Others' ? formData.otherCity : formData.city
        };

        try {
            if (isEditing) {
                await axios.put(`${API_BASE_URL}/profiles/${editingSerial}`, finalData);
            } else {
                const response = await axios.post(`${API_BASE_URL}/profiles`, finalData);
                setNewProfileSerial(response.data.serialNo);
            }

            setShowModal(false);
            if (!isEditing) {
                setShowSuccessModal(true);
            }
            fetchProfiles();

            // Reset Form
            resetForm();

        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'add'} profile`);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            companyName: '', pointOfContact: '', email: '', contactNo: '',
            address1: '', address2: '', country: 'India', state: '', otherState: '',
            city: '', otherCity: '', pincode: '', gstNo: '', teamSize: '',
            industry: '', taxNo: ''
        });
        setIsEditing(false);
        setEditingSerial(null);
        setError('');
    };

    const handleEdit = (profile) => {
        setIsEditing(true);
        setEditingSerial(profile.serialNo);

        // Match state dropdown
        const countryStates = statesByCountry[profile.country || 'India'] || [];
        const isStandardState = countryStates.includes(profile.state);

        // Match city dropdown
        const stateCities = citiesByState[profile.state] || [];
        const isStandardCity = stateCities.includes(profile.city);

        setFormData({
            companyName: profile.companyName,
            pointOfContact: profile.pointOfContact,
            email: profile.email,
            contactNo: profile.contactNo,
            address1: profile.address1,
            address2: profile.address2,
            country: profile.country || 'India',
            state: isStandardState ? profile.state : (profile.state ? 'Others' : ''),
            otherState: isStandardState ? '' : profile.state,
            city: isStandardCity ? profile.city : (profile.city ? 'Others' : ''),
            otherCity: isStandardCity ? '' : profile.city,
            pincode: profile.pincode,
            gstNo: profile.gstNo || '',
            teamSize: profile.teamSize
        });
        setError('');
        setShowModal(true);
    };

    const handleDelete = async (serialNo) => {
        if (!window.confirm(`Are you sure you want to delete profile #${serialNo}?`)) return;
        try {
            await axios.delete(`${API_BASE_URL}/profiles/${serialNo}`);
            fetchProfiles();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete profile');
        }
    };

    const filteredProfiles = profiles.filter(p =>
        p.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.serialNo?.includes(searchQuery)
    );

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
            <Sidebar />

            {/* Main Content */}
            <main style={{ flex: 1, overflow: 'auto' }} className="animate-fade-in-up main-content">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', padding: '1.25rem 2rem' }} className="profiles-header">
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Profile Management</h1>
                        <p style={{ color: '#64748b', fontSize: '1rem' }} className="header-subtext">Manage your business profiles and branches</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
                        className="add-profile-btn"
                    >
                        <Plus style={{ width: '20px' }} /> <span>Add New Profile</span>
                    </button>
                </header>

                {/* Search Bar */}
                <div style={{ padding: '0 2rem' }} className="content-container">
                    <div style={{ background: 'white', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Search style={{ color: '#94a3b8', width: '20px' }} />
                        <input
                            type="text"
                            placeholder="Search by company name, email or serial no..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', color: '#0f172a' }}
                        />
                    </div>

                    {/* Profile List */}
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                        <table style={{ minWidth: '900px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Serial No</th>
                                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Company Details</th>
                                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Industry</th>
                                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Contact</th>
                                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Tax / GST</th>
                                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Team</th>
                                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProfiles.length > 0 ? filteredProfiles.map((p) => (
                                    <tr key={p.serialNo} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <span style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9', borderRadius: '6px', color: '#475569', fontWeight: 600, fontSize: '0.875rem' }}>#{p.serialNo}</span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.companyName}</div>
                                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{p.email}</div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ color: '#334155', fontWeight: 500 }}>{p.industry || 'Not Specified'}</div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ color: '#334155', fontWeight: 500 }}>{p.pointOfContact}</div>
                                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{p.contactNo}</div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ color: '#334155', fontSize: '0.875rem' }}>PAN: <span style={{ fontWeight: 600 }}>{p.taxNo || 'N/A'}</span></div>
                                            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>GST: <span style={{ fontWeight: 600 }}>{p.gstNo || 'N/A'}</span></div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <span style={{ padding: '0.25rem 0.75rem', background: '#eff6ff', borderRadius: '20px', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}>{p.teamSize}</span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <button
                                                    onClick={() => handleEdit(p)}
                                                    style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: '#475569', transition: 'all 0.2s' }}
                                                    title="Edit Profile"
                                                >
                                                    <FileText style={{ width: '18px' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p.serialNo)}
                                                    style={{ background: '#fef2f2', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', transition: 'all 0.2s' }}
                                                    title="Delete Profile"
                                                >
                                                    <Trash2 style={{ width: '18px' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                            <Building2 style={{ width: '48px', height: '48px', margin: '0 auto 1rem', opacity: 0.2 }} />
                                            <p>No business profiles found</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Add Profile Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="animate-scale-in" style={{ background: 'white', width: '100%', maxWidth: '700px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                                    {isEditing ? `Edit Profile #${editingSerial}` : 'Tell us about your business'}
                                </h2>
                                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                                    {isEditing ? 'Update your business information' : 'This helps us personalize your experience'}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ padding: '0.5rem', borderRadius: '8px', border: 'none', background: '#f1f5f9', cursor: 'pointer' }}><X style={{ width: '20px' }} /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1 }}>
                            <div style={{ padding: '2rem' }}>
                                {error && <div style={{ padding: '1rem', background: '#fef2f2', color: '#ef4444', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.875rem', border: '1px solid #fee2e2' }}>{error}</div>}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>1. Business Name*</label>
                                        <div style={{ position: 'relative' }}>
                                            <Building2 style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <input type="text" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', transition: 'border-color 0.2s' }} name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Official Name used across documents" required />
                                        </div>
                                    </div>

                                    <div style={{ gridColumn: 'span 1' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>2. Industry*</label>
                                        <div style={{ position: 'relative' }}>
                                            <Briefcase style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <input type="text" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="industry" value={formData.industry} onChange={handleChange} placeholder="e.g. Technology, Healthcare" required />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>2. Team Size*</label>
                                        <div style={{ position: 'relative' }}>
                                            <Users style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <select style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', appearance: 'none', background: 'white' }} name="teamSize" value={formData.teamSize} onChange={handleChange} required>
                                                <option value="">Select Team Size</option>
                                                {teamSizes.map(size => <option key={size} value={size}>{size}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>3. Point of Contact*</label>
                                        <div style={{ position: 'relative' }}>
                                            <User style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <input type="text" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="pointOfContact" value={formData.pointOfContact} onChange={handleChange} placeholder="Owner or Manager Name" required />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>4. Personal Mail Id*</label>
                                        <div style={{ position: 'relative' }}>
                                            <Mail style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <input type="email" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="email" value={formData.email} onChange={handleChange} placeholder="name@company.com" required />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>5. Phone Number*</label>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <img src="https://flagcdn.com/w20/in.png" alt="IN" style={{ width: '16px' }} />
                                                <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>+91</span>
                                            </div>
                                            <input type="text" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 4rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="contactNo" value={formData.contactNo} onChange={handleChange} placeholder="90420-19174" maxLength="10" required />
                                        </div>
                                    </div>

                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={{ height: '1px', background: '#f1f5f9', margin: '0.5rem 0' }}></div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>6. Country*</label>
                                        <select style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="country" value={formData.country} onChange={handleChange} required>
                                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>7. State*</label>
                                        <select style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="state" value={formData.state} onChange={handleChange} required>
                                            <option value="">Select State</option>
                                            {(statesByCountry[formData.country] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    {formData.state === 'Others' && (
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <input type="text" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="otherState" value={formData.otherState} onChange={handleChange} placeholder="Enter state name" required />
                                        </div>
                                    )}

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>8. City*</label>
                                        <select style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="city" value={formData.city} onChange={handleChange} required>
                                            <option value="">Select City</option>
                                            {(citiesByState[formData.state] || []).map(c => <option key={c} value={c}>{c}</option>)}
                                            {(!citiesByState[formData.state] || !citiesByState[formData.state].includes("Others")) && <option value="Others">Others</option>}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>9. Pincode*</label>
                                        <input type="text" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="pincode" value={formData.pincode} onChange={handleChange} placeholder="600001" maxLength="6" required />
                                    </div>

                                    {formData.city === 'Others' && (
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <input type="text" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="otherCity" value={formData.otherCity} onChange={handleChange} placeholder="Enter city name" required />
                                        </div>
                                    )}

                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>10. Address Line 1*</label>
                                        <input type="text" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="address1" value={formData.address1} onChange={handleChange} placeholder="Suite, floor, or street address" required />
                                    </div>

                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Address Line 2 (Optional)</label>
                                        <input type="text" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="address2" value={formData.address2} onChange={handleChange} placeholder="Apartment, building, or landmark" />
                                    </div>

                                    <div style={{ gridColumn: 'span 1' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>11. GST Number (Optional)</label>
                                        <div style={{ position: 'relative' }}>
                                            <Hash style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <input type="text" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="gstNo" value={formData.gstNo} onChange={handleChange} placeholder="e.g. 33AAACV1234F1Z5" maxLength="15" />
                                        </div>
                                    </div>

                                    <div style={{ gridColumn: 'span 1' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>12. Tax No / PAN (Optional)</label>
                                        <div style={{ position: 'relative' }}>
                                            <FileText style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <input type="text" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} name="taxNo" value={formData.taxNo} onChange={handleChange} placeholder="ABCDE1234F" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={loading} style={{ padding: '0.75rem 2rem', borderRadius: '12px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {loading ? (isEditing ? 'Updating...' : 'Processing...') : (isEditing ? 'Update Profile' : 'Save & Continue')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="animate-scale-in" style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ width: '5rem', height: '5rem', background: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', animation: 'success-pop 0.5s ease-out' }}>
                            <Check style={{ width: '2.5rem', height: '2.5rem', strokeWidth: 3 }} />
                        </div>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Welcome aboard!</h3>
                        <p style={{ color: '#64748b', fontSize: '1.125rem', marginBottom: '2rem' }}>
                            Profile created successfully.<br />
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>#{newProfileSerial}</span>
                        </p>
                        <button onClick={() => setShowSuccessModal(false)} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)' }}>Great!</button>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes success-pop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes scale-in {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        input:focus, select:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }
        @media (max-width: 1024px) {
            .main-content {
                padding-top: 60px;
            }
            .profiles-header {
                padding: 1.5rem !important;
            }
            .content-container {
                padding: 1rem !important;
            }
            .table-container {
                overflow-x: auto;
            }
            .table-container table {
                min-width: 800px; /* Ensure table content doesn't shrink too much */
            }
            .modal-content {
                max-width: 90vw !important;
            }
        }
        @media (max-width: 640px) {
            .add-profile-btn span {
                display: none;
            }
            .add-profile-btn {
                padding: 0.5rem 0.75rem !important;
            }
            .header-subtext {
                display: none;
            }
            form > div > div {
                grid-template-columns: 1fr !important;
            }
            .modal-content {
                border-radius: 16px !important;
            }
            .modal-content > div:first-child {
                padding: 1rem 1.5rem !important;
            }
            .modal-content form > div {
                padding: 1.5rem !important;
            }
            .modal-content form > div:last-child {
                padding: 1rem 1.5rem !important;
            }
        }
      `}</style>
        </div>
    );
};

export default Profiles;
