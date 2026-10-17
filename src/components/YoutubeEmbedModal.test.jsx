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

    it('renders the translated experimental notice with its bold "Direct Link" (Trans)', async () => {
        render(<YoutubeEmbedModal isOpen onSearch={async () => []} onClose={() => {}} onConfirm={() => {}} />);
        await user.click(screen.getByText('Search YouTube (Experimental)'));
        // en.json maps the <strong> child to <1>…</1>; the notice must keep it bold.
        const bold = screen.getByText('Direct Link', { selector: 'strong' });
        expect(bold.parentElement.textContent).toMatch(/^External search uses public proxy instances which can be unreliable\. If search fails, please use the Direct Link tab instead\.$/);
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

    describe('live preview consent', () => {
        const PRIVACY_URL = 'https://example.com/datenschutz#video';
        const typeId = id => user.type(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), id);
        const consent = () => document.querySelector('[data-youtube-consent]');

        it('asks for consent instead of loading the preview as soon as an ID is typed', async () => {
            render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            expect(screen.queryByTitle('Preview')).toBeNull();
            expect(document.querySelector('iframe')).toBeNull();
            expect(consent().textContent).toContain('YouTube video');
            expect(consent().textContent).toContain('Playing this video loads it from YouTube. YouTube (Google) then receives data such as your IP address and may set cookies.');
            expect(screen.getByRole('button', { name: 'Load preview' })).toBeInTheDocument();
            // Insert does not need the preview.
            expect(screen.getByRole('button', { name: 'Insert Video' })).toBeEnabled();
        });

        it('loads the preview from www.youtube.com on the first press of "Load preview"', async () => {
            render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            await user.click(screen.getByRole('button', { name: 'Load preview' }));
            expect(screen.getByTitle('Preview').getAttribute('src'))
                .toBe(`https://www.youtube.com/embed/${VALID_ID}?controls=0&modestbranding=1`);
            expect(consent()).toBeNull();
            // Focus moves from the button (now gone) to the player.
            expect(document.activeElement).toBe(screen.getByTitle('Preview'));
        });

        it('loads the preview from the keyboard (Enter on the focused button)', async () => {
            render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            screen.getByRole('button', { name: 'Load preview' }).focus();
            await user.keyboard('{Enter}');
            expect(screen.getByTitle('Preview')).toBeInTheDocument();
        });

        it('asks again for a different video', async () => {
            render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
            const input = screen.getByPlaceholderText('https://youtube.com/watch?v=...');
            await typeId(VALID_ID);
            await user.click(screen.getByRole('button', { name: 'Load preview' }));
            await user.clear(input);
            await user.type(input, 'xbcdefghijk');
            expect(screen.queryByTitle('Preview')).toBeNull();
            expect(consent()).not.toBeNull();
        });

        it('asks again after the modal is closed and reopened', async () => {
            const { rerender } = render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            await user.click(screen.getByRole('button', { name: 'Load preview' }));
            rerender(<YoutubeEmbedModal isOpen={false} onClose={() => {}} onConfirm={() => {}} />);
            rerender(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            expect(screen.queryByTitle('Preview')).toBeNull();
        });

        it('has no privacy link without privacyUrl', async () => {
            render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            expect(consent().querySelector('a')).toBeNull();
        });

        it('links privacyUrl in a new tab, with rel="noopener"', async () => {
            render(<YoutubeEmbedModal isOpen privacyUrl={PRIVACY_URL} onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            const link = screen.getByRole('link', { name: 'Privacy notice' });
            expect(link.getAttribute('href')).toBe(PRIVACY_URL);
            expect(link.getAttribute('target')).toBe('_blank');
            expect(link.getAttribute('rel')).toBe('noopener');
        });

        it('opens the privacy link through onOpenExternal, the latest one given', async () => {
            const first = vi.fn();
            const latest = vi.fn();
            const { rerender } = render(<YoutubeEmbedModal isOpen privacyUrl={PRIVACY_URL} onOpenExternal={first} onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            rerender(<YoutubeEmbedModal isOpen privacyUrl={PRIVACY_URL} onOpenExternal={latest} onClose={() => {}} onConfirm={() => {}} />);
            await user.click(screen.getByRole('link', { name: 'Privacy notice' }));
            expect(latest).toHaveBeenCalledWith(PRIVACY_URL);
            expect(first).not.toHaveBeenCalled();
        });

        it('takes no nocookie prop: one passed anyway still previews from www.youtube.com', async () => {
            render(<YoutubeEmbedModal isOpen nocookie onClose={() => {}} onConfirm={() => {}} />);
            await typeId(VALID_ID);
            await user.click(screen.getByRole('button', { name: 'Load preview' }));
            expect(screen.getByTitle('Preview').getAttribute('src')).toMatch(/^https:\/\/www\.youtube\.com\/embed\//);
        });
    });

    describe('search tab', () => {
        it('is not offered without onSearch: there is only the link field', () => {
            render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
            expect(screen.queryByRole('button', { name: 'Search YouTube (Experimental)' })).toBeNull();
            expect(screen.queryByRole('button', { name: 'Direct Link' })).toBeNull();
            expect(screen.getByText('Paste a link to embed')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('https://youtube.com/watch?v=...')).toBeInTheDocument();
        });

        it('is offered with onSearch', () => {
            render(<YoutubeEmbedModal isOpen onSearch={async () => []} onClose={() => {}} onConfirm={() => {}} />);
            expect(screen.getByRole('button', { name: 'Search YouTube (Experimental)' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Direct Link' })).toBeInTheDocument();
            expect(screen.getByText('Search or paste a link to embed')).toBeInTheDocument();
        });
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
