// Document attributes that are interpolated into a style or class string. A document must not
// be able to add CSS declarations or classes beyond the one the attribute is for. The probe is a
// harmless extra declaration (`outline-style: dotted`) or class (`probe-class`); if it shows up as
// a separate declaration or class, the document controls the element's styling (for example a
// background image from any host, or the stylesheet's own `fixed inset-0 z-50` utilities).
import { describe, it, expect, afterEach } from 'vitest';
import { createEditor } from './helpers/createEditor.js';

const EXTRA_DECL = '1px; outline-style: dotted';
let editor;
afterEach(() => { editor?.destroy(); editor = null; });

/** Parse getHTML() and return the first element matching the selector. */
function savedElement(selector) {
    const t = document.createElement('template');
    t.innerHTML = editor.getHTML();
    return t.content.querySelector(selector);
}

describe('attribute-to-style injection', () => {
    it('image data-width cannot add declarations to the saved style', () => {
        editor = createEditor({ content: `<img src="https://example.com/a.png" data-width="${EXTRA_DECL}">` });
        const img = savedElement('img');
        expect(img).toBeTruthy();
        expect(img.style.outlineStyle).toBe('');
    });

    it('image data-width cannot add declarations in the live editor DOM', () => {
        editor = createEditor({ content: `<img src="https://example.com/a.png" data-width="${EXTRA_DECL}">` });
        const img = editor.view.dom.querySelector('img');
        expect(img.style.outlineStyle).toBe('');
    });

    it('YouTube data-width cannot add declarations to the saved wrapper style', () => {
        editor = createEditor({ content: `<div data-youtube-video="dQw4w9WgXcQ" data-width="${EXTRA_DECL}"></div>` });
        const div = savedElement('div[data-youtube-video]');
        expect(div.style.outlineStyle).toBe('');
    });

    it('YouTube data-width cannot add declarations in the node view', () => {
        editor = createEditor({ content: `<div data-youtube-video="dQw4w9WgXcQ" data-width="${EXTRA_DECL}"></div>` });
        const fig = editor.view.dom.querySelector('figure.youtube-figure');
        expect(fig.style.outlineStyle).toBe('');
    });

    it('highlight data-color cannot add declarations (TipTap Highlight, multicolor on)', () => {
        editor = createEditor({ content: '<p><mark data-color="red; outline-style: dotted">x</mark></p>' });
        const mark = savedElement('mark');
        expect(mark).toBeTruthy();
        expect(mark.style.outlineStyle).toBe('');
        expect(editor.view.dom.querySelector('mark').style.outlineStyle).toBe('');
    });

    it('text color from a style attribute stays one declaration (control)', () => {
        editor = createEditor({ content: '<p><span style="color: red; outline-style: dotted">x</span></p>' });
        const span = savedElement('span');
        expect(span?.style.outlineStyle ?? '').toBe('');
    });

    it('font size from a style attribute stays one declaration (control)', () => {
        editor = createEditor({ content: '<p><span style="font-size: 20px; outline-style: dotted">x</span></p>' });
        expect(savedElement('span')?.style.outlineStyle ?? '').toBe('');
    });
});

describe('attribute-to-class injection', () => {
    it('admonition data-type cannot add classes to the saved element', () => {
        editor = createEditor({ content: '<div class="admonition" data-type="note probe-class"><p>x</p></div>' });
        const div = savedElement('div.admonition');
        expect(div).toBeTruthy();
        expect(div.classList.contains('probe-class')).toBe(false);
    });
});

describe('YouTube video id from the document', () => {
    const ID_SHAPE = /^https:\/\/www\.youtube\.com\/embed\/[A-Za-z0-9_-]{11}$/;

    it('a div[data-youtube-video] with a non-id value does not reach the iframe URL (saved HTML)', () => {
        editor = createEditor({ content: '<div data-youtube-video="dQw4w9WgXcQ/../../probe-path?probe=1"></div>' });
        const iframe = savedElement('iframe');
        if (iframe) expect(iframe.getAttribute('src')).toMatch(ID_SHAPE);
    });

    it('a div[data-youtube-video] with a non-id value does not reach the iframe URL (node view)', () => {
        editor = createEditor({ content: '<div data-youtube-video="dQw4w9WgXcQ/../../probe-path?probe=1"></div>' });
        const iframe = editor.view.dom.querySelector('iframe');
        if (iframe?.getAttribute('src')) expect(iframe.getAttribute('src')).toMatch(ID_SHAPE);
    });

    it('a non-id value cannot add declarations to the thumbnail facade style', () => {
        editor = createEditor(
            { content: '<div data-youtube-video="dQw4w9WgXcQ&quot;); outline-style: dotted; x: url(&quot;"></div>' },
            { youtube: { facade: 'thumbnail' } },
        );
        // Not a video ID, so no video (and no thumbnail request) at all.
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBeNull();
        expect(editor.view.dom.querySelector('[data-youtube-facade]')).toBeNull();
        expect(editor.view.dom.querySelector('[style*="outline-style"]')).toBeNull();
    });
});
