// Values shared by more than one module. A value used by a single file stays a constant in
// that file; it moves here the moment a second file needs it, so the two can never drift.

/** Where a table sits on the page when it is narrower than the column. */
export const TABLE_ALIGN = Object.freeze({ LEFT: 'left', CENTER: 'center', RIGHT: 'right' });

/** The placement of a table nobody placed. It is the default, so it is never written to the HTML. */
export const DEFAULT_TABLE_ALIGN = TABLE_ALIGN.CENTER;

/** The attribute a table's (non-default) placement is saved in. */
export const TABLE_ALIGN_ATTRIBUTE = 'data-align';

/** The highlight picker's colours. The picker's first swatch is the default highlight, which has none. */
export const HIGHLIGHT_PRESETS = Object.freeze(['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa', '#fecaca']);

/** The text colour picker's colours. */
export const TEXT_COLOR_PRESETS = Object.freeze(['#000000', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#71717a']);

/** How the default (colourless) highlight is drawn: the mark token, so it follows the theme. */
export const DEFAULT_HIGHLIGHT_CSS = 'var(--inscript-color-mark-bg, rgb(234 179 8 / 0.2))';

/** The mark a highlight is stored as. */
export const HIGHLIGHT_MARK = 'highlight';
