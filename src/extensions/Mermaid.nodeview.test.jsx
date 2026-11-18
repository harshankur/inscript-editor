import { afterEach, describe, expect, it } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { EditorContent } from '@tiptap/react';
import { createEditor } from '../../tests/helpers/createEditor.js';

let editor;
afterEach(() => { cleanup(); editor?.destroy(); editor = null; });

describe('Mermaid node view', () => {
    it('shows a diagram\'s source while Mermaid loads, and "Empty Mermaid diagram" only for empty code', async () => {
        editor = createEditor({ content: { type: 'doc', content: [
            { type: 'mermaid', attrs: { code: 'graph TD; A-->B' } },
            { type: 'mermaid', attrs: { code: '' } },
        ] } });
        const { container } = render(<EditorContent editor={editor} />);
        await waitFor(() => {
            const [diagram, empty] = container.querySelectorAll('.mermaid-render');
            expect(diagram.textContent).toBe('graph TD; A-->B');
            expect(diagram.querySelector('[aria-busy="true"]')).not.toBeNull();
            expect(empty.textContent).toBe('Empty Mermaid diagram');
        });
    });
});
