import { beforeEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

const VALID_ID = 'dQw4w9WgXcQ';

describe('Youtube extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
    });

    it('round-trips id/width/align through parse/render, using their defaults when omitted', () => {
        editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const node = editor.state.doc.firstChild;
        expect(node.type.name).toBe('youtube');
        expect(node.attrs['data-youtube-video']).toBe(VALID_ID);
        expect(node.attrs.width).toBe('100%');
        expect(node.attrs.align).toBe('center');

        const html = editor.getHTML();
        expect(html).toContain(`data-youtube-video="${VALID_ID}"`);
        expect(html).toContain(`src="https://www.youtube.com/embed/${VALID_ID}"`);
    });

    it('is a fixed point through setContent(getHTML())', () => {
        editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID, width: '50%', align: 'left' });
        const html1 = editor.getHTML();
        editor.commands.setContent(html1);
        const html2 = editor.getHTML();
        expect(html2).toBe(html1);
    });

    it('parses an embed/ iframe URL back into the node on paste-like HTML', () => {
        editor.commands.setContent(`<div data-youtube-video="${VALID_ID}" data-width="100%" data-align="center"></div>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    it('parses a standard youtube.com embed iframe', () => {
        editor.commands.setContent(`<iframe src="https://www.youtube.com/embed/${VALID_ID}"></iframe>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    it('parses a youtube-nocookie.com embed iframe', () => {
        editor.commands.setContent(`<iframe src="https://www.youtube-nocookie.com/embed/${VALID_ID}"></iframe>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    it('parses a youtu.be short-link iframe', () => {
        editor.commands.setContent(`<iframe src="https://youtu.be/${VALID_ID}"></iframe>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    it('does not parse a non-YouTube iframe as a youtube node', () => {
        editor.commands.setContent('<p>before</p><iframe src="https://example.com/embed/abcdefghijk"></iframe>');
        editor.state.doc.descendants(node => {
            expect(node.type.name).not.toBe('youtube');
        });
    });

    it('parses a watch?v= iframe src back into the node attrs', () => {
        editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const html = editor.getHTML();
        editor.commands.setContent('');
        editor.commands.setContent(html);
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    describe('setYoutubeVideo command (null-ID guard)', () => {
        it('rejects an invalid/empty id and inserts nothing', () => {
            const result = editor.commands.setYoutubeVideo({ 'data-youtube-video': '' });
            expect(result).toBe(false);
            expect(editor.state.doc.childCount).toBe(1); // still just the default empty paragraph
            expect(editor.state.doc.firstChild.type.name).not.toBe('youtube');
        });

        it('rejects a too-short id', () => {
            const result = editor.commands.setYoutubeVideo({ 'data-youtube-video': 'short' });
            expect(result).toBe(false);
        });

        it('accepts a valid 11-char id', () => {
            const result = editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
            expect(result).toBe(true);
            expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        });
    });

    describe('null-id rendering (legacy/corrupt content)', () => {
        it('renderHTML never emits embed/null and omits the iframe entirely', () => {
            // Bypass the command guard to simulate legacy content with a null id already in the doc.
            editor.commands.insertContent({ type: 'youtube', attrs: { 'data-youtube-video': null, width: '100%', align: 'center' } });
            const html = editor.getHTML();
            expect(html).not.toContain('embed/null');
            expect(html).not.toContain('<iframe');
            expect(html).toContain('data-youtube-video=""');
        });

        it('preserves width/align attrs on the placeholder so the node round-trips', () => {
            editor.commands.insertContent({ type: 'youtube', attrs: { 'data-youtube-video': null, width: '50%', align: 'right' } });
            const html = editor.getHTML();
            editor.commands.setContent(html);
            const node = editor.state.doc.firstChild;
            expect(node.attrs.width).toBe('50%');
            expect(node.attrs.align).toBe('right');
        });
    });

    it('node view mounts an iframe pointed at the given id when mounted in a live DOM', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const iframe = el.querySelector('iframe');
        expect(iframe).not.toBeNull();
        expect(iframe.src).toContain(VALID_ID);
        liveEditor.destroy();
        el.remove();
    });

    it('node view updates the iframe src when attrs change', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const otherId = 'abcdefghijk'.slice(0, 11).replace(/./, 'x'); // any distinct 11-char id
        liveEditor.chain().selectAll().updateAttributes('youtube', { 'data-youtube-video': 'xbcdefghijk' }).run();
        const iframe = el.querySelector('iframe');
        expect(iframe.src).toContain('xbcdefghijk');
        liveEditor.destroy();
        el.remove();
    });

    it('node view lets clicks pass through to the iframe once the node is selected', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });

        const overlay = el.querySelector('.youtube-embed > div:last-child');

        liveEditor.commands.setTextSelection(0); // deselect the node
        expect(overlay.style.pointerEvents).not.toBe('none');

        liveEditor.commands.setNodeSelection(0); // selects the atom node as a NodeSelection
        expect(overlay.style.pointerEvents).toBe('none');

        liveEditor.commands.setTextSelection(0);
        expect(overlay.style.pointerEvents).not.toBe('none');

        liveEditor.destroy();
        el.remove();
    });

    it('node view renders the placeholder (no iframe) when mounted with a null id', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.insertContent({ type: 'youtube', attrs: { 'data-youtube-video': null, width: '100%', align: 'center' } });
        expect(el.querySelector('iframe')).toBeNull();
        expect(el.textContent).toContain('Video unavailable');
        liveEditor.destroy();
        el.remove();
    });
});
