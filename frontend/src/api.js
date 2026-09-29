import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/admin';

// Attach Bearer token to all outgoing requests automatically
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Handle expired or invalid tokens globally and normalize user-safe error messages
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Do not redirect on failed login attempt itself
            const isLoginRequest = error.config && error.config.url && error.config.url.endsWith('/login');
            if (!isLoginRequest) {
                localStorage.removeItem('token');
                localStorage.removeItem('adminEmail');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
        }

        // Normalize safe user message for UI presentations
        if (!error.response) {
            error.userMessage = "Network error. Please check your connection and try again.";
        } else if (error.response.status >= 500) {
            error.userMessage = error.response.data?.message || "Something went wrong on the server. Please try again.";
        } else if (error.response.data && typeof error.response.data === 'object' && error.response.data.message) {
            error.userMessage = error.response.data.message;
        } else {
            error.userMessage = "Something went wrong. Please try again.";
        }

        return Promise.reject(error);
    }
);

export default API_BASE_URL;
