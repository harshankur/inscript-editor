import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { ADMONITION_TYPES, resolveAdmonitionType } from './Admonition.jsx';

describe('Admonition extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { admonition: true });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('parses admonition HTML correctly', () => {
        const html = '<div class="admonition admonition-tip" data-type="tip"><p>Be careful</p></div>';
        editor.commands.setContent(html);
        
        const json = editor.getJSON();
        const admonitionNode = json.content[0];

        expect(admonitionNode.type).toBe('admonition');
        expect(admonitionNode.attrs.admonitionType).toBe('tip');
        expect(admonitionNode.content[0].type).toBe('paragraph');
        expect(admonitionNode.content[0].content[0].text).toBe('Be careful');
    });

    it('renders HTML correctly with correct class and data attribute', () => {
        editor.commands.setContent('<p>Hello</p>');
        editor.commands.selectAll();
        editor.commands.setAdmonition('warning');

        const html = editor.getHTML();
        expect(html).toContain('data-type="warning"');
        expect(html).toContain('class="admonition admonition-warning"');
        expect(html).toContain('Hello');
    });

    it('removes admonition when content is cleared or toggled out', () => {
        editor.commands.setContent('<p>Test content</p>');
        editor.commands.selectAll();
        editor.commands.setAdmonition('important');
        expect(editor.getJSON().content[0].type).toBe('admonition');
    });

    it('accepts only the known types (the type becomes a class name)', () => {
        editor.commands.setContent('<div class="admonition" data-type="note fixed inset-0 z-50"><p>x</p></div>');
        expect(editor.state.doc.firstChild.attrs.admonitionType).toBe('note');
        expect(editor.getHTML()).toContain('class="admonition admonition-note"');
        editor.commands.setContent({ type: 'doc', content: [{ type: 'admonition', attrs: { admonitionType: 'tip hidden' }, content: [{ type: 'paragraph' }] }] });
        expect(editor.getHTML()).toContain('class="admonition admonition-note"');
    });

    it.each(ADMONITION_TYPES)('keeps the %s type', (type) => {
        editor.commands.setContent(`<div class="admonition" data-type="${type}"><p>x</p></div>`);
        expect(editor.state.doc.firstChild.attrs.admonitionType).toBe(type);
    });

    it('changes the type when set inside an admonition, instead of nesting another', () => {
        editor.commands.setContent('<div class="admonition" data-type="tip"><p>Inside</p></div>');
        editor.commands.setTextSelection(3);
        editor.commands.setAdmonition('warning');
        const json = editor.getJSON();
        expect(json.content[0]).toMatchObject({ type: 'admonition', attrs: { admonitionType: 'warning' } });
        expect(json.content[0].content[0].type).toBe('paragraph');
    });

    it('resolves unknown types to the default', () => {
        expect(resolveAdmonitionType('caution')).toBe('caution');
        expect(resolveAdmonitionType('nope')).toBe('note');
        expect(resolveAdmonitionType(undefined)).toBe('note');
    });
});
