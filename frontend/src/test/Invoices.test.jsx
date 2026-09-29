import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import Invoices from '../pages/Invoices';

vi.mock('axios');

describe('Invoices Page Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the Invoices page header and search input', async () => {
        axios.get.mockResolvedValueOnce({
            data: [
                {
                    serialNo: '00001',
                    invoiceNo: 'INV-001',
                    clientName: 'Sample Client Pvt Ltd',
                    profileName: 'VTAB Square',
                    invoiceDate: '2026-03-01',
                    dueDate: '2026-03-15',
                    total: 50000,
                    invoiceStatus: 'Pending',
                    gstStatus: 'Not Filed',
                    accountsStatus: 'Fund Pending'
                }
            ]
        });

        render(
            <BrowserRouter>
                <Invoices />
            </BrowserRouter>
        );

        // Header check
        expect(screen.getByRole('heading', { level: 1, name: /Invoice/i })).toBeDefined();

        // Search bar
        const searchInput = screen.getByPlaceholderText(/Search by invoice no/i);
        expect(searchInput).toBeDefined();

        // Add invoice button
        expect(screen.getByText(/Add New Invoice/i)).toBeDefined();

        // Wait for mocked row data
        await waitFor(() => {
            expect(screen.getByText('Sample Client Pvt Ltd')).toBeDefined();
            expect(screen.getByText('INV-001')).toBeDefined();
        });
    });

    it('displays empty state when no invoices are returned', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });

        render(
            <BrowserRouter>
                <Invoices />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/No invoices found/i)).toBeDefined();
        });
    });

    it('renders Archived invoice and status option correctly', async () => {
        axios.get.mockResolvedValueOnce({
            data: [
                {
                    serialNo: '00002',
                    invoiceNo: 'INV-002-ARCHIVED',
                    clientName: 'Archived Client Ltd',
                    profileName: 'VTAB Square',
                    invoiceDate: '2026-01-01',
                    dueDate: '2026-01-15',
                    total: 75000,
                    invoiceStatus: 'Archived',
                    gstStatus: 'Filed',
                    accountsStatus: 'Fund Received'
                }
            ]
        });

        render(
            <BrowserRouter>
                <Invoices />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('INV-002-ARCHIVED')).toBeDefined();
            expect(screen.getByText('Archived Client Ltd')).toBeDefined();
        });

        // Verify select dropdown has Archived option
        const options = screen.getAllByRole('option');
        const archivedOption = options.find(opt => opt.value === 'Archived');
        expect(archivedOption).toBeDefined();
        expect(archivedOption.textContent).toBe('Archived');
    });
});
