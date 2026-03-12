import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Profiles from './pages/Profiles';
import Invoices from './pages/Invoices';
import AddInvoice from './pages/AddInvoice';
import EditInvoice from './pages/EditInvoice';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/add-invoice" element={<AddInvoice />} />
        <Route path="/edit-invoice/:serialNo" element={<EditInvoice />} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
