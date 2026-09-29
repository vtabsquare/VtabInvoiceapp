import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login';

describe('Login UI Component', () => {
    const renderLogin = () => {
        return render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
    };

    it('renders the branding and application title', () => {
        renderLogin();
        expect(screen.getByText('VTAB Square')).toBeDefined();
        expect(screen.getByText('Invoice Management System')).toBeDefined();
    });

    it('renders email and password input fields and submit button', () => {
        renderLogin();
        const emailInput = screen.getByPlaceholderText('admin@vtab.com');
        const passwordInput = screen.getByPlaceholderText('••••••••');
        const signInButton = screen.getByRole('button', { name: /Sign In/i });

        expect(emailInput).toBeDefined();
        expect(passwordInput).toBeDefined();
        expect(signInButton).toBeDefined();
    });

    it('updates input values when typed into', () => {
        renderLogin();
        const emailInput = screen.getByPlaceholderText('admin@vtab.com');
        const passwordInput = screen.getByPlaceholderText('••••••••');

        fireEvent.change(emailInput, { target: { value: 'test@vtab.com' } });
        fireEvent.change(passwordInput, { target: { value: 'secret123' } });

        expect(emailInput.value).toBe('test@vtab.com');
        expect(passwordInput.value).toBe('secret123');
    });

    it('renders the Forgot Password button and toggles view', () => {
        renderLogin();
        const forgotButton = screen.getByText('Forgot Password?');
        expect(forgotButton).toBeDefined();

        fireEvent.click(forgotButton);
        expect(screen.getByText('Back to Login')).toBeDefined();
    });

    it('toggles password visibility when show/hide button is clicked', () => {
        renderLogin();
        const passwordInput = screen.getByPlaceholderText('••••••••');
        const toggleButton = screen.getByRole('button', { name: /Show password/i });

        expect(passwordInput.type).toBe('password');
        expect(toggleButton).toBeDefined();

        fireEvent.click(toggleButton);
        expect(passwordInput.type).toBe('text');
        expect(screen.getByRole('button', { name: /Hide password/i })).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: /Hide password/i }));
        expect(passwordInput.type).toBe('password');
    });
});
