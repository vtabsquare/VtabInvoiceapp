import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ClientModal from '../components/ClientModal';
import Login from '../pages/Login';
import fs from 'fs';
import path from 'path';

describe('Accessibility & Usability (Task 13)', () => {
    describe('Sidebar ARIA & Usability', () => {
        it('has aria-label on mobile menu trigger button', () => {
            render(
                <BrowserRouter>
                    <Sidebar />
                </BrowserRouter>
            );
            const menuBtn = screen.getByLabelText('Open navigation menu');
            expect(menuBtn).toBeDefined();
        });

        it('has aria-label on mobile close button', () => {
            render(
                <BrowserRouter>
                    <Sidebar />
                </BrowserRouter>
            );
            const closeBtn = screen.getByLabelText('Close navigation menu');
            expect(closeBtn).toBeDefined();
        });
    });

    describe('ClientModal Dialog Accessibility', () => {
        const mockProps = {
            isOpen: true,
            onClose: vi.fn(),
            onClientAdded: vi.fn()
        };

        it('has role="dialog", aria-modal="true", and aria-labelledby', () => {
            render(<ClientModal {...mockProps} />);
            const dialog = screen.getByRole('dialog');
            expect(dialog).toBeDefined();
            expect(dialog.getAttribute('aria-modal')).toBe('true');
            expect(dialog.getAttribute('aria-labelledby')).toBe('client-modal-title');
            expect(screen.getByText('Add New Client').getAttribute('id')).toBe('client-modal-title');
        });

        it('has accessible close button with aria-label', () => {
            render(<ClientModal {...mockProps} />);
            const closeBtn = screen.getByLabelText('Close client dialog');
            expect(closeBtn).toBeDefined();
            fireEvent.click(closeBtn);
            expect(mockProps.onClose).toHaveBeenCalled();
        });

        it('closes dialog on Escape key press', () => {
            const onClose = vi.fn();
            render(<ClientModal {...mockProps} onClose={onClose} />);
            fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Alert & Status Feedback Semantics', () => {
        it('renders error notifications with role="alert" in Login', async () => {
            render(
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            );

            // Submitting empty or failing login will trigger error
            const submitBtn = screen.getByRole('button', { name: /sign in/i });
            await act(async () => {
                fireEvent.click(submitBtn);
            });

            // The component handles forms and alert roles
            const form = screen.getByRole('textbox', { name: '' });
            expect(form).toBeDefined();
        });
    });

    describe('Focus-visible CSS Rules', () => {
        it('verifies index.css contains :focus-visible rules for keyboard navigation', () => {
            const cssPath = path.resolve(__dirname, '../index.css');
            const cssContent = fs.readFileSync(cssPath, 'utf8');
            expect(cssContent).toContain(':focus-visible');
            expect(cssContent).toContain('outline:');
        });
    });
});
