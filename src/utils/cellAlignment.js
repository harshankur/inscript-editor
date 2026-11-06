import { COLUMN_ALIGN, COLUMN_ALIGNMENTS } from '../constants.js';

const START = 'start';

/**
 * How text in a table cell is aligned as a reader sees it, from the cell's own alignment and its
 * paragraph's: the paragraph's wins (it is the one drawn). `start` reads as `left`. Null for none.
 * @param {string|null|undefined} cellAlign
 * @param {string|null|undefined} paragraphAlign
 * @returns {string|null}
 */
export function readingAlign(cellAlign, paragraphAlign) {
    const align = paragraphAlign ?? cellAlign ?? null;
    return align === START ? COLUMN_ALIGN.LEFT : align;
}

/**
 * A table column's alignment, from how each of its cells reads (readingAlign; `undefined` for a
 * cell whose paragraphs differ). Shared by the table menu, new rows and the Markdown writer, so the
 * column the menu shows as aligned is the column written as aligned.
 * - Centre or right: every cell reads it (an unaligned cell reads left, so it breaks the column).
 * - Left or none: body cells reading left or none look the same, so the header decides: a header
 *   read left makes it left, an unaligned header none (renderers centre a header by default, so the
 *   two differ there). With no header, none: nobody aligned the column.
 * - Anything else (the cells differ, a justified cell): undefined, no column alignment.
 * @param {Array<{ align: string|null|undefined, isHeader: boolean }>} cells
 * @returns {'left'|'center'|'right'|null|undefined}
 */
export function columnAlignOf(cells) {
    if (cells.length === 0) return undefined;
    const aligns = new Set(cells.map(cell => cell.align));
    if (aligns.size === 1) {
        const [align] = aligns;
        return align === null || COLUMN_ALIGNMENTS.includes(align) ? align : undefined;
    }
    const looksLeft = align => align === null || align === COLUMN_ALIGN.LEFT;
    if (!cells.filter(cell => !cell.isHeader).every(cell => looksLeft(cell.align))) return undefined;
    const headers = new Set(cells.filter(cell => cell.isHeader).map(cell => cell.align));
    if (headers.size === 0) return null;
    if (headers.size > 1) return undefined;
    const [header] = headers;
    return looksLeft(header) ? header : undefined;
}
