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

    it('renders block SVGs correctly', () => {
        editor.commands.setContent('<h1>Heading</h1><p>Paragraph</p><pre><code>Code</code></pre>');
        const { container } = render(<MiniMap editor={editor} />);
        
        expect(screen.getByText('Minimap')).toBeInTheDocument();
        // SVG has rect elements for each block
        const rects = container.querySelectorAll('rect');
        console.log('RECT TYPES:', Array.from(rects).map(r => r.outerHTML || r.tagName));
        expect(rects.length).toBe(5);
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
