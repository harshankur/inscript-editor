// Maps the <InscriptEditor theme={...} /> object (and the legacy flat appearance
// props) to inline CSS custom properties on the .inscript-editor scope. Every key
// is optional; an omitted key leaves the token at its stylesheet default (which
// reproduces the built-in zinc/emerald look and still swaps for dark mode). A key
// the host DOES set applies in both light and dark - see src/styles/index.css.
//
// Keys are grouped for docs but flat in the object, e.g. theme={{ text: '#222',
// accent: '#7c3aed', surface: '#fff', radius: '0.75rem', fontFamily: 'Georgia' }}.

/** theme key -> CSS custom property name. */
export const THEME_VAR_MAP = {
    // Text
    text: '--inscript-color-text',
    heading: '--inscript-color-heading',
    muted: '--inscript-color-muted',
    // Surfaces & borders
    surface: '--inscript-color-surface',
    surfaceRaised: '--inscript-color-surface-raised',
    border: '--inscript-color-border',
    borderStrong: '--inscript-color-border-strong',
    hover: '--inscript-color-hover',
    active: '--inscript-color-active',
    // Accent & links
    accent: '--inscript-color-accent',
    onAccent: '--inscript-color-on-accent',
    link: '--inscript-color-link',
    linkHover: '--inscript-color-link-hover',
    // Code
    codeBg: '--inscript-color-code-bg',
    codeText: '--inscript-color-code-text',
    codeBorder: '--inscript-color-code-border',
    // Quotes
    quoteBorder: '--inscript-color-quote-border',
    quoteText: '--inscript-color-quote-text',
    // Tables
    tableBorder: '--inscript-color-table-border',
    tableHeaderBg: '--inscript-color-table-header-bg',
    // Marks & selection
    markBg: '--inscript-color-mark-bg',
    markText: '--inscript-color-mark-text',
    selection: '--inscript-color-selection',
    // Typography
    fontFamily: '--inscript-font-family',
    fontSize: '--inscript-font-size',
    lineHeight: '--inscript-line-height',
    headingFont: '--inscript-heading-font',
    monoFont: '--inscript-mono-font',
    headingWeight: '--inscript-heading-weight',
    h1Size: '--inscript-h1-size',
    h2Size: '--inscript-h2-size',
    h3Size: '--inscript-h3-size',
    // Layout, shape & spacing
    maxWidth: '--inscript-max-width',
    blockGap: '--inscript-block-gap',
    radius: '--inscript-radius',
    radiusSm: '--inscript-radius-sm',
    minHeight: '--inscript-min-height',
    focusDimOpacity: '--inscript-focus-dim-opacity',
};

/**
 * Build the inline style object of --inscript-* custom properties from a theme
 * object plus the legacy flat props. The theme object wins over a legacy prop for
 * the same token; legacy props remain supported so nothing breaks.
 *
 * `maxWidth` is deliberately excluded here - it is resolved separately by the
 * editor because focus mode overrides it with focusMaxWidth.
 *
 * @param {object} [theme]  The theme object.
 * @param {object} [legacy] Legacy flat props: { fontFamily, fontSize, lineHeight, headingFontFamily }.
 * @returns {Record<string, string>} Inline style object (only set keys included).
 */
export function buildThemeVars(theme = {}, legacy = {}) {
    const t = theme || {};
    const { fontFamily, fontSize, lineHeight, headingFontFamily } = legacy || {};

    // Merge legacy flat props as fallbacks (theme wins). headingFontFamily maps to
    // the theme's `headingFont` key.
    const resolved = {
        fontFamily: t.fontFamily ?? fontFamily,
        fontSize: t.fontSize ?? fontSize,
        lineHeight: t.lineHeight ?? lineHeight,
        headingFont: t.headingFont ?? headingFontFamily,
        ...t,
    };

    const style = {};
    for (const [key, cssVar] of Object.entries(THEME_VAR_MAP)) {
        if (key === 'maxWidth') continue; // resolved separately (focus-mode aware)
        const value = resolved[key];
        if (value !== undefined && value !== null && value !== '') {
            style[cssVar] = value;
        }
    }
    return style;
}
