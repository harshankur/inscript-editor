// Values shared by more than one module. A value used by a single file stays a constant in
// that file; it moves here the moment a second file needs it, so the two can never drift.

/** Where a table sits on the page when it is narrower than the column. */
export const TABLE_ALIGN = Object.freeze({ LEFT: 'left', CENTER: 'center', RIGHT: 'right' });

/** The placement of a table nobody placed. It is the default, so it is never written to the HTML. */
export const DEFAULT_TABLE_ALIGN = TABLE_ALIGN.CENTER;

/** The attribute a table's (non-default) placement is saved in. */
export const TABLE_ALIGN_ATTRIBUTE = 'data-align';
