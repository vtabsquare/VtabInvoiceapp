import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

describe('ProtectedRoute Component', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    const TestApp = ({ initialEntries = ['/dashboard'] }) => (
        <MemoryRouter initialEntries={initialEntries}>
            <Routes>
                <Route path="/login" element={<div>Login Page Mock</div>} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <div>Protected Dashboard Content</div>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </MemoryRouter>
    );

    it('redirects unauthenticated user (no token) to /login', () => {
        render(<TestApp />);
        expect(screen.queryByText('Protected Dashboard Content')).toBeNull();
        expect(screen.getByText('Login Page Mock')).toBeDefined();
    });

    it('renders protected child component when token is present in localStorage', () => {
        localStorage.setItem('token', 'fake-jwt-token-xyz');
        render(<TestApp />);
        expect(screen.getByText('Protected Dashboard Content')).toBeDefined();
        expect(screen.queryByText('Login Page Mock')).toBeNull();
    });

    it('redirects to /login when token is removed from localStorage (logout scenario)', () => {
        localStorage.setItem('token', 'fake-jwt-token-xyz');
        const { rerender } = render(<TestApp />);
        expect(screen.getByText('Protected Dashboard Content')).toBeDefined();

        // Simulate logout by removing token and re-rendering
        localStorage.removeItem('token');
        rerender(<TestApp />);
        // When rendered without token, redirected to login
        expect(screen.getByText('Login Page Mock')).toBeDefined();
    });
});
