// Hostile configuration: theme values, toolbar configs, and i18n overrides rendered by <Trans>.
// Values are inert probes.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import i18next from 'i18next';
import { buildThemeVars } from '../src/utils/theme.js';
import { sanitizeToolConfig } from '../src/toolbar/toolRegistry.js';
import { YoutubeEmbedModal } from '../src/components/YoutubeEmbedModal.jsx';

afterEach(() => cleanup());

describe('theme values', () => {
    it('only --inscript-* custom properties come out, whatever keys the theme has', () => {
        const theme = JSON.parse('{"__proto__": {"x": 1}, "constructor": "a", "accent": "red", "color": "blue", "position": "fixed"}');
        const vars = buildThemeVars(theme, { fontFamily: 'serif' });
        expect(Object.keys(vars).every(k => k.startsWith('--inscript-'))).toBe(true);
        expect({}.x).toBeUndefined();
    });

    it('a value cannot add a declaration to the editor root style', () => {
        const vars = buildThemeVars({ accent: 'red; outline-style: dotted', fontFamily: 'a"; outline-style: dotted; x:"' });
        const { container } = render(<div data-testid="root" style={{ display: 'contents', ...vars }} />);
        expect(container.firstChild.style.outlineStyle).toBe('');
    });
});

describe('toolbar configs', () => {
    it('prototype keys, non-strings and duplicates are dropped', () => {
        const out = sanitizeToolConfig(['__proto__', 'constructor', 'toString', 'hasOwnProperty', {}, null, 1, 'bold', 'bold', '|']);
        expect(out.every(id => typeof id === 'string')).toBe(true);
        expect(out).not.toContain('__proto__');
        expect(out).not.toContain('constructor');
        expect(out.filter(id => id === 'bold').length).toBeLessThanOrEqual(1);
    });
    it('a non-array is an empty config', () => {
        expect(sanitizeToolConfig({ length: 2, 0: 'bold', 1: 'italic' })).toEqual([]);
    });
});

describe('i18n override containing HTML, rendered by <Trans>', () => {
    const key = 'experimentalFeatureDescription';
    function renderWith(translation) {
        const original = i18next.t(key, { ns: 'inscript-editor' });
        i18next.addResource('en', 'inscript-editor', key, translation);
        try {
            const { container } = render(<YoutubeEmbedModal isOpen onSearch={async () => []} onClose={() => {}} onConfirm={() => {}} />);
            fireEvent.click(screen.getByText('Search YouTube (Experimental)'));
            return container.ownerDocument;
        } finally {
            i18next.addResource('en', 'inscript-editor', key, original);
        }
    }

    it('handlers, script URLs and unknown tags in a translation never reach the DOM', () => {
        const doc = renderWith('A <b data-probe="1">b</b> <img src="x.png" onerror="void 0"> <1 onclick="void 0" href="javascript:void(0)">one</1>');
        expect(doc.body.textContent).toContain('one');
        expect(doc.querySelector('[data-probe="1"], img[onerror], [onclick]')).toBeNull();
        // React 19 replaces a javascript: URL with its own throwing one, which is inert.
        const live = Array.from(doc.querySelectorAll('[href^="javascript"]')).filter(el => !el.getAttribute('href').includes('React has blocked'));
        expect(live).toEqual([]);
    });

    it('attributes on an indexed tag are not copied onto the component (react-i18next merges them)', () => {
        const doc = renderWith('A <1 data-probe="2" class="probe-class" id="probe-id">one</1>');
        expect(doc.querySelector('[data-probe], .probe-class, #probe-id')).toBeNull();
    });

    it('a string style attribute in a translation does not crash the modal', () => {
        expect(() => renderWith('A <1 style="color: red">one</1>')).not.toThrow();
    });
});
