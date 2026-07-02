import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YoutubeEmbedModal } from './YoutubeEmbedModal.jsx';

const VALID_ID = 'dQw4w9WgXcQ';

describe('YoutubeEmbedModal', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders nothing when closed', () => {
        const { container } = render(<YoutubeEmbedModal isOpen={false} onClose={() => {}} onConfirm={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('previews a valid URL and confirms with the extracted id', async () => {
        const onConfirm = vi.fn();
        render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={onConfirm} />);

        await user.type(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), `https://youtube.com/watch?v=${VALID_ID}`);

        const insertButton = screen.getByRole('button', { name: 'Insert Video' });
        expect(insertButton).toBeEnabled();
        await user.click(insertButton);
        expect(onConfirm).toHaveBeenCalledWith(VALID_ID);
    });

    it('disables Insert and shows a warning notice for a non-YouTube 11-char URL', async () => {
        render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);

        await user.type(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), 'https://example.com/abcdefghijk');

        expect(screen.getByRole('button', { name: 'Insert Video' })).toBeDisabled();
        expect(screen.getByText(/No valid YouTube ID detected/i)).toBeInTheDocument();
    });

    it('keeps Insert disabled with empty input and shows no notice yet', () => {
        render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
        expect(screen.getByRole('button', { name: 'Insert Video' })).toBeDisabled();
        expect(screen.queryByText(/No valid YouTube ID detected/i)).not.toBeInTheDocument();
    });

    it('search flow: renders results and confirms the clicked video\'s id', async () => {
        const onConfirm = vi.fn();
        const onSearch = vi.fn().mockResolvedValue([
            { url: `https://youtube.com/watch?v=${VALID_ID}`, title: 'A video', thumbnail: 'x.jpg', uploaderName: 'Someone', views: 100 },
        ]);
        render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={onConfirm} onSearch={onSearch} />);

        await user.click(screen.getByRole('button', { name: 'Search YouTube (Experimental)' }));
        await user.type(screen.getByPlaceholderText('Search for videos...'), 'rick astley');
        fireEvent.submit(screen.getByPlaceholderText('Search for videos...').closest('form'));

        await waitFor(() => expect(screen.getByText('A video')).toBeInTheDocument());
        await user.click(screen.getByText('A video'));
        expect(onConfirm).toHaveBeenCalledWith(VALID_ID);
    });

    it('search flow: shows an error notice (not console.error) when the search rejects', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const onSearch = vi.fn().mockRejectedValue(new Error('proxy down'));
        render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} onSearch={onSearch} />);

        await user.click(screen.getByRole('button', { name: 'Search YouTube (Experimental)' }));
        await user.type(screen.getByPlaceholderText('Search for videos...'), 'rick astley');
        fireEvent.submit(screen.getByPlaceholderText('Search for videos...').closest('form'));

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        expect(screen.getByRole('alert')).toHaveTextContent('Search Failed');
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('YouTube Search Failed'), expect.anything());
    });

    it('resets state when closed and reopened', async () => {
        const { rerender } = render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
        await user.type(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), VALID_ID);
        expect(screen.getByText(/Detected ID/)).toBeInTheDocument();

        rerender(<YoutubeEmbedModal isOpen={false} onClose={() => {}} onConfirm={() => {}} />);
        rerender(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);

        expect(screen.getByPlaceholderText('https://youtube.com/watch?v=...')).toHaveValue('');
        expect(screen.queryByText(/Detected ID/)).not.toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', async () => {
        const onClose = vi.fn();
        render(<YoutubeEmbedModal isOpen onClose={onClose} onConfirm={() => {}} />);
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
