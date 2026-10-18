import { Extension } from '@tiptap/core';

// A font size is stored as the toolbar sets it: a bare number of pixels ('16'). One pasted from
// elsewhere keeps its own unit ('11pt' from Google Docs, '1.5em', '120%') or keyword ('large');
// it used to become '11ptpx', which no browser reads, so the size was lost on save.
const FONT_SIZE = /^(\d+(?:\.\d+)?)(px|pt|em|rem|%|vw|vh|ch|ex)?$/i;
const FONT_SIZE_KEYWORDS = ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large', 'smaller', 'larger'];

/** The stored form of a CSS font size, or null for anything that is not one. */
export function normalizeFontSize(value) {
    const size = String(value ?? '').trim().toLowerCase();
    if (!size) return null;
    if (FONT_SIZE_KEYWORDS.includes(size)) return size;
    const match = FONT_SIZE.exec(size);
    if (!match) return null;
    return !match[2] || match[2] === 'px' ? match[1] : `${match[1]}${match[2]}`;
}

/** The CSS value for a stored font size (a bare number is pixels), or null. */
export function cssFontSize(value) {
    const size = normalizeFontSize(value);
    if (!size) return null;
    return /^\d/.test(size) && !/[a-z%]$/.test(size) ? `${size}px` : size;
}

export const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => normalizeFontSize(element.style.fontSize),
                        renderHTML: attributes => {
                            const size = cssFontSize(attributes.fontSize);
                            return size ? { style: `font-size: ${size}` } : {};
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: fontSize => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize })
                    .run();
            },
            unsetFontSize: () => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run();
            },
        };
    },
});
