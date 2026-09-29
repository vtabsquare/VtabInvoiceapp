import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Root Component', () => {
    it('renders the application and redirects to the login route by default', () => {
        render(<App />);
        expect(screen.getByText('VTAB Square')).toBeDefined();
        expect(screen.getByText('Invoice Management System')).toBeDefined();
    });
});
