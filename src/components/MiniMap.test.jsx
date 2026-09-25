import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MiniMap, miniMapScale, miniMapViewport } from './MiniMap.jsx';
import { createEditor } from '../../tests/helpers/createEditor.js';

// The fit-to-panel scale and the viewport-marker geometry are pure math (jsdom has no
// layout, so they can't be exercised through the rendered component). These lock the
// exact behaviour that regressed: the marker must be a proportional slice of the DRAWN
// document, never spanning the whole map when only part of the doc is visible.
describe('MiniMap layout math', () => {
    it('fit-to-panel fills the panel for a doc taller than it', () => {
        const availH = 972, docHeight = 2900;
        const { S, canFit } = miniMapScale({ measured: true, docHeight, availH, lineHeightPx: 28 });
        expect(canFit).toBe(true);
        // The whole doc is scaled to exactly fill the available height.
        expect(docHeight * S).toBeCloseTo(availH, 5);
    });

    it('caps upscaling so a short doc does not balloon past the panel', () => {
        const availH = 972, docHeight = 200;
        const { S } = miniMapScale({ measured: true, docHeight, availH, lineHeightPx: 28 });
        expect(S).toBe(0.5);                 // MAX_SCALE cap
        expect(docHeight * S).toBeLessThan(availH); // drawn content stays within the panel
    });

    it('falls back to a fixed density when the height is unbounded / unmeasured', () => {
        const nat = miniMapScale({ measured: true, docHeight: 2900, availH: 40, lineHeightPx: 28 });
        expect(nat.canFit).toBe(false);
        expect(nat.S).toBeCloseTo(2.6 / 28, 5);
        expect(miniMapScale({ measured: false, docHeight: 0, availH: 972, lineHeightPx: 28 }).canFit).toBe(false);
    });

    it('viewport marker is a proportional slice of the drawn doc, not the whole map', () => {
        const docHeight = 2900, availH = 972;
        const { S } = miniMapScale({ measured: true, docHeight, availH, lineHeightPx: 28 });
        const drawnPx = docHeight * S; // ~972 (fills)
        // Editor showing ~1/3 of the document (the scenario that looked wrong).
        const vp = miniMapViewport({ scrollTop: 0, scrollHeight: 3000, clientHeight: 980, drawnPx });
        expect(vp.scrolls).toBe(true);
        // REGRESSION: the marker covers ~1/3, NOT the entire document.
        expect(vp.height / drawnPx).toBeCloseTo(980 / 3000, 3);
        expect(vp.height).toBeLessThan(drawnPx * 0.4);
    });

    it('viewport marker never extends past the drawn document (any scroll position)', () => {
        const drawnPx = 972;
        for (const scrollTop of [0, 400, 1010, 2020]) {
            const vp = miniMapViewport({ scrollTop, scrollHeight: 3000, clientHeight: 980, drawnPx });
            // top + height stays within the content region (content bottom = small top pad + drawnPx).
            expect(vp.top + vp.height).toBeLessThanOrEqual(drawnPx + 10);
        }
    });

    it('hides the marker when the document is not scrollable', () => {
        expect(miniMapViewport({ scrollTop: 0, scrollHeight: 500, clientHeight: 500, drawnPx: 400 }).scrolls).toBe(false);
    });
});

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

    // In TipTap v3 `editor.view` is a throwing Proxy whenever no view is mounted, so the
    // minimap must guard on isDestroyed (a host swapping editors per document hits this).
    it('does not throw for an unmounted (not destroyed) editor', () => {
        editor.commands.setContent('<h1>Hi</h1>');
        editor.unmount();
        expect(() => render(<MiniMap editor={editor} />)).not.toThrow();
    });

    it('does not throw for a destroyed editor, including in its deferred measure', () => {
        const ed = createEditor();
        ed.commands.setContent('<h1>Hi</h1>');
        ed.destroy();
        vi.useFakeTimers();
        try {
            expect(() => render(<MiniMap editor={ed} />)).not.toThrow();
            expect(() => act(() => { vi.advanceTimersByTime(500); })).not.toThrow();
        } finally {
            vi.useRealTimers();
        }
    });

    it('re-measures after content set with emitUpdate: false (a version restore)', () => {
        vi.useFakeTimers();
        try {
            editor.commands.setContent('<h1>Old heading</h1>');
            render(<MiniMap editor={editor} />);
            expect(screen.getByText('Old heading')).toBeInTheDocument();
            act(() => { editor.commands.setContent('<h1>New heading</h1>', { emitUpdate: false }); });
            act(() => { vi.advanceTimersByTime(200); });
            expect(screen.getByText('New heading')).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('chrome={false} renders just the map: no header, and a stored collapsed state is ignored', () => {
        localStorage.setItem('inscript-minimap-collapsed', 'true');
        editor.commands.setContent('<h1>My Big Heading</h1><p>Paragraph</p>');
        render(<MiniMap editor={editor} chrome={false} />);
        expect(screen.queryByText('Minimap')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Expand minimap')).not.toBeInTheDocument();
        expect(screen.getByText('My Big Heading')).toBeInTheDocument();
    });

    it('collapsible={false} keeps the header but drops the collapse button', () => {
        localStorage.setItem('inscript-minimap-collapsed', 'true');
        render(<MiniMap editor={editor} collapsible={false} />);
        expect(screen.getByText('Minimap')).toBeInTheDocument();
        expect(screen.queryByTitle('Collapse minimap')).not.toBeInTheDocument();
    });
});
