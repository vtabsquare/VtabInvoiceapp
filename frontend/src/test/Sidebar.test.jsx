import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

describe('Sidebar Navigation Component', () => {
    const renderSidebar = () => {
        return render(
            <BrowserRouter>
                <Sidebar />
            </BrowserRouter>
        );
    };

    it('renders the brand title', () => {
        renderSidebar();
        expect(screen.getByText('VTAB Square')).toBeDefined();
    });

    it('renders all main navigation options', () => {
        renderSidebar();
        expect(screen.getByText('Dashboard')).toBeDefined();
        expect(screen.getByText('Client')).toBeDefined();
        expect(screen.getByText('Profile')).toBeDefined();
        expect(screen.getByText('Invoice')).toBeDefined();
    });

    it('renders the logout action button and clears authentication on logout', () => {
        localStorage.setItem('token', 'sample-jwt-token');
        localStorage.setItem('adminEmail', 'admin@vtab.com');

        renderSidebar();
        const logoutBtn = screen.getByText('Logout');
        expect(logoutBtn).toBeDefined();

        act(() => {
            fireEvent.click(logoutBtn);
        });

        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('adminEmail')).toBeNull();
    });
});
