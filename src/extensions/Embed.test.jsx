import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

const YT_ID = 'dQw4w9WgXcQ';

describe('Embed extension', () => {
    let editor;
    beforeEach(() => { editor = createEditor(); });        // embed is on by default
    afterEach(() => { if (editor) editor.destroy(); });

    it('parses the officeParser gated-embed shape', () => {
        editor.commands.setContent('<div data-embed-src="https://maps.example.com/x" data-embed-gated="true"></div>');
        const node = editor.state.doc.firstChild;
        expect(node.type.name).toBe('embed');
        expect(node.attrs.src).toBe('https://maps.example.com/x');
    });

    it('claims a non-YouTube iframe (previously silently dropped)', () => {
        editor.commands.setContent('<iframe src="https://codepen.io/foo/embed/bar"></iframe>');
        const node = editor.state.doc.firstChild;
        expect(node.type.name).toBe('embed');
        expect(node.attrs.src).toBe('https://codepen.io/foo/embed/bar');
    });

    it('does NOT claim a YouTube iframe — the Youtube node wins by priority', () => {
        editor.commands.setContent(`<iframe src="https://www.youtube.com/embed/${YT_ID}"></iframe>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
    });

    it('serializes to the gated shape, never a raw iframe', () => {
        editor.commands.setContent('<iframe src="https://example.com/embed/x"></iframe>');
        const html = editor.getHTML();
        expect(html).toContain('data-embed-src="https://example.com/embed/x"');
        expect(html).toContain('data-embed-gated="true"');
        expect(html).not.toContain('<iframe');
    });

    it('round-trips a non-YouTube iframe instead of dropping it', () => {
        editor.commands.setContent('<iframe src="https://example.com/embed/x"></iframe>');
        const html1 = editor.getHTML();
        editor.commands.setContent(html1);
        expect(editor.state.doc.firstChild.type.name).toBe('embed');
        expect(editor.state.doc.firstChild.attrs.src).toBe('https://example.com/embed/x');
    });

    it('inserts an embed via the insertEmbed command', () => {
        editor.commands.insertEmbed('https://example.com/e');
        expect(editor.state.doc.firstChild.type.name).toBe('embed');
        expect(editor.state.doc.firstChild.attrs.src).toBe('https://example.com/e');
    });

    it('round-trips a data-embed-label caption', () => {
        editor.commands.setContent('<div data-embed-src="https://x.com/e" data-embed-gated="true" data-embed-label="My CodePen"></div>');
        expect(editor.state.doc.firstChild.attrs.label).toBe('My CodePen');
        expect(editor.getHTML()).toContain('data-embed-label="My CodePen"');
    });

    it('omits data-embed-label when there is no caption', () => {
        editor.commands.setContent('<div data-embed-src="https://x.com/e" data-embed-gated="true"></div>');
        expect(editor.state.doc.firstChild.attrs.label).toBe(null);
        expect(editor.getHTML()).not.toContain('data-embed-label');
    });

    it('can be disabled via options.embed === false (iframe then dropped)', () => {
        const e = createEditor({}, { embed: false });
        e.commands.setContent('<p>x</p><iframe src="https://example.com/embed/x"></iframe>');
        e.state.doc.descendants(node => expect(node.type.name).not.toBe('embed'));
        e.destroy();
    });
});
