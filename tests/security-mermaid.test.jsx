// A document's Mermaid diagram is drawn strict whatever the page's Mermaid configuration says, and
// that configuration is put back after (Mermaid itself is mocked: it does not draw in jsdom).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const calls = [];
let pageConfig = { securityLevel: 'loose', theme: 'dark', themeVariables: { background: '#000' } };
vi.mock('mermaid', () => ({
    default: {
        initialize: config => { calls.push({ ...config }); pageConfig = { ...config }; },
        render: async () => {
            calls.push({ rendered: pageConfig.securityLevel });
            return { svg: '<svg></svg>' };
        },
        mermaidAPI: { getConfig: () => ({ ...pageConfig }), getSiteConfig: () => ({ ...pageConfig }) },
    },
}));

const { createEditor } = await import('./helpers/createEditor.js');
const { EditorContent } = await import('@tiptap/react');

let editor;
afterEach(() => { editor?.destroy(); editor = null; });

describe('Mermaid diagrams', () => {
    it('are drawn strict under a page configured loose, and the page\'s configuration comes back', async () => {
        editor = createEditor({ content: '<div class="mermaid">graph TD; A-->B</div>' });
        render(<EditorContent editor={editor} />);
        await vi.waitFor(() => expect(calls.some(call => 'rendered' in call)).toBe(true));
        expect(calls.find(call => 'rendered' in call).rendered).toBe('strict');
        await vi.waitFor(() => expect(pageConfig.securityLevel).toBe('loose'));
        expect(pageConfig.theme).toBe('dark');
        // Drawn with Mermaid's own defaults, never the page's theme colours.
        const drawnWith = calls.find(call => call.securityLevel === 'strict');
        expect(drawnWith.theme).toBe('default');
        expect(drawnWith.themeVariables).toBeUndefined();
        // Drawn in a shadow root of its own.
        const container = document.querySelector('.mermaid-render > div > div');
        await vi.waitFor(() => expect(container?.shadowRoot?.querySelector('svg')).toBeTruthy());
    });
});

describe('Mermaid configuration', () => {
    it('the page\'s own configuration set during a draw stays, and otherwise the page\'s comes back as it was', async () => {
        const mermaid = (await import('mermaid')).default;
        const render = mermaid.render;
        pageConfig = { securityLevel: 'loose', theme: 'dark', startOnLoad: true };
        // The page sets its own while the diagram is being drawn.
        mermaid.render = async (...args) => {
            const result = await render(...args);
            mermaid.initialize({ theme: 'forest', fontFamily: 'Inter', startOnLoad: false, securityLevel: 'strict', look: 'classic', layout: 'dagre' });
            return result;
        };
        editor = createEditor({ content: '<div class="mermaid">graph TD; C-->D</div>' });
        render2();
        await vi.waitFor(() => expect(pageConfig.fontFamily).toBe('Inter'));
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(pageConfig.theme).toBe('forest');
        mermaid.render = render;

        // With nothing set meanwhile, the page's comes back as it was (startOnLoad too: a history preview
        // holds no .mermaid element for it to draw).
        pageConfig = { securityLevel: 'loose', theme: 'dark', startOnLoad: true };
        editor.destroy();
        const drawnBefore = calls.filter(call => 'rendered' in call).length;
        editor = createEditor({ content: '<div class="mermaid">graph TD; E-->F</div>' });
        render2();
        await vi.waitFor(() => expect(calls.filter(call => 'rendered' in call).length).toBe(drawnBefore + 1));
        await vi.waitFor(() => expect(pageConfig.startOnLoad).toBe(true));
        expect(pageConfig.theme).toBe('dark');
        expect(pageConfig.securityLevel).toBe('loose');
    });
});

function render2() {
    return render(<EditorContent editor={editor} />);
}
