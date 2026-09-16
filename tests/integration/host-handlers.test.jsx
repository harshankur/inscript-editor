import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../../src/hooks/useInscriptEditor.js';
import { InscriptEditor } from '../../src/InscriptEditor.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div data-testid="bubble-menu">{children}</div>,
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

function stubClientWidth(width) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() { return width; },
    });
}

// Mirrors how a host wires the two together: the hook takes editorOptions, and its
// return value is spread into <InscriptEditor>. `editorRef` captures the editor so a
// test can reach into the slash-command items directly.
function Harness({ editorOptions, editorRef, ...props }) {
    const api = useInscriptEditor({ contentKey: 'host.md', editorOptions });
    if (editorRef) editorRef.current = api.editor;
    return <InscriptEditor {...api} editor={api.editor} {...props} />;
}

const slashItem = (editor, id) => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'slashCommand');
    return (ext?.options.items || []).find((i) => i.id === id);
};
const runSlash = (editor, id) => slashItem(editor, id).command({ editor, range: { from: 1, to: 1 } });

describe('host handlers: editorOptions is the single source of truth', () => {
    let originalCW;
    beforeEach(() => {
        originalCW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
        stubClientWidth(2000);
    });
    afterEach(() => {
        if (originalCW) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalCW);
    });

    it('citation via editorOptions drives BOTH the toolbar button and the slash entry (no prompt)', () => {
        const onAddCitation = vi.fn();
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('x');
        const editorRef = { current: null };
        render(<Harness editorOptions={{ onAddCitation }} editorRef={editorRef} />);

        fireEvent.click(screen.getByTitle('Citation'));           // toolbar path
        expect(onAddCitation).toHaveBeenCalledTimes(1);

        runSlash(editorRef.current, 'citation');                  // slash path
        expect(onAddCitation).toHaveBeenCalledTimes(2);

        expect(promptSpy).not.toHaveBeenCalled();
        promptSpy.mockRestore();
    });

    it('youtube via editorOptions drives both the toolbar button and the (gated) slash entry', () => {
        const onAddYoutube = vi.fn();
        const editorRef = { current: null };
        render(<Harness editorOptions={{ onAddYoutube }} editorRef={editorRef} />);

        fireEvent.click(screen.getByTitle('Embed YouTube Video'));
        expect(onAddYoutube).toHaveBeenCalledTimes(1);

        const item = slashItem(editorRef.current, 'youtube');
        expect(item).toBeTruthy();                                 // gated on the handler being present
        runSlash(editorRef.current, 'youtube');
        expect(onAddYoutube).toHaveBeenCalledTimes(2);
    });

    it('image via editorOptions drives both the toolbar button and the (gated) slash entry', () => {
        const onShowMediaLibrary = vi.fn();
        const editorRef = { current: null };
        render(<Harness editorOptions={{ onShowMediaLibrary }} editorRef={editorRef} />);

        fireEvent.click(screen.getByTitle('Insert Image'));
        expect(onShowMediaLibrary).toHaveBeenCalledTimes(1);

        const item = slashItem(editorRef.current, 'image');
        expect(item).toBeTruthy();
        runSlash(editorRef.current, 'image');
        expect(onShowMediaLibrary).toHaveBeenCalledTimes(2);
    });

    it('an <InscriptEditor> prop overrides the editorOptions handler (per-call override)', () => {
        const fromOptions = vi.fn();
        const fromProp = vi.fn();
        render(<Harness editorOptions={{ onAddCitation: fromOptions }} onAddCitation={fromProp} />);

        fireEvent.click(screen.getByTitle('Citation'));
        expect(fromProp).toHaveBeenCalledTimes(1);
        expect(fromOptions).not.toHaveBeenCalled();
    });

    it('with no handler anywhere, the toolbar citation still falls back to window.prompt', () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null); // cancel at first prompt
        render(<Harness editorOptions={{}} />);
        fireEvent.click(screen.getByTitle('Citation'));
        expect(promptSpy).toHaveBeenCalled();
        promptSpy.mockRestore();
    });
});
