import { describe, expect, it } from 'vitest';
import { buildThemeVars, THEME_VAR_MAP } from './theme.js';

describe('buildThemeVars', () => {
    it('maps theme keys to their --inscript-* custom properties', () => {
        const style = buildThemeVars({
            text: '#222',
            accent: '#7c3aed',
            surface: '#fff',
            radius: '0.75rem',
            blockGap: '1.5rem',
            fontFamily: 'Georgia, serif',
        });
        expect(style['--inscript-color-text']).toBe('#222');
        expect(style['--inscript-color-accent']).toBe('#7c3aed');
        expect(style['--inscript-color-surface']).toBe('#fff');
        expect(style['--inscript-radius']).toBe('0.75rem');
        expect(style['--inscript-block-gap']).toBe('1.5rem');
        expect(style['--inscript-font-family']).toBe('Georgia, serif');
    });

    it('omits keys that are undefined, null or empty string', () => {
        const style = buildThemeVars({ text: '#222', accent: '', surface: undefined, muted: null });
        expect(style['--inscript-color-text']).toBe('#222');
        expect('--inscript-color-accent' in style).toBe(false);
        expect('--inscript-color-surface' in style).toBe(false);
        expect('--inscript-color-muted' in style).toBe(false);
    });

    it('never emits max-width (resolved separately for focus mode)', () => {
        const style = buildThemeVars({ maxWidth: '60ch' });
        expect('--inscript-max-width' in style).toBe(false);
    });

    it('uses legacy flat props as fallbacks for the typography tokens', () => {
        const style = buildThemeVars({}, {
            fontFamily: 'Inter',
            fontSize: '1rem',
            lineHeight: '1.8',
            headingFontFamily: 'Playfair Display',
        });
        expect(style['--inscript-font-family']).toBe('Inter');
        expect(style['--inscript-font-size']).toBe('1rem');
        expect(style['--inscript-line-height']).toBe('1.8');
        expect(style['--inscript-heading-font']).toBe('Playfair Display');
    });

    it('lets the theme object win over a legacy flat prop for the same token', () => {
        const style = buildThemeVars(
            { fontFamily: 'Georgia', headingFont: 'Merriweather' },
            { fontFamily: 'Inter', headingFontFamily: 'Playfair Display' },
        );
        expect(style['--inscript-font-family']).toBe('Georgia');
        expect(style['--inscript-heading-font']).toBe('Merriweather');
    });

    it('ignores unknown keys and returns an empty object for no input', () => {
        expect(buildThemeVars({ nope: 'x', alsoNope: 1 })).toEqual({});
        expect(buildThemeVars()).toEqual({});
        expect(buildThemeVars(undefined, undefined)).toEqual({});
    });

    it('accepts numeric values for numeric-friendly tokens', () => {
        const style = buildThemeVars({ headingWeight: 600, focusDimOpacity: 0.5 });
        expect(style['--inscript-heading-weight']).toBe(600);
        expect(style['--inscript-focus-dim-opacity']).toBe(0.5);
    });

    it('THEME_VAR_MAP keys all map to --inscript- prefixed vars', () => {
        for (const cssVar of Object.values(THEME_VAR_MAP)) {
            expect(cssVar.startsWith('--inscript-')).toBe(true);
        }
    });
});
