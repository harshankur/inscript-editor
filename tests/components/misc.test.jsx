// Smaller checks: font sizes in other units (pasted from Google Docs / Word), toolbar label.
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, getSchema } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { buildExtensions } from '../../src/extensions/index.js';
import { FontSizeSelector } from '../../src/components/FontSizeSelector.jsx';

vi.mock('@tiptap/react/menus', () => ({ BubbleMenu: () => null, FloatingMenu: () => null }));
const editors = [];
afterEach(() => { while (editors.length) editors.pop().destroy(); document.body.innerHTML = ''; });
function mount(content) {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({ element, extensions: buildExtensions({}), content });
    editors.push(editor);
    return editor;
}
/** The style string the schema writes for the first text node's textStyle mark. */
function writtenStyle(editor) {
    const serializer = DOMSerializer.fromSchema(editor.schema);
    const p = serializer.serializeNode(editor.state.doc.firstChild);
    return p.querySelector('span')?.getAttribute('style') ?? '';
}

describe('font sizes in other units', () => {
    it.each([['11pt'], ['1.5em'], ['120%'], ['large']])('a pasted font-size: %s survives a save (getHTML)', (size) => {
        const editor = mount(`<p><span style="font-size: ${size}">x</span></p>`);
        // The renderer writes `font-size: ${size}px` (e.g. 11ptpx): invalid CSS, which jsdom drops
        // (style="") and a browser ignores, so the size is lost either way.
        expect(editor.getHTML()).toContain(`font-size: ${size}`);
        expect(writtenStyle(editor)).not.toMatch(/(pt|em|%|large)px/);
    });

    it('a pasted 11pt keeps its unit (the control shows it as it is, and it saves as it is)', () => {
        const editor = mount('<p><span style="font-size: 11pt">hello</span></p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        expect(editor.getAttributes('textStyle').fontSize).toBe('11pt');
        expect(editor.getHTML()).toContain('font-size: 11pt');
    });
});
