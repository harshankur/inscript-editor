import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('Wikilink extension', () => {
    let editor;
    let mockResolver;

    beforeEach(() => {
        mockResolver = vi.fn((target) => ({ exists: true, href: `/wiki/${target}`, onNavigate: null }));
        editor = createEditor({}, { 
            wikilink: { 
                enabled: true,
                resolver: mockResolver
            }
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('parses a wikilink correctly', () => {
        editor.commands.setContent('<p><a data-wikilink="true" data-target="HomePage">HomePage</a></p>');
        const json = editor.getJSON();
        const wikilink = json.content[0].content[0];

        expect(wikilink.type).toBe('wikilink');
        expect(wikilink.attrs.target).toBe('HomePage');
        expect(wikilink.attrs.alias).toBe(null);
    });

    it('parses a wikilink with an alias correctly', () => {
        editor.commands.setContent('<p><a data-wikilink="true" data-target="HomePage" data-alias="Home">Home</a></p>');
        const json = editor.getJSON();
        const wikilink = json.content[0].content[0];

        expect(wikilink.attrs.target).toBe('HomePage');
        expect(wikilink.attrs.alias).toBe('Home');
    });

    it('renders HTML correctly', () => {
        editor.commands.setContent('<p>Check out <a data-wikilink="true" data-target="HomePage" data-alias="Home">Home</a></p>');
        
        const html = editor.getHTML();
        expect(html).toContain('data-wikilink="true"');
        expect(html).toContain('data-target="HomePage"');
        expect(html).toContain('data-alias="Home"');
    });

    it('inserts a wikilink via insertWikilink command', () => {
        editor.commands.setContent('<p>See </p>');
        editor.commands.focus('end');
        editor.commands.insertWikilink({ target: 'Settings', alias: 'Config' });
        
        const json = editor.getJSON();
        const insertedNode = json.content[0].content[1];
        
        expect(insertedNode.type).toBe('wikilink');
        expect(insertedNode.attrs.target).toBe('Settings');
        expect(insertedNode.attrs.alias).toBe('Config');
    });

    // --- officeParser 7.6.0 contract alignment ---

    it('accepts a bare data-wikilink (not only "true") and falls back to anchor text for the alias', () => {
        editor.commands.setContent('<p><a data-wikilink="" data-target="HomePage">Welcome Home</a></p>');
        const node = editor.getJSON().content[0].content[0];
        expect(node.type).toBe('wikilink');
        expect(node.attrs.target).toBe('HomePage');
        expect(node.attrs.alias).toBe('Welcome Home');
    });

    it('does not set an alias when anchor text equals the target', () => {
        editor.commands.setContent('<p><a data-wikilink="1" data-target="HomePage">HomePage</a></p>');
        const node = editor.getJSON().content[0].content[0];
        expect(node.attrs.alias).toBe(null);
    });

    it('omits data-alias when there is no alias', () => {
        editor.commands.setContent('<p>x</p>');
        editor.commands.focus('end');
        editor.commands.insertWikilink({ target: 'Page' });
        expect(editor.getHTML()).not.toContain('data-alias=""');
    });
});
