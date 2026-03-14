import React, { useState } from 'react';
import axios from 'axios';
import {
    X, Check, Mail, Phone, MapPin, Globe, Hash, Briefcase
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api/admin';

const ClientModal = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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

    const handleChange = (e) => {
        const { name, value } = e.target;
        if ((name === 'contact' || name === 'pincode') && value !== '' && !/^\d+$/.test(value)) return;
        if (name === 'contact' && value.length > 10) return;
        if (name === 'pincode' && value.length > 6) return;
        if (name === 'taxNo' && value.length > 10) return;
        if (name === 'gstNo' && value.length > 15) return;
        setFormData(prev => ({ ...prev, [name]: value }));
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
            const response = await axios.post(`${API_BASE_URL}/clients`, finalData);
            onSuccess(response.data);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to process request');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: 'white', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto', borderRadius: '1.25rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <form onSubmit={handleSubmit}>
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Add New Client</h3>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>Fill in the details to register a new client.</p>
                        </div>
                        <button type="button" onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
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
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Client Name*</label>
                                <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Acme Corp" required />
                            </div>
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Client Industry*</label>
                                <select style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="industry" value={formData.industry} onChange={handleChange} required>
                                    <option value="">-Select an Industry-</option>
                                    {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                </select>
                            </div>
                            {formData.industry === 'Others' && (
                                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Specify Industry*</label>
                                    <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="otherIndustry" value={formData.otherIndustry} onChange={handleChange} placeholder="Please specify industry" required />
                                </div>
                            )}
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Client Mail Id*</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                    <input type="email" style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="email" value={formData.email} onChange={handleChange} placeholder="client@example.com" required />
                                </div>
                            </div>
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Contact No* (10 Digits)</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                    <input type="text" style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="contact" value={formData.contact} onChange={handleChange} placeholder="9876543210" maxLength="10" required />
                                </div>
                            </div>
                            <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MapPin style={{ width: '1rem', color: '#2563eb' }} /> Address Details
                                </h4>
                            </div>
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Address Line 1*</label>
                                <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="address1" value={formData.address1} onChange={handleChange} placeholder="Street, Door No" required />
                            </div>
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Address Line 2*</label>
                                <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="address2" value={formData.address2} onChange={handleChange} placeholder="Area, Landmark" required />
                            </div>
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Country*</label>
                                <div style={{ position: 'relative' }}>
                                    <Globe style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', color: '#94a3b8' }} />
                                    <select style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="country" value={formData.country} onChange={handleChange} required>
                                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>State*</label>
                                <select style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="state" value={formData.state} onChange={handleChange} required>
                                    <option value="">-Select State-</option>
                                    {(statesByCountry[formData.country] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            {formData.state === 'Others' && (
                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Specify State*</label>
                                    <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="otherState" value={formData.otherState} onChange={handleChange} placeholder="Enter state name" required />
                                </div>
                            )}
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>City*</label>
                                <select style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="city" value={formData.city} onChange={handleChange} required>
                                    <option value="">-Select City-</option>
                                    {(citiesByState[formData.state] || []).map(c => <option key={c} value={c}>{c}</option>)}
                                    {(!citiesByState[formData.state] || !citiesByState[formData.state].includes("Others")) && <option value="Others">Others</option>}
                                </select>
                            </div>
                            {formData.city === 'Others' && (
                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Specify City*</label>
                                    <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="otherCity" value={formData.otherCity} onChange={handleChange} placeholder="Enter city name" required />
                                </div>
                            )}
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Pincode* (6 Digits)</label>
                                <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="pincode" value={formData.pincode} onChange={handleChange} placeholder="600001" maxLength="6" required />
                            </div>
                            <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Hash style={{ width: '1rem', color: '#2563eb' }} /> Tax Information*
                                </h4>
                            </div>
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Tax No (PAN)*</label>
                                <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="taxNo" value={formData.taxNo} onChange={handleChange} placeholder="e.g. CHEN12345A" maxLength="10" required />
                            </div>
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>GST No*</label>
                                <input type="text" style={{ width: '100%', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} name="gstNo" value={formData.gstNo} onChange={handleChange} placeholder="e.g. 33AAACV1234F1Z5" maxLength="15" required />
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderRadius: '0 0 1.25rem 1.25rem' }}>
                        <button type="button" onClick={onClose} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={loading} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {loading ? 'Adding...' : <><Check style={{ width: '1.125rem' }} /> Create Client</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClientModal;
