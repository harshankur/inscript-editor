import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InscriptEditor } from './InscriptEditor.jsx';
import { createEditor } from '../tests/helpers/createEditor.js';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div data-testid="bubble-menu">{children}</div>,
    FloatingMenu: ({ children }) => <div data-testid="floating-menu">{children}</div>,
}));

describe('InscriptEditor', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
        editor.commands.setContent('<p>hello world</p>');
    });

    afterEach(() => {
        editor.destroy();
    });

    describe('ref contract', () => {
        it('getHTML/getText delegate to the editor', () => {
            const ref = createRef();
            render(<InscriptEditor editor={editor} ref={ref} />);
            expect(ref.current.getHTML()).toBe('<p>hello world</p>');
            expect(ref.current.getText()).toBe('hello world');
        });

        it('setContent delegates to editor.commands.setContent', () => {
            const ref = createRef();
            render(<InscriptEditor editor={editor} ref={ref} />);
            ref.current.setContent('<p>new content</p>');
            expect(editor.getHTML()).toBe('<p>new content</p>');
        });

        it('restoreVersion delegates to the restoreVersion prop', () => {
            const restoreVersion = vi.fn();
            const ref = createRef();
            render(<InscriptEditor editor={editor} restoreVersion={restoreVersion} ref={ref} />);
            ref.current.restoreVersion(2);
            expect(restoreVersion).toHaveBeenCalledWith(2);
        });

        it('markSaved delegates to the markSaved prop', () => {
            const markSaved = vi.fn();
            const ref = createRef();
            render(<InscriptEditor editor={editor} markSaved={markSaved} ref={ref} />);
            ref.current.markSaved();
            expect(markSaved).toHaveBeenCalledTimes(1);
        });

        it('renders null with no editor, and the ref handle does not throw', () => {
            const ref = createRef();
            const { container } = render(<InscriptEditor editor={null} ref={ref} />);
            expect(container).toBeEmptyDOMElement();
            expect(() => ref.current.getHTML()).not.toThrow();
            expect(ref.current.getHTML()).toBe('');
            expect(ref.current.getText()).toBe('');
        });
    });

    describe('composition', () => {
        it('hides the toolbar when isReadonly', () => {
            render(<InscriptEditor editor={editor} isReadonly />);
            expect(screen.queryByTitle('Undo')).not.toBeInTheDocument();
        });

        it('hides the toolbar when showDiff', () => {
            render(<InscriptEditor editor={editor} showDiff history={[]} />);
            expect(screen.queryByTitle('Undo')).not.toBeInTheDocument();
        });

        it('shows the toolbar in the normal editing view', () => {
            render(<InscriptEditor editor={editor} />);
            expect(screen.getByTitle('Undo')).toBeInTheDocument();
        });

        it('swaps to HistoryView when showDiff is true', () => {
            const history = [{ html: '<p>v0</p>', title: 'T0', tags: [], categories: [], timestamp: new Date().toISOString(), isOriginal: true }];
            render(<InscriptEditor editor={editor} showDiff history={history} historyIndex={0} originalContent={{ html: '<p>v0</p>', title: 'T0', tags: [], categories: [] }} />);
            expect(screen.getByText('Version History')).toBeInTheDocument();
        });

        it('renders EditorContent with the document text when not showing the diff', () => {
            render(<InscriptEditor editor={editor} />);
            expect(screen.getByText('hello world')).toBeInTheDocument();
        });

        it('no longer renders a branding footer (regression for finding 13)', () => {
            render(<InscriptEditor editor={editor} />);
            expect(screen.queryByText(/Powered by/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Harsh Ankur/i)).not.toBeInTheDocument();
        });
    });
});
