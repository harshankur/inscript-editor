// ToolbarCustomizer through the toolbar gear, sanitizeToolConfig with odd input, and the
// overflow "More tools" dropdown.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { sanitizeToolConfig, ALL_TOOL_IDS, DIVIDER, BUBBLE_ALLOWED_TOOL_IDS } from '../../src/toolbar/toolRegistry.js';
import { TOOLBAR_PRESETS, BUBBLE_PRESETS } from '../../src/toolbar/presets.js';
import { ToolbarCustomizer } from '../../src/components/ToolbarCustomizer.jsx';
import { renderHost, stubClientWidth, flush, prng } from './harness.jsx';

vi.mock('@tiptap/react/menus', () => ({ BubbleMenu: () => null, FloatingMenu: () => null }));

let restoreWidth;
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); restoreWidth = stubClientWidth(100000); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(async () => {
    vi.useRealTimers();
    restoreWidth();
    vi.restoreAllMocks();
    await act(async () => { await i18next.changeLanguage('en'); });
});

async function openCustomizer(props = {}) {
    const onToolbarConfigChange = vi.fn();
    const r = renderHost({ initialContent: '<p>x</p>' }, { onToolbarConfigChange, ...props });
    await flush();
    fireEvent.click(screen.getByTitle('Customize toolbar'));
    return { ...r, onToolbarConfigChange };
}
const drawer = () => screen.getByText('Customize Layout').closest('.max-w-sm');

describe('ToolbarCustomizer', () => {
    it('remove, add, add divider, save: onToolbarConfigChange gets the edited list', async () => {
        const { onToolbarConfigChange } = await openCustomizer({ toolbarConfig: ['bold', 'italic'] });
        const d = within(drawer());
        fireEvent.click(d.getAllByTitle('Remove')[0]);
        fireEvent.click(d.getByText('Add divider'));
        fireEvent.click(d.getByText('Underline').closest('button'));
        fireEvent.click(d.getByText('Save layout'));
        expect(onToolbarConfigChange).toHaveBeenCalledWith(['italic', DIVIDER, 'underline']);
    });

    it('drag to reorder', async () => {
        const { onToolbarConfigChange } = await openCustomizer({ toolbarConfig: ['bold', 'italic', 'underline'] });
        const rows = [...drawer().querySelectorAll('[draggable="true"]')];
        const dt = { effectAllowed: '', dropEffect: '' };
        fireEvent.dragStart(rows[0], { dataTransfer: dt });
        fireEvent.dragOver(rows[2], { dataTransfer: dt });
        fireEvent.drop(rows[2], { dataTransfer: dt });
        fireEvent.click(within(drawer()).getByText('Save layout'));
        expect(onToolbarConfigChange).toHaveBeenCalledWith(['italic', 'underline', 'bold']);
    });

    it('presets: picking Blogger then saving saves the blogger preset; Cancel saves nothing', async () => {
        const { onToolbarConfigChange } = await openCustomizer();
        fireEvent.click(within(drawer()).getByText('Blogger'));
        fireEvent.click(within(drawer()).getByText('Save layout'));
        expect(onToolbarConfigChange).toHaveBeenCalledWith(TOOLBAR_PRESETS.blogger);
        await act(async () => { vi.advanceTimersByTime(400); });
        fireEvent.click(screen.getByTitle('Customize toolbar'));
        fireEvent.click(within(drawer()).getByText('Technical Writer'));
        fireEvent.click(within(drawer()).getByText('Cancel'));
        expect(onToolbarConfigChange).toHaveBeenCalledTimes(1);
    });

    it('Escape closes the drawer without saving', async () => {
        const { onToolbarConfigChange } = await openCustomizer();
        fireEvent.keyDown(window, { key: 'Escape' });
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.queryByText('Customize Layout')).toBeNull();
        expect(onToolbarConfigChange).not.toHaveBeenCalled();
    });

    it('with onBubbleMenuConfigChange and the default bubble menu, the Selection Menu tab is offered', async () => {
        await openCustomizer({ onBubbleMenuConfigChange: vi.fn() });
        expect(within(drawer()).queryByText('Selection Menu')).not.toBeNull();
    });

    it('the Selection Menu tab only offers bubble-allowed tools and saves through onBubbleMenuConfigChange', async () => {
        const onBubbleMenuConfigChange = vi.fn();
        await openCustomizer({ onBubbleMenuConfigChange, bubbleMenuConfig: ['bold'] });
        fireEvent.click(within(drawer()).getByText('Selection Menu'));
        const available = [...drawer().querySelectorAll('button span.flex-1')].map(s => s.textContent);
        expect(available).not.toContain('Heading 1');
        fireEvent.click(within(drawer()).getByText('Italic').closest('button'));
        fireEvent.click(within(drawer()).getByText('Save layout'));
        expect(onBubbleMenuConfigChange).toHaveBeenCalledWith(['bold', 'italic']);
    });

    it('custom presets merge, replace and are sanitized per surface', () => {
        render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={() => {}} toolbarPresets={{ mine: ['bold', 'nope', 'bold'] }} toolbarPresetLabels={{ mine: 'Mine' }} presetsMode="replace" />);
        expect(screen.queryByText('Blogger')).toBeNull();
        fireEvent.click(screen.getByText('Mine'));
        expect([...document.querySelectorAll('[draggable="true"]')].map(r => r.textContent)).toEqual(['Bold']);
    });

    it('the customizer follows the UI language like the toolbar does', async () => {
        i18next.addResourceBundle('de', 'inscript-editor', { bold: 'Fett', customizeToolbar: 'Werkzeugleiste anpassen' }, true, true);
        await act(async () => { await i18next.changeLanguage('de'); });
        const r = renderHost({ initialContent: '<p>x</p>' }, { onToolbarConfigChange: () => {}, toolbarConfig: ['bold'] });
        await flush();
        expect(screen.getByTitle('Fett')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Werkzeugleiste anpassen'));
        const rows = [...document.querySelectorAll('[draggable="true"]')].map(x => x.textContent);
        expect(rows).toEqual(['Fett']);
        r.unmount();
    });

    it('a toolbarConfig with duplicates/unknown ids renders without React key errors', async () => {
        const errors = [];
        vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));
        renderHost({ initialContent: '<p>x</p>' }, { toolbarConfig: ['bold', 'bold', 'nope', '|', '|', 'italic'] });
        await flush();
        expect(screen.getAllByTitle('Bold').length).toBe(1);
        expect(errors.filter(e => /same key|unique "key"/.test(e))).toEqual([]);
    });
});

describe('sanitizeToolConfig', () => {
    it.each([
        [null], [undefined], [42], ['bold'], [{ length: 2, 0: 'bold' }], [new Set(['bold'])],
    ])('non-array %j gives []', (input) => {
        expect(sanitizeToolConfig(input)).toEqual([]);
    });

    it('drops unknown, prototype keys, duplicates and surface-forbidden ids; keeps dividers', () => {
        expect(sanitizeToolConfig(['bold', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'bold', '|', 'h1', '|'], 'bubble')).toEqual(['bold', '|', '|']);
        expect(sanitizeToolConfig([null, undefined, 1, {}, ['bold'], 'BOLD', ' bold'])).toEqual([]);
    });

    it('random junk never throws and output is always a subset of the allowed ids (seeded)', () => {
        const rand = prng(42);
        const pool = [...ALL_TOOL_IDS, DIVIDER, 'x', '', 'constructor', '__proto__', null, 7, {}, 'valueOf'];
        for (let i = 0; i < 2000; i++) {
            const list = Array.from({ length: Math.floor(rand() * 12) }, () => pool[Math.floor(rand() * pool.length)]);
            const surface = rand() < 0.5 ? 'bubble' : 'toolbar';
            const out = sanitizeToolConfig(list, surface);
            const allowed = new Set(surface === 'bubble' ? BUBBLE_ALLOWED_TOOL_IDS : ALL_TOOL_IDS);
            for (const id of out) expect(id === DIVIDER || allowed.has(id)).toBe(true);
            const ids = out.filter(x => x !== DIVIDER);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    it('every built-in preset is already sanitized for its surface', () => {
        for (const v of Object.values(TOOLBAR_PRESETS)) expect(sanitizeToolConfig(v, 'toolbar')).toEqual(v);
        for (const v of Object.values(BUBBLE_PRESETS)) expect(sanitizeToolConfig(v, 'bubble')).toEqual(v);
    });
});

describe('overflow "More tools"', () => {
    it('tools that do not fit go to the More dropdown and still work there', async () => {
        restoreWidth();
        restoreWidth = stubClientWidth(300);
        const { api } = renderHost({ initialContent: '<p>hello</p>' });
        await flush();
        const editor = api.current.editor;
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        fireEvent.click(screen.getByTitle('More tools'));
        // Every full-preset tool is reachable in the toolbar or the dropdown.
        for (const title of ['Insert Table', 'Code Block', 'Quote', 'Bullet List']) expect(screen.getAllByTitle(title).length).toBeGreaterThan(0);
        await act(async () => { fireEvent.click(screen.getByTitle('Quote')); });
        expect(editor.getHTML()).toContain('<blockquote>');
    });
});
