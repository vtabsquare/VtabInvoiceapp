import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import Clients from '../pages/Clients';

vi.mock('axios');

describe('Clients Page Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the Clients page header, search input, and add client button', async () => {
        axios.get.mockResolvedValueOnce({
            data: [
                {
                    serialNo: '00001',
                    name: 'Acme Corp',
                    industry: 'IT & ITeS',
                    email: 'contact@acme.com',
                    contact: '9876543210',
                    city: 'Chennai',
                    state: 'Tamil Nadu',
                    country: 'India',
                    pincode: '600001',
                    taxNo: 'AAACA1234A',
                    gstNo: '33AAACA1234A1Z5'
                }
            ]
        });

        render(
            <BrowserRouter>
                <Clients />
            </BrowserRouter>
        );

        // Header and Add Client button
        expect(screen.getByRole('heading', { level: 2, name: 'Client' })).toBeDefined();
        const addBtn = screen.getByRole('button', { name: /Add New Client/i });
        expect(addBtn).toBeDefined();

        // Search bar with exact placeholder
        const searchInput = screen.getByPlaceholderText(/Search clients by name or ID/i);
        expect(searchInput).toBeDefined();

        // Wait for mocked row data
        await waitFor(() => {
            expect(screen.getByText('Acme Corp')).toBeDefined();
            expect(screen.getByText('contact@acme.com')).toBeDefined();
        });
    });
});
