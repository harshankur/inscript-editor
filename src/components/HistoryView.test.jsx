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
        expect(onSelect).toHaveBeenCalledWith(0, history[0]);
    });
});

const at = (iso) => iso;
const kinded = [
    { id: 'a', kind: 'opened', html: '<h2>Heading</h2><p>Opened text</p>', title: '', tags: [], categories: [], timestamp: at('2026-09-25T10:00:00.000Z') },
    { id: 'b', kind: 'edited', html: '<p>Edited text</p>', title: '', tags: [], categories: [], timestamp: at('2026-09-25T10:01:00.000Z') },
    { id: 'c', kind: 'restored', restoredFrom: 'a', html: '<p>Opened text</p>', title: '', tags: [], categories: [], timestamp: at('2026-09-25T10:02:00.000Z') },
    { id: 'd', kind: 'external', html: '<p>From outside</p>', title: '', tags: [], categories: [], timestamp: at('2026-09-25T10:03:00.000Z') },
];

describe('HistoryView (kinds, empty state, references, previews)', () => {
    it('labels entries by kind, not position', () => {
        render(<HistoryView history={kinded} currentIndex={3} onSelect={() => {}} />);
        expect(screen.getByText('Opened')).toBeInTheDocument();
        expect(screen.getByText('Version 1')).toBeInTheDocument();
        expect(screen.getByText('Restored from Opened')).toBeInTheDocument();
        expect(screen.getByText('Changed outside the app')).toBeInTheDocument();
        expect(screen.queryByText('Original')).not.toBeInTheDocument();
    });

    it('shows an empty state with Restore disabled and no selection header', () => {
        render(<HistoryView history={[]} currentIndex={1} onSelect={vi.fn()} />);
        expect(screen.getByText('No versions yet. Versions are recorded as you edit.')).toBeInTheDocument();
        expect(screen.getByText('Restore Version').closest('button')).toBeDisabled();
        expect(screen.queryByText(/Selected Version/)).not.toBeInTheDocument();
    });

    it('never shows a selection outside the list after it shrinks', () => {
        const { rerender } = render(<HistoryView history={kinded} currentIndex={3} onSelect={() => {}} />);
        fireEvent.click(screen.getByText('Changed outside the app'));
        rerender(<HistoryView history={kinded.slice(0, 2)} currentIndex={1} onSelect={() => {}} />);
        expect(screen.getByText('Selected Version (Version 1)')).toBeInTheDocument();
        rerender(<HistoryView history={[]} currentIndex={-1} onSelect={() => {}} />);
        expect(screen.queryByText(/Selected Version/)).not.toBeInTheDocument();
    });

    it('disables Restore for the active version and enables it for another', () => {
        const onSelect = vi.fn();
        render(<HistoryView history={kinded} currentIndex={1} onSelect={onSelect} />);
        const restore = screen.getByText('Restore Version').closest('button');
        expect(restore).toBeDisabled();
        fireEvent.click(screen.getByText('Opened'));
        expect(restore).not.toBeDisabled();
        fireEvent.click(restore);
        expect(onSelect).toHaveBeenCalledWith(0, kinded[0]);
    });

    it('uses the first version as the reference when no original is given', () => {
        const { container } = render(<HistoryView history={kinded} currentIndex={1} onSelect={() => {}} />);
        const reference = container.querySelector('[data-history-preview="reference"]');
        expect(reference.textContent).toContain('Opened text');
        // Styled by the editor's own content rules.
        expect(reference.classList.contains('ProseMirror')).toBe(true);
        expect(reference.querySelector('h2')).not.toBeNull();
    });

    it('hides the Title/Tags/Categories rows when no entry carries metadata', () => {
        render(<HistoryView history={kinded} currentIndex={1} onSelect={() => {}} />);
        expect(screen.queryByText('Title')).not.toBeInTheDocument();
    });

    it('keeps the metadata rows when entries carry metadata', () => {
        render(<HistoryView history={history} currentIndex={1} onSelect={() => {}} />);
        expect(screen.getAllByText('Title').length).toBeGreaterThan(0);
    });

    it('renders inert previews: no iframe, no scripts or handlers, embeds as placeholders', () => {
        const withEmbed = [
            { ...kinded[0], html: '<div data-youtube-video="dQw4w9WgXcQ" class="youtube-embed"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div><p onclick="alert(1)">x</p><a href="javascript:alert(1)">l</a><script>alert(1)</script>' },
            kinded[1],
        ];
        const { container } = render(<HistoryView history={withEmbed} currentIndex={1} onSelect={() => {}} />);
        fireEvent.click(screen.getByText('Opened'));
        expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('[onclick]')).toBeNull();
        expect(container.querySelector('a[href^="javascript"]')).toBeNull();
        expect(screen.getAllByText('Embedded content: www.youtube.com').length).toBe(2);
    });

    it('shows relative times with the full date (to the second) on hover', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-25T10:05:00.000Z'));
        try {
            const { container } = render(<HistoryView history={kinded} currentIndex={3} onSelect={() => {}} />);
            const times = Array.from(container.querySelectorAll('time'));
            expect(times.map(el => el.textContent)).toEqual(['5 minutes ago', '4 minutes ago', '3 minutes ago', '2 minutes ago']);
            expect(times[0].getAttribute('title')).toMatch(/:00/);
            expect(times[0].getAttribute('datetime')).toBe(kinded[0].timestamp);
        } finally {
            vi.useRealTimers();
        }
    });
});
