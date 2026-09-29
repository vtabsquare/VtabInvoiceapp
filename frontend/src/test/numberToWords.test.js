import { describe, it, expect } from 'vitest';
import { numberToWords } from '../utils/numberToWords';

describe('numberToWords Utility', () => {
    it('converts single digit and small numbers', () => {
        const result = numberToWords(5);
        expect(result).toContain('Five');
        expect(result).toContain('Only');
    });

    it('converts hundreds correctly', () => {
        const result = numberToWords(500);
        expect(result).toContain('Five Hundred');
        expect(result).toContain('Only');
    });

    it('converts thousands in Indian numbering system', () => {
        const result = numberToWords(15000);
        expect(result).toContain('Fifteen Thousand');
        expect(result).toContain('Only');
    });

    it('converts Lakhs correctly', () => {
        const result = numberToWords(150000);
        expect(result).toContain('One Lakh Fifty Thousand');
        expect(result).toContain('Only');
    });

    it('converts Crores correctly', () => {
        const result = numberToWords(10000000);
        expect(result).toContain('One Crore');
        expect(result).toContain('Only');
    });

    it('handles overflow for numbers exceeding 9 digits', () => {
        expect(numberToWords(10000000000)).toBe('overflow');
    });
});
