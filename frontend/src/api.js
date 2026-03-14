const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
    (isLocal 
        ? 'http://localhost:5000/api/admin' 
        : 'https://vtab-invoice-backend.onrender.com/api/admin');

export default API_BASE_URL;
