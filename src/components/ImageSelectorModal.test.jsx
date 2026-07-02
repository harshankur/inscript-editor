import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImageSelectorModal } from './ImageSelectorModal.jsx';

const IMAGES = [
    { url: 'https://example.com/cat.png', name: 'cat' },
    { url: 'https://example.com/dog.png', name: 'dog' },
];

describe('ImageSelectorModal', () => {
    it('renders nothing when closed', () => {
        const { container } = render(<ImageSelectorModal isOpen={false} onClose={() => {}} images={[]} onSelect={() => {}} onUpload={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders images and filters by search', async () => {
        const user = userEvent.setup();
        render(<ImageSelectorModal isOpen onClose={() => {}} images={IMAGES} onSelect={() => {}} onUpload={() => {}} />);

        expect(screen.getByAltText('cat')).toBeInTheDocument();
        expect(screen.getByAltText('dog')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('Search images...'), 'cat');

        expect(screen.getByAltText('cat')).toBeInTheDocument();
        expect(screen.queryByAltText('dog')).not.toBeInTheDocument();
    });

    it('selecting an image fires onSelect with its url', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(<ImageSelectorModal isOpen onClose={() => {}} images={IMAGES} onSelect={onSelect} onUpload={() => {}} />);

        await user.click(screen.getByAltText('cat'));
        expect(onSelect).toHaveBeenCalledWith('https://example.com/cat.png');
    });

    it('shows an uploading spinner while onUpload is pending', async () => {
        const user = userEvent.setup();
        let resolveUpload;
        const onUpload = vi.fn(() => new Promise((resolve) => { resolveUpload = resolve; }));
        render(<ImageSelectorModal isOpen onClose={() => {}} images={IMAGES} onSelect={() => {}} onUpload={onUpload} />);

        const file = new File(['data'], 'photo.png', { type: 'image/png' });
        const input = document.querySelector('input[type="file"]');
        await user.upload(input, file);

        expect(input).toBeDisabled();
        resolveUpload();
        await waitFor(() => expect(input).not.toBeDisabled());
    });

    it('shows an error notice when onUpload rejects', async () => {
        const user = userEvent.setup();
        const onUpload = vi.fn().mockRejectedValue(new Error('network down'));
        render(<ImageSelectorModal isOpen onClose={() => {}} images={IMAGES} onSelect={() => {}} onUpload={onUpload} />);

        const file = new File(['data'], 'photo.png', { type: 'image/png' });
        const input = document.querySelector('input[type="file"]');
        await user.upload(input, file);

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        expect(screen.getByRole('alert')).toHaveTextContent('Upload failed');
    });

    it('shows the empty-state message when no images match', async () => {
        const user = userEvent.setup();
        render(<ImageSelectorModal isOpen onClose={() => {}} images={IMAGES} onSelect={() => {}} onUpload={() => {}} />);
        await user.type(screen.getByPlaceholderText('Search images...'), 'nonexistent');
        expect(screen.getByText('No images found')).toBeInTheDocument();
    });
});
