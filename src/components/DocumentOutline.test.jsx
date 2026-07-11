import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
