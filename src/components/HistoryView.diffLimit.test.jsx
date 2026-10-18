import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryView } from './HistoryView.jsx';

// A comparison that runs out of time: jsdiff returns nothing past its timeout.
const diffCalls = vi.hoisted(() => []);
vi.mock('diff', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        diffLines: (a, b, options) => { diffCalls.push(options); return undefined; },
        diffWords: (a, b, options) => {
            diffCalls.push(options);
            return a.includes('long') ? undefined : actual.diffWords(a, b, options);
        },
    };
});

const history = [
    { id: 'a', kind: 'opened', html: '<p>long version one</p>', title: 'T', tags: [], categories: [], timestamp: '2026-01-01T00:00:00Z' },
    { id: 'b', kind: 'edited', html: '<p>long version two</p>', title: 'T', tags: [], categories: [], timestamp: '2026-01-01T00:01:00Z' },
];

describe('HistoryView comparison limit', () => {
    it('limits the comparison time and shows both versions plainly when it runs out', () => {
        render(<HistoryView history={history} originalHtml={history[0].html} currentIndex={1} onSelect={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Text' }));
        expect(diffCalls.some(options => options?.timeout === 500)).toBe(true);
        expect(screen.getByRole('note').textContent).toBe('These versions differ too much to compare here; both are shown as they are.');
        expect(screen.getByText('long version one')).toBeInTheDocument();
        expect(screen.getByText('long version two')).toBeInTheDocument();
        expect(screen.getByText('long version one').getAttribute('style')).toBeNull();
    });

    it('does the same for the source comparison', () => {
        render(<HistoryView history={history} originalHtml={history[0].html} currentIndex={1} onSelect={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Source' }));
        expect(screen.getByRole('note')).toBeInTheDocument();
        expect(screen.getByText('<p>long version two</p>')).toBeInTheDocument();
    });
});
