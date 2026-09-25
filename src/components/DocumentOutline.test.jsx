import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { DocumentOutline } from './DocumentOutline.jsx';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('DocumentOutline component', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
        const store = {};
        global.localStorage = {
            getItem: vi.fn(key => store[key] || null),
            setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
            clear: vi.fn(() => { for (let key in store) delete store[key]; })
        };
    });

    afterEach(() => {
        editor.destroy();
    });

    it('renders empty state when no headings', () => {
        editor.commands.setContent('<p>Just some text</p>');
        render(<DocumentOutline editor={editor} />);
        expect(screen.getByText('No headings yet')).toBeInTheDocument();
    });

    it('extracts and displays headings', () => {
        editor.commands.setContent('<h1>Main Title</h1><h2>Subtitle</h2><p>Text</p><h3>Section</h3>');
        render(<DocumentOutline editor={editor} />);
        expect(screen.getByText('Main Title')).toBeInTheDocument();
        expect(screen.getByText('Subtitle')).toBeInTheDocument();
        expect(screen.getByText('Section')).toBeInTheDocument();
    });

    it('toggles collapse state and persists to localStorage', () => {
        const { unmount } = render(<DocumentOutline editor={editor} />);
        expect(screen.getByText('Outline')).toBeInTheDocument();
        
        const collapseBtn = screen.getByTitle('Collapse outline');
        fireEvent.click(collapseBtn);
        
        expect(screen.queryByText('Outline')).not.toBeInTheDocument();
        expect(screen.getByTitle('Expand outline')).toBeInTheDocument();
        expect(localStorage.getItem('inscript-outline-collapsed')).toBe('true');

        unmount();
        // It should start collapsed based on localStorage
        render(<DocumentOutline editor={editor} />);
        expect(screen.queryByText('Outline')).not.toBeInTheDocument();
        expect(screen.getByTitle('Expand outline')).toBeInTheDocument();
    });

    it('refreshes after content set with emitUpdate: false (a version restore)', () => {
        editor.commands.setContent('<h1>Old heading</h1>');
        const { container } = render(<DocumentOutline editor={editor} />);
        expect(container.textContent).toContain('Old heading');
        act(() => { editor.commands.setContent('<h1>New heading</h1>', { emitUpdate: false }); });
        expect(container.textContent).toContain('New heading');
        expect(container.textContent).not.toContain('Old heading');
    });

    it('does not crash when storage access throws (sandboxed iframe, blocked storage)', () => {
        global.localStorage = {
            getItem: () => { throw new Error('SecurityError'); },
            setItem: () => { throw new Error('SecurityError'); },
        };
        editor.commands.setContent('<h1>Hi</h1>');
        expect(() => render(<DocumentOutline editor={editor} />)).not.toThrow();
        // Toggling still works in memory even though it can't be persisted.
        fireEvent.click(screen.getByTitle('Collapse outline'));
        expect(screen.getByTitle('Expand outline')).toBeInTheDocument();
    });

    it('ignores a heading click once the editor has no view', () => {
        editor.commands.setContent('<h1>Hi</h1>');
        render(<DocumentOutline editor={editor} />);
        editor.unmount();
        expect(() => fireEvent.click(screen.getByText('Hi'))).not.toThrow();
    });

    it('chrome={false} renders just the list: no header, and a stored collapsed state is ignored', () => {
        localStorage.setItem('inscript-outline-collapsed', 'true');
        editor.commands.setContent('<h1>Main Title</h1>');
        render(<DocumentOutline editor={editor} chrome={false} />);
        expect(screen.queryByText('Outline')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Expand outline')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Collapse outline')).not.toBeInTheDocument();
        expect(screen.getByText('Main Title')).toBeInTheDocument();
    });

    it('collapsible={false} keeps the header but drops the collapse button and stored state', () => {
        localStorage.setItem('inscript-outline-collapsed', 'true');
        render(<DocumentOutline editor={editor} collapsible={false} width="20rem" className="my-outline" />);
        expect(screen.getByText('Outline')).toBeInTheDocument();
        expect(screen.queryByTitle('Collapse outline')).not.toBeInTheDocument();
        const root = screen.getByText('Outline').closest('.my-outline');
        expect(root).not.toBeNull();
        expect(root.style.width).toBe('20rem');
    });
});
