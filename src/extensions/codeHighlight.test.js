import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

let editor;
let element;
afterEach(() => { editor?.destroy(); element?.remove(); editor = null; element = null; });

const mount = html => {
    element = document.createElement('div');
    document.body.appendChild(element);
    editor = createEditor({ element, content: html });
};
const keywordsIn = pre => [...pre.querySelectorAll('[class*="hljs-keyword"]')].map(el => el.textContent);

describe('code highlighting after a change', () => {
    it('typing in one block highlights it anew and leaves the others highlighted', async () => {
        mount('<pre><code class="language-javascript">const a = 1;</code></pre><p>x</p><pre><code class="language-javascript">let b = 2;</code></pre>');
        await vi.waitFor(() => expect(element.querySelectorAll('pre [class*="hljs-keyword"]').length).toBe(2));
        let second = null;
        editor.state.doc.descendants((node, pos) => { if (node.type.name === 'codeBlock') second = pos; });
        editor.commands.insertContentAt(second + 1, 'return ');
        await vi.waitFor(() => expect(keywordsIn(element.querySelectorAll('pre')[1])).toEqual(['return', 'let']));
        expect(keywordsIn(element.querySelectorAll('pre')[0])).toEqual(['const']);
    });

    it('a block turned into a paragraph keeps no highlighting, and the others keep theirs', async () => {
        mount('<pre><code class="language-javascript">const a = 1;</code></pre><pre><code class="language-javascript">let b = 2;</code></pre>');
        await vi.waitFor(() => expect(element.querySelectorAll('pre [class*="hljs-keyword"]').length).toBe(2));
        editor.commands.setTextSelection(2);
        editor.commands.setParagraph();
        expect(element.querySelector('p [class*="hljs-"]')).toBeNull();
        expect(keywordsIn(element.querySelector('pre'))).toEqual(['let']);
    });

    it('code joined to a paragraph before it keeps no highlighting', async () => {
        mount('<p>hello</p><pre><code class="language-javascript">const a = 1; let b = 2;</code></pre>');
        await vi.waitFor(() => expect(element.querySelectorAll('pre [class*="hljs-"]').length).toBeGreaterThan(0));
        let inCode = null;
        editor.state.doc.descendants((node, pos) => { if (node.isText && node.text.startsWith('const')) inCode = pos + 14; });
        editor.commands.setTextSelection({ from: 4, to: inCode });
        editor.commands.deleteSelection();
        expect(element.querySelector('p').textContent).toContain('let b');
        expect(element.querySelector('p [class*="hljs-"]')).toBeNull();
    });
});
