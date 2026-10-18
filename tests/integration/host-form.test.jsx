// A host that renders the editor inside its own <form> (a post editor, a settings page) must never
// have that form submitted by the editor's controls. A <button> without `type` is a submit button.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../../src/hooks/useInscriptEditor.js';
import { InscriptEditor } from '../../src/InscriptEditor.jsx';
import { EditorContent } from '@tiptap/react';
import { createEditor } from '../helpers/createEditor.js';
import { BibliographyPanel } from '../../src/components/BibliographyPanel.jsx';
import { ImageSelectorModal } from '../../src/components/ImageSelectorModal.jsx';
import { YoutubeEmbedModal } from '../../src/components/YoutubeEmbedModal.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div data-testid="bubble-menu">{children}</div>,
    FloatingMenu: ({ children }) => <div data-testid="floating-menu">{children}</div>,
}));

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src');

function Host({ onSubmit, showDiff = false, hookRef }) {
    const hook = useInscriptEditor({ contentKey: 'post', initialContent: '<p>Hello world</p>' });
    hookRef.current = hook;
    return (
        <form onSubmit={onSubmit}>
            <InscriptEditor {...hook} showDiff={showDiff} onToolbarConfigChange={() => {}} />
        </form>
    );
}

describe('the editor inside a host <form>', () => {
    let submit;
    beforeEach(() => {
        vi.useFakeTimers();
        submit = vi.fn(e => e.preventDefault());
    });
    afterEach(() => { vi.useRealTimers(); });

    it('the selection menu formats without submitting the form', () => {
        const hookRef = { current: null };
        render(<Host onSubmit={submit} hookRef={hookRef} />);
        act(() => { hookRef.current.editor.commands.setTextSelection({ from: 1, to: 6 }); });
        const bold = screen.getAllByTitle('Bold').find(b => b.closest('[data-testid="bubble-menu"]'));
        fireEvent.click(bold);
        expect(hookRef.current.editor.getHTML()).toContain('<strong>Hello</strong>');
        expect(submit).not.toHaveBeenCalled();
    });

    it('the toolbar overflow and customize buttons do not submit the form', () => {
        const hookRef = { current: null };
        render(<Host onSubmit={submit} hookRef={hookRef} />);
        const more = screen.queryByTitle('More tools');
        if (more) fireEvent.click(more);
        fireEvent.click(screen.getByTitle('Customize toolbar'));
        expect(submit).not.toHaveBeenCalled();
    });

    it('the history view controls do not submit the form', () => {
        const hookRef = { current: null };
        const { rerender } = render(<Host onSubmit={submit} hookRef={hookRef} />);
        act(() => { hookRef.current.editor.commands.insertContent('!'); });
        act(() => { vi.advanceTimersByTime(1500); });
        rerender(<Host onSubmit={submit} hookRef={hookRef} showDiff />);
        for (const label of ['Text', 'Source', 'Preview']) {
            fireEvent.click(screen.getAllByRole('button').find(x => x.textContent.trim() === label));
        }
        expect(submit).not.toHaveBeenCalled();
    });

    it('the link popover applies on Enter without submitting the form', () => {
        const hookRef = { current: null };
        render(<Host onSubmit={submit} hookRef={hookRef} />);
        act(() => { hookRef.current.editor.commands.setTextSelection({ from: 1, to: 6 }); });
        const linkButton = screen.getAllByTitle('Insert Link').find(b => b.closest('[data-testid="bubble-menu"]'));
        fireEvent.click(linkButton);
        const input = screen.getByPlaceholderText('Enter URL...');
        fireEvent.change(input, { target: { value: 'https://example.com' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(hookRef.current.editor.getHTML()).toContain('href="https://example.com"');
        expect(submit).not.toHaveBeenCalled();
    });
});

// Enter in a single-line field submits the form around it (implicit submission). jsdom does not
// perform that submission, so these check that the field cancels Enter: fireEvent returns false.
describe('Enter in the editor\'s text fields, inside a host <form>', () => {
    let editor;
    afterEach(() => { editor?.destroy(); editor = null; });

    it('the math source field keeps Enter to itself', async () => {
        editor = createEditor({ content: '<div class="math-block">x^2</div>' });
        const { container } = render(<form><EditorContent editor={editor} /></form>);
        let pos = null;
        editor.state.doc.descendants((n, p) => { if (pos === null && n.type.name === 'mathBlock') pos = p; });
        await act(async () => { editor.commands.setNodeSelection(pos); });
        const input = container.querySelector('input[placeholder="LaTeX math..."]');
        expect(input).not.toBeNull();
        expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
        expect(editor.getHTML()).toContain('x^2');
    });

    it('the bibliography label field saves on Enter', () => {
        editor = createEditor({ content: '<p>See <span class="citation" data-key="knuth" data-label="Knuth 1984">[Knuth 1984]</span>.</p>' });
        render(<form><BibliographyPanel editor={editor} /></form>);
        fireEvent.click(screen.getByTitle('Edit citation'));
        const [label] = screen.getAllByRole('textbox');
        fireEvent.change(label, { target: { value: 'DEK' } });
        let notCancelled;
        act(() => { notCancelled = fireEvent.keyDown(label, { key: 'Enter' }); });
        expect(notCancelled).toBe(false);
        let saved = null;
        editor.state.doc.descendants(n => { if (n.type.name === 'citation') saved = n.attrs.label; });
        expect(saved).toBe('DEK');
    });

    it('the image search keeps Enter to itself', () => {
        render(<form><ImageSelectorModal isOpen onClose={() => {}} images={[]} onSelect={() => {}} /></form>);
        expect(fireEvent.keyDown(screen.getByPlaceholderText('Search images...'), { key: 'Enter' })).toBe(false);
    });

    it('the video link field inserts a valid video on Enter, and only then', () => {
        const onConfirm = vi.fn();
        render(<form><YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={onConfirm} /></form>);
        const input = screen.getByPlaceholderText('https://youtube.com/watch?v=...');
        fireEvent.change(input, { target: { value: 'not a video' } });
        expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.change(input, { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
        expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
        expect(onConfirm).toHaveBeenCalledWith('dQw4w9WgXcQ');
    });
});

describe('every <button> in the library source', () => {
    // A static check, so a button added later in a panel no test renders is still caught.
    function sourceFiles(dir) {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return sourceFiles(full);
            return /\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name) ? [full] : [];
        });
    }
    function openingTags(source, name = 'button') {
        const tags = [];
        for (const match of source.matchAll(new RegExp(`<${name}\\b`, 'g'))) {
            let depth = 0;
            let end = match.index;
            for (; end < source.length; end++) {
                const c = source[end];
                if (c === '{') depth++;
                else if (c === '}') depth--;
                else if (c === '>' && depth === 0) break;
            }
            tags.push({ tag: source.slice(match.index, end), line: source.slice(0, match.index).split('\n').length });
        }
        return tags;
    }

    it('says type="button", and no <form> element is rendered', () => {
        const offenders = [];
        for (const file of sourceFiles(SRC_DIR)) {
            const source = fs.readFileSync(file, 'utf8');
            for (const { tag, line } of openingTags(source)) {
                if (!/\btype="button"/.test(tag)) offenders.push(`${path.relative(SRC_DIR, file)}:${line}`);
            }
            if (/<form\b[^>]*>/.test(source.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''))) offenders.push(`${path.relative(SRC_DIR, file)}: <form>`);
        }
        expect(offenders).toEqual([]);
    });

    it('every single-line text field cancels Enter, so it never submits a host form', () => {
        const NOT_TEXT = /\btype="(checkbox|radio|color|file|range|button|submit|reset|hidden|image)"/;
        const offenders = [];
        for (const file of sourceFiles(SRC_DIR)) {
            const source = fs.readFileSync(file, 'utf8');
            for (const { tag, line } of openingTags(source, 'input')) {
                if (NOT_TEXT.test(tag)) continue;
                if (!/onKeyDown=/.test(tag) || !/'Enter'/.test(tag) || !/preventDefault\(\)/.test(tag)) {
                    offenders.push(`${path.relative(SRC_DIR, file)}:${line}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
