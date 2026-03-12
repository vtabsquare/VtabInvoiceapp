import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Users, Plus, Search, Mail, Phone, MapPin, Building2, Globe, Hash, X, Check, FileText, ChevronRight, MoreVertical, Briefcase
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import API_BASE_URL from '../api';

const Clients = () => {
    const navigate = useNavigate();
    const adminEmail = localStorage.getItem('adminEmail') || 'Admin';

    const [clients, setClients] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [newClientSerial, setNewClientSerial] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingSerial, setEditingSerial] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '', industry: '', otherIndustry: '', email: '', contact: '',
        address1: '', address2: '', country: 'India', state: '', otherState: '',
        city: '', otherCity: '', pincode: '', taxNo: '', gstNo: ''
    });

    const industries = [
        "Apparel & Fashion", "Architecture & Planning", "Business Supplies & Equipment",
        "Computer Software", "Computer Hardware", "Education", "Entertainment", "FMCG",
        "Health, Wellness and Fitness", "Hospitality", "Import and Export", "IT & ITeS",
        "Legal Services", "Manufacture", "Marketing & Advertising", "Packaging & Containers",
        "Printing", "Pharmaceuticals", "Retail", "Tourism", "Others"
    ];

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
        "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar", "Others"],
        "Karnataka": ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Urban", "Bengaluru Rural", "Bidar", "Chamarajanagar", "Chikballapur", "Chikmagalur", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir", "Others"],
        "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal", "Others"],
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
        "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Others"],
        "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Others"],
        "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Others"],
        "Goa": ["Panaji", "Margao", "Vasco da Gama", "Others"],
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/clients`);
            setClients(res.data);
        } catch (err) {
            console.error("Error fetching clients:", err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if ((name === 'contact' || name === 'pincode') && value !== '' && !/^\d+$/.test(value)) return;
        if (name === 'contact' && value.length > 10) return;
        if (name === 'pincode' && value.length > 6) return;
        if (name === 'taxNo' && value.length > 10) return;
        if (name === 'gstNo' && value.length > 15) return;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const openAddModal = () => {
        setIsEditing(false);
        setEditingSerial(null);
        setFormData({
            name: '', industry: '', otherIndustry: '', email: '', contact: '',
            address1: '', address2: '', country: 'India', state: '', otherState: '',
            city: '', otherCity: '', pincode: '', taxNo: '', gstNo: ''
        });
        setError('');
        setShowModal(true);
    };

    const handleEdit = (client) => {
        setIsEditing(true);
        setEditingSerial(client.serialNo);

        // Match industry dropdown
        const isStandardIndustry = industries.includes(client.industry);

        // Match state dropdown
        const countryStates = statesByCountry[client.country || 'India'] || [];
        const isStandardState = countryStates.includes(client.state);

        // Match city dropdown
        const stateCities = citiesByState[client.state] || [];
        const isStandardCity = stateCities.includes(client.city);

        setFormData({
            name: client.name,
            industry: isStandardIndustry ? client.industry : 'Others',
            otherIndustry: isStandardIndustry ? '' : client.industry,
            email: client.email,
            contact: client.contact,
            address1: client.address1,
            address2: client.address2,
            country: client.country || 'India',
            state: isStandardState ? client.state : (client.state ? 'Others' : ''),
            otherState: isStandardState ? '' : client.state,
            city: isStandardCity ? client.city : (client.city ? 'Others' : ''),
            otherCity: isStandardCity ? '' : client.city,
            pincode: client.pincode,
            taxNo: client.taxNo || '',
            gstNo: client.gstNo || ''
        });
        setError('');
        setShowModal(true);
    };

    const handleDelete = async (serialNo) => {
        if (!window.confirm(`Are you sure you want to delete client #${serialNo}?`)) return;
        try {
            await axios.delete(`${API_BASE_URL}/clients/${serialNo}`);
            fetchClients();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete client');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (formData.contact.length !== 10) {
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
            industry: formData.industry === 'Others' ? formData.otherIndustry : formData.industry,
            state: formData.state === 'Others' ? formData.otherState : formData.state,
            city: formData.city === 'Others' ? formData.otherCity : formData.city
        };

        try {
            if (isEditing) {
                await axios.put(`${API_BASE_URL}/clients/${editingSerial}`, finalData);
                setShowModal(false);
                fetchClients();
                alert('Client updated successfully');
            } else {
                const response = await axios.post(`${API_BASE_URL}/clients`, finalData);
                setNewClientSerial(response.data.serialNo);
                setShowModal(false);
                setShowSuccessModal(true);
                fetchClients();
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to process request');
        } finally {
            setLoading(false);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.serialNo.includes(searchQuery)
    );

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
            <Sidebar />
            <main style={{ flex: 1, overflow: 'auto' }} className="animate-fade-in-up main-content">
                <header style={{ background: 'white', padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="clients-header">
                    <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#0f172a', margin: 0 }}>Client Management</h2>
                    <button onClick={openAddModal} style={{
                        background: '#2563eb', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
                        fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'
                    }} className="add-client-btn">
                        <Plus style={{ width: '1.125rem', height: '1.125rem' }} /> Add New Client
                    </button>
                </header>

                <div style={{ padding: '2rem' }} className="content-container">
                    <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '400px' }} className="search-container">
                        <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
                        <input
                            type="text" placeholder="Search clients by name or ID..."
                            style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem' }}
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                        <table style={{ minWidth: '800px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <tr>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Client Info</th>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Industry</th>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Contact</th>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Tax / GST</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map((client) => (
                                    <tr key={client.serialNo} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                                                    {client.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>{client.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>#{client.serialNo}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem', borderRadius: '1rem', background: '#f1f5f9', color: '#475569' }}>
                                                {client.industry}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ fontSize: '0.813rem', color: '#0f172a' }}>{client.email}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{client.contact}</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ fontSize: '0.813rem', color: '#334155' }}>PAN: <span style={{ fontWeight: 600 }}>{client.taxNo || 'N/A'}</span></div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>GST: <span style={{ fontWeight: 600 }}>{client.gstNo || 'N/A'}</span></div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => handleEdit(client)}
                                                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#2563eb', padding: '0.4rem', borderRadius: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                    title="Edit Client"
                                                >
                                                    <FileText style={{ width: '1rem', height: '1rem' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(client.serialNo)}
                                                    style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#e11d48', padding: '0.4rem', borderRadius: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                    title="Delete Client"
                                                >
                                                    <X style={{ width: '1rem', height: '1rem' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredClients.length === 0 && (
                            <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                <Users style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', opacity: 0.2 }} />
                                <p>No clients found. Click "Add New Client" to get started.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="animate-fade-in" style={{ background: 'white', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto', borderRadius: '1.25rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{isEditing ? `Edit Client #${editingSerial}` : 'Add New Client'}</h3>
                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>{isEditing ? 'Update client information.' : 'Fill in the details to register a new client.'}</p>
                                </div>
                                <button type="button" onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                    <X style={{ width: '1.125rem' }} />
                                </button>
                            </div>

                            <div style={{ padding: '2rem' }}>
                                {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>{error}</div>}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Briefcase style={{ width: '1rem', color: '#2563eb' }} /> Basic Information
                                        </h4>
                                    </div>
                                    <div className="input-group">
                                        <label className="label">Client Name*</label>
                                        <input type="text" className="input" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Acme Corp" required />
                                    </div>
                                    <div className="input-group">
                                        <label className="label">Client Industry*</label>
                                        <select className="input" name="industry" value={formData.industry} onChange={handleChange} required>
                                            <option value="">-Select an Industry-</option>
                                            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                        </select>
                                    </div>
                                    {formData.industry === 'Others' && (
                                        <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="label">Specify Industry*</label>
                                            <input type="text" className="input" name="otherIndustry" value={formData.otherIndustry} onChange={handleChange} placeholder="Please specify industry" required />
                                        </div>
                                    )}
                                    <div className="input-group">
                                        <label className="label">Client Mail Id*</label>
                                        <div style={{ position: 'relative' }}>
                                            <Mail style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <input type="email" className="input" style={{ paddingLeft: '2.5rem' }} name="email" value={formData.email} onChange={handleChange} placeholder="client@example.com" required />
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <label className="label">Contact No* (10 Digits)</label>
                                        <div style={{ position: 'relative' }}>
                                            <Phone style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <input type="text" className="input" style={{ paddingLeft: '2.5rem' }} name="contact" value={formData.contact} onChange={handleChange} placeholder="9876543210" maxLength="10" required />
                                        </div>
                                    </div>
                                    <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <MapPin style={{ width: '1rem', color: '#2563eb' }} /> Address Details
                                        </h4>
                                    </div>
                                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="label">Address Line 1*</label>
                                        <input type="text" className="input" name="address1" value={formData.address1} onChange={handleChange} placeholder="Street, Door No" required />
                                    </div>
                                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="label">Address Line 2*</label>
                                        <input type="text" className="input" name="address2" value={formData.address2} onChange={handleChange} placeholder="Area, Landmark" required />
                                    </div>
                                    <div className="input-group">
                                        <label className="label">Country*</label>
                                        <div style={{ position: 'relative' }}>
                                            <Globe style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                            <select className="input" style={{ paddingLeft: '2.5rem' }} name="country" value={formData.country} onChange={handleChange} required>
                                                {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <label className="label">State*</label>
                                        <select className="input" name="state" value={formData.state} onChange={handleChange} required>
                                            <option value="">-Select State-</option>
                                            {(statesByCountry[formData.country] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    {formData.state === 'Others' && (
                                        <div className="input-group">
                                            <label className="label">Specify State*</label>
                                            <input type="text" className="input" name="otherState" value={formData.otherState} onChange={handleChange} placeholder="Enter state name" required />
                                        </div>
                                    )}
                                    <div className="input-group">
                                        <label className="label">City*</label>
                                        <select className="input" name="city" value={formData.city} onChange={handleChange} required>
                                            <option value="">-Select City-</option>
                                            {(citiesByState[formData.state] || []).map(c => <option key={c} value={c}>{c}</option>)}
                                            {(!citiesByState[formData.state] || !citiesByState[formData.state].includes("Others")) && <option value="Others">Others</option>}
                                        </select>
                                    </div>
                                    {formData.city === 'Others' && (
                                        <div className="input-group">
                                            <label className="label">Specify City*</label>
                                            <input type="text" className="input" name="otherCity" value={formData.otherCity} onChange={handleChange} placeholder="Enter city name" required />
                                        </div>
                                    )}
                                    <div className="input-group">
                                        <label className="label">Pincode* (6 Digits)</label>
                                        <input type="text" className="input" name="pincode" value={formData.pincode} onChange={handleChange} placeholder="600001" maxLength="6" required />
                                    </div>
                                    <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Hash style={{ width: '1rem', color: '#2563eb' }} /> Tax Information*
                                        </h4>
                                    </div>
                                    <div className="input-group">
                                        <label className="label">Tax No (PAN)*</label>
                                        <input type="text" className="input" name="taxNo" value={formData.taxNo} onChange={handleChange} placeholder="e.g. CHEN12345A" maxLength="10" required />
                                    </div>
                                    <div className="input-group">
                                        <label className="label">GST No*</label>
                                        <input type="text" className="input" name="gstNo" value={formData.gstNo} onChange={handleChange} placeholder="e.g. 33AAACV1234F1Z5" maxLength="15" required />
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderRadius: '0 0 1.25rem 1.25rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={loading} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {loading ? (isEditing ? 'Updating...' : 'Adding...') : <><Check style={{ width: '1.125rem' }} /> {isEditing ? 'Update Client' : 'Create Client'}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showSuccessModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="animate-scale-in" style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '1.5rem', padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ width: '4rem', height: '4rem', background: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', animation: 'success-pop 0.5s ease-out' }}>
                            <Check style={{ width: '2rem', height: '2rem', strokeWidth: 3 }} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Success!</h3>
                        <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>Client registered successfully.<br /><span style={{ fontWeight: 600, color: '#0f172a' }}>Serial No: #{newClientSerial}</span></p>
                        <button onClick={() => setShowSuccessModal(false)} className="btn btn-primary" style={{ width: '100%', padding: '0.875rem', borderRadius: '0.75rem', fontSize: '1rem' }}>Done</button>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes success-pop { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
                .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes scale-in { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                
                @media (max-width: 1024px) {
                    .main-content {
                        padding-top: 60px;
                    }
                    .clients-header {
                        padding: 1rem !important;
                    }
                    .content-container {
                        padding: 1rem !important;
                    }
                }
                @media (max-width: 640px) {
                    .add-client-btn span {
                        display: none;
                    }
                    .add-client-btn {
                        padding: 0.5rem !important;
                    }
                    .search-container {
                        max-width: 100% !important;
                    }
                    .label {
                        font-size: 0.75rem !important;
                    }
                    .input {
                        padding: 0.5rem 0.75rem !important;
                        font-size: 0.813rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Clients;
