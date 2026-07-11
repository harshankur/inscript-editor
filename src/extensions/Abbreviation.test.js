import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('Abbreviation extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { abbreviation: true });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('parses <abbr title="..."> correctly', () => {
        editor.commands.setContent('<p>This is <abbr title="HyperText Markup Language">HTML</abbr>.</p>');
        const json = editor.getJSON();
        const paragraph = json.content[0];
        const textNode = paragraph.content[1];

        expect(textNode.type).toBe('text');
        expect(textNode.text).toBe('HTML');
        expect(textNode.marks[0].type).toBe('abbreviation');
        expect(textNode.marks[0].attrs.title).toBe('HyperText Markup Language');
    });

    it('renders HTML correctly', () => {
        editor.commands.setContent('<p>This is <abbr title="HyperText Markup Language">HTML</abbr>.</p>');
        expect(editor.getHTML()).toContain('<abbr title="HyperText Markup Language">HTML</abbr>');
    });

    it('applies abbreviation mark via setAbbreviation command', () => {
        editor.commands.setContent('<p>HTML</p>');
        editor.commands.selectAll();
        editor.commands.setAbbreviation('HyperText Markup Language');

        expect(editor.getHTML()).toContain('<abbr title="HyperText Markup Language">HTML</abbr>');
    });

    it('toggles abbreviation mark via toggleAbbreviation command', () => {
        editor.commands.setContent('<p>HTML</p>');
        editor.commands.selectAll();
        
        // Toggle on
        editor.commands.toggleAbbreviation('HyperText Markup Language');
        expect(editor.getHTML()).toContain('<abbr title="HyperText Markup Language">HTML</abbr>');

        // Toggle off
        editor.commands.toggleAbbreviation('HyperText Markup Language');
        expect(editor.getHTML()).not.toContain('<abbr');
    });

    it('removes abbreviation via unsetAbbreviation', () => {
        editor.commands.setContent('<p><abbr title="Test">HTML</abbr></p>');
        editor.commands.selectAll();
        editor.commands.unsetAbbreviation();
        
        expect(editor.getHTML()).not.toContain('<abbr');
    });
});
