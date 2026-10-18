// Width and alignment values a document gives an image or a video. They end up inside a `style`
// attribute, so only a plain CSS length and a known alignment are taken: anything else (`1px;
// position: fixed`, a `url(...)`) falls back to the default instead of adding declarations.

/** The alignments a block can have. */
export const LAYOUT_ALIGNMENTS = Object.freeze(['left', 'center', 'right']);
export const DEFAULT_LAYOUT_ALIGN = 'center';
export const DEFAULT_LAYOUT_WIDTH = '100%';
const CSS_LENGTH = /^(\d+(?:\.\d+)?)(%|px|em|rem|vw|ch)?$/;

/** `value` as a CSS length (a bare number is pixels), or `fallback` when it is not one. */
export function cssLength(value, fallback = DEFAULT_LAYOUT_WIDTH) {
    if (typeof value !== 'string' && typeof value !== 'number') return fallback;
    const match = CSS_LENGTH.exec(String(value).trim());
    if (!match) return fallback;
    return `${match[1]}${match[2] || 'px'}`;
}

/** `value` as one of LAYOUT_ALIGNMENTS, or the default. */
export function layoutAlign(value) {
    const align = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return LAYOUT_ALIGNMENTS.includes(align) ? align : DEFAULT_LAYOUT_ALIGN;
}
