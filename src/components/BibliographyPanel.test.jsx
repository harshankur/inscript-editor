import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BibliographyPanel } from './BibliographyPanel.jsx';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('BibliographyPanel component', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { citation: true });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('renders empty state correctly', () => {
        render(<BibliographyPanel editor={editor} />);
        expect(screen.getByText('No citations in document')).toBeInTheDocument();
    });

    it('lists citations and allows navigation', () => {
        editor.commands.setContent('<p>Some text <span class="citation" data-key="key1" data-label="Author, 2026" title="Bibliography text">[@key1]</span></p>');
        render(<BibliographyPanel editor={editor} />);

        expect(screen.getByText('@key1')).toBeInTheDocument();
        expect(screen.getByText('[Author, 2026]')).toBeInTheDocument();
        expect(screen.getByText('Bibliography text')).toBeInTheDocument();
    });

    it('allows editing citation detail and propagates changes to editor', () => {
        editor.commands.setContent('<p>Some text <span class="citation" data-key="key1" data-label="Author, 2026" title="Bibliography text">[@key1]</span></p>');
        render(<BibliographyPanel editor={editor} />);

        const editBtn = screen.getByTitle('Edit citation');
        fireEvent.click(editBtn);

        const inputLabel = screen.getByLabelText('Inline Label');
        const inputTitle = screen.getByLabelText('Full Citation Entry');

        fireEvent.change(inputLabel, { target: { value: 'New Label, 2026' } });
        fireEvent.change(inputTitle, { target: { value: 'New Title Info' } });

        const saveBtn = screen.getByTitle('Save');
        fireEvent.click(saveBtn);

        expect(screen.getByText('[New Label, 2026]')).toBeInTheDocument();
        expect(screen.getByText('New Title Info')).toBeInTheDocument();

        // Verify editor document has been updated
        const html = editor.getHTML();
        expect(html).toContain('data-label="New Label, 2026"');
        expect(html).toContain('title="New Title Info"');
    });
});
