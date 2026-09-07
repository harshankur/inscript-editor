import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MiniMap } from './MiniMap.jsx';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('MiniMap component', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
        const store = {};
        global.localStorage = {
            getItem: vi.fn(key => store[key] || null),
            setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
            clear: vi.fn(() => { for (let key in store) delete store[key]; })
        };
        // Mock ResizeObserver
        global.ResizeObserver = class {
            observe() {}
            disconnect() {}
        };
    });

    afterEach(() => {
        editor.destroy();
    });

    it('renders a titled box per block and a readable heading label', () => {
        editor.commands.setContent('<h1>My Big Heading</h1><p>Paragraph</p><pre><code>Code</code></pre>');
        const { container } = render(<MiniMap editor={editor} />);

        expect(screen.getByText('Minimap')).toBeInTheDocument();
        // Each block becomes a box carrying a native title naming its content type.
        const titles = Array.from(container.querySelectorAll('[title]')).map(t => t.getAttribute('title'));
        expect(titles).toContain('Heading');
        expect(titles).toContain('Paragraph');
        expect(titles).toContain('Code block');
        // The redesign's headline win: the heading renders as READABLE text, not a glyph.
        expect(screen.getByText('My Big Heading')).toBeInTheDocument();
    });

    it('collapses headings to ticks (no label) when showHeadingText is false', () => {
        editor.commands.setContent('<h1>My Big Heading</h1><p>Paragraph</p>');
        render(<MiniMap editor={editor} showHeadingText={false} />);
        expect(screen.queryByText('My Big Heading')).not.toBeInTheDocument();
    });

    it('toggles collapse state and persists to localStorage', () => {
        const { unmount } = render(<MiniMap editor={editor} />);
        expect(screen.getByText('Minimap')).toBeInTheDocument();
        
        const collapseBtn = screen.getByTitle('Collapse minimap');
        fireEvent.click(collapseBtn);
        
        expect(screen.queryByText('Minimap')).not.toBeInTheDocument();
        expect(screen.getByTitle('Expand minimap')).toBeInTheDocument();
        expect(localStorage.getItem('inscript-minimap-collapsed')).toBe('true');

        unmount();
        // It should start collapsed based on localStorage
        render(<MiniMap editor={editor} />);
        expect(screen.queryByText('Minimap')).not.toBeInTheDocument();
        expect(screen.getByTitle('Expand minimap')).toBeInTheDocument();
    });
});
