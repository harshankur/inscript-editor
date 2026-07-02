import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResponsiveToolbar } from './ResponsiveToolbar.jsx';
import { TOOLBAR_SIZES } from './ToolbarButton.jsx';
import { createEditor } from '../../tests/helpers/createEditor.js';

// Mirrors the tool list built inside ResponsiveToolbar (26 buttons/customs + 7 dividers = 33
// slots), used to compute expected visible counts from TOOLBAR_SIZES without hardcoding numbers.
const TOOL_SLOT_TYPES = [
    'button', 'button', 'divider',
    'button', 'button', 'button', 'button', 'custom', 'divider',
    'custom', 'custom', 'custom', 'divider',
    'button', 'button', 'button', 'button', 'divider',
    'button', 'button', 'divider',
    'button', 'button', 'button', 'button', 'divider',
    'button', 'button', 'divider',
    'button', 'button', 'button', 'custom',
];

function expectedVisibleCount(containerWidth) {
    const usable = containerWidth - 50;
    let total = 0;
    let count = 0;
    for (const type of TOOL_SLOT_TYPES) {
        const w = type === 'divider' ? TOOLBAR_SIZES.DIVIDER : type === 'custom' ? TOOLBAR_SIZES.CUSTOM : TOOLBAR_SIZES.BUTTON;
        if (total + w + TOOLBAR_SIZES.GAP > usable) break;
        total += w + TOOLBAR_SIZES.GAP;
        count++;
    }
    return Math.max(2, count);
}

function stubClientWidth(width) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() { return width; },
    });
}

describe('ResponsiveToolbar overflow', () => {
    let editor;
    let originalClientWidth;

    beforeEach(() => {
        editor = createEditor();
        editor.commands.setContent('<p>hello</p>');
        originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    });

    afterEach(() => {
        editor.destroy();
        if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    });

    it('renders nothing without an editor', () => {
        const { container } = render(<ResponsiveToolbar editor={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows every tool when the container is wide enough for all of them', () => {
        stubClientWidth(2000);
        render(<ResponsiveToolbar editor={editor} />);
        // No "More" overflow button when everything fits.
        expect(screen.queryByTitle('More tools')).not.toBeInTheDocument();
    });

    it('collapses tools into the More menu when the container is narrow, matching the TOOLBAR_SIZES-derived count', () => {
        const width = 300;
        stubClientWidth(width);
        render(<ResponsiveToolbar editor={editor} />);
        expect(screen.getByTitle('More tools')).toBeInTheDocument();
        // undo/redo are always among the first visible tools at this width.
        expect(screen.getByTitle('Undo')).toBeInTheDocument();
        expect(expectedVisibleCount(width)).toBeLessThan(TOOL_SLOT_TYPES.length);
    });

    it('reveals overflow tools when the More button is clicked', () => {
        stubClientWidth(300);
        render(<ResponsiveToolbar editor={editor} />);
        const moreButton = screen.getByTitle('More tools');
        expect(screen.queryByTitle('Insert Table')).not.toBeInTheDocument();
        fireEvent.click(moreButton);
        expect(screen.getByTitle('Insert Table')).toBeInTheDocument();
    });

    it('recomputes the visible count when the container resizes', () => {
        stubClientWidth(300);
        render(<ResponsiveToolbar editor={editor} />);
        expect(screen.getByTitle('More tools')).toBeInTheDocument();

        stubClientWidth(2000);
        fireEvent(window, new Event('resize'));
        expect(screen.queryByTitle('More tools')).not.toBeInTheDocument();
    });

    it('a visible command button drives the editor', () => {
        stubClientWidth(2000);
        render(<ResponsiveToolbar editor={editor} />);
        editor.commands.selectAll();
        // Button DOM order at full width: [Undo, Redo, Bold, Italic, ...] (dividers aren't buttons).
        const boldButton = screen.getAllByRole('button')[2];
        fireEvent.click(boldButton);
        expect(editor.isActive('bold')).toBe(true);
    });
});
