import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../../tests/helpers/createEditor.js';
import { TextBubbleMenu } from './TextBubbleMenu.jsx';
import { ImageBubbleMenu } from './ImageBubbleMenu.jsx';
import { YoutubeBubbleMenu } from './YoutubeBubbleMenu.jsx';
import { TableBubbleMenu } from './TableBubbleMenu.jsx';
import { EmbedBubbleMenu } from './EmbedBubbleMenu.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div data-testid="bubble-menu">{children}</div>,
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

describe('bubble menus', () => {
    let editor;

    afterEach(() => {
        editor?.destroy();
    });

    describe('TextBubbleMenu', () => {
        beforeEach(() => {
            editor = createEditor();
            editor.commands.setContent('<p>hello</p>');
            editor.commands.selectAll();
        });

        it('renders null without an editor', () => {
            const { container } = render(<TextBubbleMenu editor={null} />);
            expect(container).toBeEmptyDOMElement();
        });

        it('toggles bold/italic on the current selection', () => {
            render(<TextBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Bold'));
            expect(editor.isActive('bold')).toBe(true);
            fireEvent.click(screen.getByTitle('Italic'));
            expect(editor.isActive('italic')).toBe(true);
        });

        it('toggles inline code on the selection (not a code block)', () => {
            render(<TextBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Inline Code'));
            expect(editor.isActive('code')).toBe(true);
            expect(editor.getHTML()).toContain('<code>hello</code>');
            expect(editor.getHTML()).not.toContain('<pre>');
        });

        it('clears formatting via the Clear Formatting button', () => {
            editor.chain().focus().selectAll().toggleBold().run();
            expect(editor.isActive('bold')).toBe(true);
            render(<TextBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Clear Formatting'));
            expect(editor.isActive('bold')).toBe(false);
        });
    });

    describe('ImageBubbleMenu', () => {
        beforeEach(() => {
            editor = createEditor();
            editor.commands.setImage({ src: 'https://example.com/a.png' });
            editor.commands.selectAll();
        });

        it('sets the image width via the width buttons', () => {
            render(<ImageBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByText('50%'));
            expect(editor.getAttributes('image').width).toBe('50%');
        });

        it('sets alignment via the align buttons', () => {
            render(<ImageBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Align Right'));
            expect(editor.getAttributes('image').align).toBe('right');
        });

        it('shows the image src and replaces it', () => {
            render(<ImageBubbleMenu editor={editor} />);
            const input = screen.getByLabelText('Image URL');
            expect(input.value).toBe('https://example.com/a.png');
            fireEvent.change(input, { target: { value: 'https://example.com/b.png' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(editor.getAttributes('image').src).toBe('https://example.com/b.png');
        });

        it('edits the alt text', () => {
            render(<ImageBubbleMenu editor={editor} />);
            const input = screen.getByLabelText('Alt text');
            fireEvent.change(input, { target: { value: 'A photo' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(editor.getAttributes('image').alt).toBe('A photo');
        });

        it('deletes the image via the delete button', () => {
            render(<ImageBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Delete image'));
            expect(editor.state.doc.textContent).toBe('');
            expect(editor.getHTML()).not.toContain('<img');
        });
    });

    describe('YoutubeBubbleMenu', () => {
        beforeEach(() => {
            editor = createEditor();
            editor.commands.setYoutubeVideo({ 'data-youtube-video': 'dQw4w9WgXcQ' });
            editor.commands.selectAll();
        });

        it('sets the video width via the width buttons', () => {
            render(<YoutubeBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByText('25%'));
            expect(editor.getAttributes('youtube').width).toBe('25%');
        });

        it('shows the video URL and replaces it from a pasted link', () => {
            render(<YoutubeBubbleMenu editor={editor} />);
            const input = screen.getByLabelText('Video URL');
            expect(input.value).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            fireEvent.change(input, { target: { value: 'https://youtu.be/abcdefghijk' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(editor.getAttributes('youtube')['data-youtube-video']).toBe('abcdefghijk');
        });

        it('ignores an invalid URL (keeps the current video)', () => {
            render(<YoutubeBubbleMenu editor={editor} />);
            const input = screen.getByLabelText('Video URL');
            fireEvent.change(input, { target: { value: 'not a youtube link' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(editor.getAttributes('youtube')['data-youtube-video']).toBe('dQw4w9WgXcQ');
        });

        it('opens the video on YouTube in a new tab', () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
            render(<YoutubeBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Open in YouTube'));
            expect(openSpy).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank', 'noopener,noreferrer');
            openSpy.mockRestore();
        });

        it('routes "Open in YouTube" through onOpenExternal when the host provides it', () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
            const onOpenExternal = vi.fn();
            render(<YoutubeBubbleMenu editor={editor} onOpenExternal={onOpenExternal} />);
            fireEvent.click(screen.getByTitle('Open in YouTube'));
            expect(onOpenExternal).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(openSpy).not.toHaveBeenCalled();
            openSpy.mockRestore();
        });

        it('deletes the video via the delete button', () => {
            render(<YoutubeBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Delete video'));
            expect(editor.state.doc.firstChild.type.name).not.toBe('youtube');
        });
    });

    describe('EmbedBubbleMenu', () => {
        beforeEach(() => {
            editor = createEditor();
            editor.commands.insertEmbed('https://example.com/widget');
            editor.commands.selectAll();
        });

        it('shows the embed src and replaces it', () => {
            render(<EmbedBubbleMenu editor={editor} />);
            const input = screen.getByLabelText('Embed URL');
            expect(input.value).toBe('https://example.com/widget');
            fireEvent.change(input, { target: { value: 'https://example.com/other' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(editor.getAttributes('embed').src).toBe('https://example.com/other');
        });

        it('opens the embed source in a new tab (window.open fallback)', () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
            render(<EmbedBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Open in new tab'));
            expect(openSpy).toHaveBeenCalledWith('https://example.com/widget', '_blank', 'noopener,noreferrer');
            openSpy.mockRestore();
        });

        it('routes the embed open through onOpenExternal when the host provides it', () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
            const onOpenExternal = vi.fn();
            render(<EmbedBubbleMenu editor={editor} onOpenExternal={onOpenExternal} />);
            fireEvent.click(screen.getByTitle('Open in new tab'));
            expect(onOpenExternal).toHaveBeenCalledWith('https://example.com/widget');
            expect(openSpy).not.toHaveBeenCalled();
            openSpy.mockRestore();
        });

        it('deletes the embed via the delete button', () => {
            render(<EmbedBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Delete embed'));
            expect(editor.state.doc.firstChild.type.name).not.toBe('embed');
        });
    });

    describe('TableBubbleMenu', () => {
        beforeEach(() => {
            editor = createEditor();
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
        });

        it('adds a column via Add Column Right', () => {
            let cols = 0;
            editor.state.doc.firstChild.firstChild.forEach(() => { cols++; });
            render(<TableBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Add Column Right'));
            let colsAfter = 0;
            editor.state.doc.firstChild.firstChild.forEach(() => { colsAfter++; });
            expect(colsAfter).toBe(cols + 1);
        });

        it('deletes the table via Delete Table', () => {
            render(<TableBubbleMenu editor={editor} />);
            fireEvent.click(screen.getByTitle('Delete Table'));
            expect(editor.state.doc.firstChild.type.name).not.toBe('table');
        });
    });
});
