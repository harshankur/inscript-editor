import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryView } from './HistoryView.jsx';

const history = [
    { html: '<p>Original text</p>', title: 'Original Title', tags: ['t1'], categories: ['c1'], timestamp: '2024-01-01T00:00:00.000Z', isOriginal: true },
    { html: '<p>Original text edited</p>', title: 'New Title', tags: ['t1', 't2'], categories: ['c1'], timestamp: '2024-01-02T00:00:00.000Z' },
];

describe('HistoryView', () => {
    it('lists Original and numbered versions in the sidebar', () => {
        render(
            <HistoryView
                history={history}
                originalHtml={history[0].html}
                originalTitle={history[0].title}
                originalTags={history[0].tags}
                originalCategories={history[0].categories}
                current={history[1].html}
                currentIndex={1}
                onSelect={() => {}}
            />
        );
        expect(screen.getByText('Original')).toBeInTheDocument();
        expect(screen.getByText('Version 1')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows a word-level diff of the title and content in text mode', () => {
        render(
            <HistoryView
                history={history}
                originalHtml={history[0].html}
                originalTitle={history[0].title}
                originalTags={history[0].tags}
                originalCategories={history[0].categories}
                current={history[1].html}
                currentIndex={1}
                onSelect={() => {}}
            />
        );

        fireEvent.click(screen.getByText('Version 1'));
        fireEvent.click(screen.getByText('Text'));

        // "edited" was added to the compare version's content.
        expect(screen.getByText('edited')).toBeInTheDocument();
    });

    it('renders visual HTML previews of both sides in visual mode', () => {
        render(
            <HistoryView
                history={history}
                originalHtml={history[0].html}
                originalTitle={history[0].title}
                originalTags={history[0].tags}
                originalCategories={history[0].categories}
                current={history[1].html}
                currentIndex={1}
                onSelect={() => {}}
            />
        );
        expect(screen.getAllByText('Original text', { exact: false }).length).toBeGreaterThan(0);
        expect(screen.getByText('Original text edited')).toBeInTheDocument();
    });

    it('calls onSelect with the selected version index when Restore Version is clicked', () => {
        const onSelect = vi.fn();
        render(
            <HistoryView
                history={history}
                originalHtml={history[0].html}
                originalTitle={history[0].title}
                originalTags={history[0].tags}
                originalCategories={history[0].categories}
                current={history[1].html}
                currentIndex={1}
                onSelect={onSelect}
            />
        );

        fireEvent.click(screen.getByText('Original'));
        fireEvent.click(screen.getByText('Restore Version'));
        expect(onSelect).toHaveBeenCalledWith(0);
    });
});
