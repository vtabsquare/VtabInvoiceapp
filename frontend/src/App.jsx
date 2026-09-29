import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Profiles from './pages/Profiles';
import Invoices from './pages/Invoices';
import AddInvoice from './pages/AddInvoice';
import EditInvoice from './pages/EditInvoice';
import InvoicePreview from './pages/InvoicePreview';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
        <Route path="/profiles" element={<ProtectedRoute><Profiles /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
        <Route path="/add-invoice" element={<ProtectedRoute><AddInvoice /></ProtectedRoute>} />
        <Route path="/edit-invoice/:serialNo" element={<ProtectedRoute><EditInvoice /></ProtectedRoute>} />
        <Route path="/invoice/preview/:serialNo" element={<ProtectedRoute><InvoicePreview /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
