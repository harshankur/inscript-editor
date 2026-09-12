import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveToolbar } from './ResponsiveToolbar.jsx';
import { TOOLBAR_SIZES } from './ToolbarButton.jsx';
import { TOOLBAR_PRESETS } from '../toolbar/presets.js';
import { DIVIDER } from '../toolbar/toolRegistry.js';
import { createEditor } from '../../tests/helpers/createEditor.js';

// DROPDOWN_WIDTH matches the constant in ResponsiveToolbar.jsx
const DROPDOWN_W = TOOLBAR_SIZES.BUTTON + 14 + 1;

/**
 * Compute the expected visibleCount for a given container width,
 * based on the full default config (TOOLBAR_PRESETS.full).
 * Each entry is a tool ID or DIVIDER ('|').
 */
function slotWidth(entry) {
    if (entry === DIVIDER) return TOOLBAR_SIZES.DIVIDER;
    // Known dropdown tools
    if (['align', 'admonitions'].includes(entry)) return DROPDOWN_W;
    // Known custom-rendered tools (wider)
    if (['fontSize', 'highlight', 'color', 'link', 'tags'].includes(entry)) return TOOLBAR_SIZES.CUSTOM;
    // Regular icon button
    return TOOLBAR_SIZES.BUTTON;
}

function expectedVisibleCount(containerWidth, config = TOOLBAR_PRESETS.full) {
    const usable = containerWidth - 50;
    let total = 0;
    let count = 0;
    for (const entry of config) {
        const w = slotWidth(entry);
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
        expect(screen.queryByTitle('More tools')).not.toBeInTheDocument();
    });

    it('collapses tools into the More menu when the container is narrow', () => {
        const width = 300;
        stubClientWidth(width);
        render(<ResponsiveToolbar editor={editor} />);
        expect(screen.getByTitle('More tools')).toBeInTheDocument();
        expect(screen.getByTitle('Undo')).toBeInTheDocument();
        expect(expectedVisibleCount(width)).toBeLessThan(TOOLBAR_PRESETS.full.length);
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

    it('recomputes when the preset/config changes without a resize (no phantom overflow)', () => {
        // Reproduces the reported bug: at a wide width, switch from a small preset to a
        // large one. The tool set changes but nothing resizes, so a stale count would leave
        // a ">>" with empty space beside it.
        stubClientWidth(2000);
        const { rerender } = render(<ResponsiveToolbar editor={editor} toolbarConfig={TOOLBAR_PRESETS.blogger} />);
        expect(screen.queryByTitle('More tools')).not.toBeInTheDocument();

        rerender(<ResponsiveToolbar editor={editor} toolbarConfig={TOOLBAR_PRESETS.full} />);
        // Full also fits at 2000px, so there must be no phantom More button, and a tool near
        // the end of the full config must be visible (not stranded in overflow).
        expect(screen.queryByTitle('More tools')).not.toBeInTheDocument();
        expect(screen.getByTitle('Insert Table')).toBeInTheDocument();
    });

    it('a visible command button drives the editor', () => {
        stubClientWidth(2000);
        render(<ResponsiveToolbar editor={editor} />);
        editor.commands.selectAll();
        const boldButton = screen.getByTitle('Bold');
        fireEvent.click(boldButton);
        expect(editor.isActive('bold')).toBe(true);
    });

    it('accepts a custom toolbarConfig and only renders those tools', () => {
        stubClientWidth(2000);
        const customConfig = ['undo', 'redo', '|', 'bold'];
        render(<ResponsiveToolbar editor={editor} toolbarConfig={customConfig} />);
        expect(screen.getByTitle('Undo')).toBeInTheDocument();
        expect(screen.getByTitle('Bold')).toBeInTheDocument();
        // Tools not in config should not be rendered
        expect(screen.queryByTitle('Heading 1')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Insert Table')).not.toBeInTheDocument();
    });

    it('uses a preset config correctly (blogger preset has no math or wikilink)', () => {
        stubClientWidth(2000);
        render(<ResponsiveToolbar editor={editor} toolbarConfig={TOOLBAR_PRESETS.blogger} />);
        expect(screen.getByTitle('Bold')).toBeInTheDocument();
        expect(screen.queryByTitle('Math Block')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Insert Wikilink')).not.toBeInTheDocument();
    });

    it('the default (full) preset does not include wikilink (its extension is opt-in)', () => {
        stubClientWidth(2000);
        render(<ResponsiveToolbar editor={editor} />);
        expect(screen.queryByTitle('Insert Wikilink')).not.toBeInTheDocument();
    });
});

describe('ResponsiveToolbar input tools (abbreviation / citation / wikilink)', () => {
    let editor;
    let originalCW;

    beforeEach(() => {
        editor = createEditor();
        editor.commands.setContent('<p>HTML rocks</p>');
        originalCW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
        stubClientWidth(2000);
    });

    afterEach(() => {
        editor.destroy();
        if (originalCW) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalCW);
    });

    it('abbreviation prompts for the expansion and applies a titled <abbr>', () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('HyperText Markup Language');
        render(<ResponsiveToolbar editor={editor} />);
        editor.commands.selectAll();
        fireEvent.click(screen.getByTitle('Abbreviation'));
        expect(promptSpy).toHaveBeenCalled();
        expect(editor.isActive('abbreviation')).toBe(true);
        expect(editor.getHTML()).toContain('title="HyperText Markup Language"');
        promptSpy.mockRestore();
    });

    it('abbreviation with an empty prompt (cancelled) applies nothing', () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
        render(<ResponsiveToolbar editor={editor} />);
        editor.commands.selectAll();
        fireEvent.click(screen.getByTitle('Abbreviation'));
        expect(editor.isActive('abbreviation')).toBe(false);
        promptSpy.mockRestore();
    });

    it('abbreviation routes through onAddAbbreviation when the host provides it (no prompt)', () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('x');
        const onAddAbbreviation = vi.fn();
        render(<ResponsiveToolbar editor={editor} onAddAbbreviation={onAddAbbreviation} />);
        fireEvent.click(screen.getByTitle('Abbreviation'));
        expect(onAddAbbreviation).toHaveBeenCalledTimes(1);
        expect(promptSpy).not.toHaveBeenCalled();
        promptSpy.mockRestore();
    });

    it('citation routes through onAddCitation when the host provides it (no prompt)', () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('x');
        const onAddCitation = vi.fn();
        render(<ResponsiveToolbar editor={editor} onAddCitation={onAddCitation} />);
        fireEvent.click(screen.getByTitle('Citation'));
        expect(onAddCitation).toHaveBeenCalledTimes(1);
        expect(promptSpy).not.toHaveBeenCalled();
        promptSpy.mockRestore();
    });

    it('wikilink button does not throw when its opt-in extension is absent', () => {
        // The default editor has no Wikilink extension, so insertWikilink is undefined.
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Page');
        render(<ResponsiveToolbar editor={editor} toolbarConfig={['wikilink']} />);
        expect(() => fireEvent.click(screen.getByTitle('Insert Wikilink'))).not.toThrow();
        expect(promptSpy).not.toHaveBeenCalled(); // guarded before prompting
        promptSpy.mockRestore();
    });
});
