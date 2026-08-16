import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('Mermaid extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { mermaid: true });
    });

    afterEach(() => {
        if (editor) {
            editor.destroy();
        }
    });

    it('parses a mermaid div correctly', () => {
        editor.commands.setContent('<div class="mermaid">graph TD; A-->B;</div>');
        const json = editor.getJSON();
        const mermaidNode = json.content[0];

        expect(mermaidNode.type).toBe('mermaid');
        expect(mermaidNode.attrs.code).toBe('graph TD; A-->B;');
    });

    it('renders HTML correctly with class and code', () => {
        editor.commands.setContent('<div class="mermaid">graph TD; A-->B;</div>');
        const html = editor.getHTML();

        expect(html).toContain('class="mermaid"');
        expect(html).toContain('data-mermaid="graph TD; A-->B;"');
        expect(html).toContain('graph TD; A--&gt;B;');
    });

    it('inserts a mermaid node via insertMermaid command', () => {
        editor.commands.insertContent({ type: 'mermaid', attrs: { code: 'A-->B' } });
        const json = editor.getJSON();

        expect(json.content[0].type).toBe('mermaid');
        expect(json.content[0].attrs.code).toBe('A-->B');
    });

    // --- officeParser 7.6.0 contract alignment ---

    it('parses officeParser default pre > code.language-mermaid as a mermaid node', () => {
        editor.commands.setContent('<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>');
        const node = editor.getJSON().content[0];
        expect(node.type).toBe('mermaid');
        expect(node.attrs.code).toContain('graph TD');
    });

    it('does not emit a stray raw code attribute', () => {
        editor.commands.setContent('<div class="mermaid" data-mermaid="graph TD; A-->B;"></div>');
        const html = editor.getHTML();
        expect(html).not.toMatch(/\scode=/);
        expect(html).toContain('data-mermaid=');
    });
});
