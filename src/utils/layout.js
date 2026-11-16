import { htmlInteger } from './dom.js';
// Width and alignment values a document gives an image or a video. They end up inside a `style`
// attribute, so only a plain CSS length and a known alignment are taken: anything else (`1px;
// position: fixed`, a `url(...)`) falls back to the default instead of adding declarations.

/** The alignments a block can have. */
export const LAYOUT_ALIGNMENTS = Object.freeze(['left', 'center', 'right']);
export const DEFAULT_LAYOUT_ALIGN = 'center';
export const DEFAULT_LAYOUT_WIDTH = '100%';
const CSS_LENGTH = /^(\d+(?:\.\d+)?)(%|px|em|rem|vw|ch)?$/;

/**
 * The largest length of each unit a document may give: a block wider than its page, at most (a
 * width of `100000vw` would lay it over everything around the editor).
 */
const MAX_LENGTH = Object.freeze({ '%': 100, px: 4000, em: 250, rem: 250, vw: 100, ch: 500 });
/** The largest height in pixels a document may give an image. */
export const MAX_IMAGE_HEIGHT_PX = 10000;

/** `value` as a CSS length (a bare number is pixels), at most MAX_LENGTH, or `fallback` when it is not one. */
export function cssLength(value, fallback = DEFAULT_LAYOUT_WIDTH) {
    if (typeof value !== 'string' && typeof value !== 'number') return fallback;
    const match = CSS_LENGTH.exec(String(value).trim());
    if (!match) return fallback;
    const unit = match[2] || 'px';
    // The digits as written (a number turned back to text may come out as `5e-7`, which is no length).
    return `${Number(match[1]) > MAX_LENGTH[unit] ? MAX_LENGTH[unit] : match[1]}${unit}`;
}

/** The largest percentage height a document may give an image. */
const MAX_IMAGE_HEIGHT_PERCENT = 100;

/**
 * `value` as an image's height attribute (as a browser reads one): whole pixels, at most
 * MAX_IMAGE_HEIGHT_PX, or a percentage (`50%`), at most MAX_IMAGE_HEIGHT_PERCENT; null for anything else.
 * @returns {number | string | null}
 */
export function imageHeight(value) {
    const read = htmlInteger(value);
    if (!read || !(read.value > 0)) return null;
    return read.percent ? `${Math.min(read.value, MAX_IMAGE_HEIGHT_PERCENT)}%` : Math.min(read.value, MAX_IMAGE_HEIGHT_PX);
}

/** `value` as one of LAYOUT_ALIGNMENTS, or the default. */
export function layoutAlign(value) {
    const align = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return LAYOUT_ALIGNMENTS.includes(align) ? align : DEFAULT_LAYOUT_ALIGN;
}
