// inertPreviewHtml (src/utils/previewHtml.js) output is set as innerHTML by HistoryView. Its
// stated contract: nothing in a preview loads third-party content or runs anything. Every value
// used here is inert (`javascript:void(0)`, `onclick="void 0"`); a test fails when such a value
// survives in a place a browser would act on it.
import { describe, it, expect } from 'vitest';
import { inertPreviewHtml } from './previewHtml.js';

/** How a browser's URL parser reads the start of an attribute URL: leading C0 controls and
 *  spaces are stripped, and ASCII tab/LF/CR anywhere are removed. */
const browserUrl = v => v.replace(/^[\u0000- ]+/, '').replace(/[\t\n\r]/g, '');
const SCRIPT_SCHEME = /^(javascript|vbscript):/i;
/** Attributes a browser treats as a navigable or fetchable URL, plus SVG animation values that
 *  can set one (`<animate attributeName="href" values=…>`, `<set to=…>`). */
const URLISH = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'poster', 'to', 'values', 'from', 'by']);
const FORBIDDEN_TAGS = new Set(['script', 'iframe', 'frame', 'frameset', 'embed', 'object', 'portal', 'meta', 'base', 'link', 'form', 'noscript', 'template', 'style']);

/** Problems in the sanitized output, judged after re-parsing it the way React's innerHTML does. */
function problems(output) {
    const host = document.createElement('div');
    host.innerHTML = output; // React: dangerouslySetInnerHTML on a <div>
    const found = [];
    for (const el of host.querySelectorAll('*')) {
        const tag = el.localName.toLowerCase();
        if (FORBIDDEN_TAGS.has(tag)) found.push(`<${tag}> element`);
        for (const { name, value } of Array.from(el.attributes)) {
            const lower = name.toLowerCase();
            if (lower.startsWith('on')) found.push(`${tag}[${name}]`);
            if (URLISH.has(lower) && value.split(';').some(part => SCRIPT_SCHEME.test(browserUrl(part)))) {
                found.push(`${tag}[${name}=${JSON.stringify(value)}]`);
            }
        }
    }
    return found;
}

const sanitize = html => inertPreviewHtml(html, host => `embed:${host}`);

describe('inertPreviewHtml: script URLs a browser would still follow', () => {
    const cases = {
        'tab inside the scheme': '<a href="java&#x09;script:void(0)">x</a>',
        'newline inside the scheme': '<a href="java&#x0A;script:void(0)">x</a>',
        'leading C0 control': '<a href="&#x01;javascript:void(0)">x</a>',
        'svg animate sets href': '<svg><a><animate attributeName="href" values="javascript:void(0)"></animate><text y="10">x</text></a></svg>',
        'svg set sets href': '<svg><a><set attributeName="href" to="javascript:void(0)"></set><text y="10">x</text></a></svg>',
        'plain javascript: (control)': '<a href="javascript:void(0)">x</a>',
        'uppercase and spaces (control)': '<a href="  JaVaScRiPt:void(0)">x</a>',
        'svg xlink:href (control)': '<svg><a xlink:href="javascript:void(0)"><text>x</text></a></svg>',
        'button formaction (control)': '<button formaction="javascript:void(0)">x</button>',
    };
    for (const [name, html] of Object.entries(cases)) {
        it(name, () => {
            expect(problems(sanitize(html))).toEqual([]);
        });
    }
});

describe('inertPreviewHtml: elements and handlers (controls)', () => {
    const cases = {
        'iframe srcdoc': '<iframe srcdoc="&lt;b&gt;x&lt;/b&gt;"></iframe>',
        'object data': '<object data="https://example.com/x"></object>',
        'embed src': '<embed src="https://example.com/x">',
        'meta refresh': '<meta http-equiv="refresh" content="0;url=https://example.com">',
        'base href': '<base href="https://example.com/">',
        'link stylesheet': '<link rel="stylesheet" href="https://example.com/x.css">',
        'form action': '<form action="https://example.com"><input name="a"></form>',
        'uppercase handler': '<p ONCLICK="void 0">x</p>',
        'svg handler': '<svg onload="void 0"><rect onclick="void 0"/></svg>',
        'math handler': '<math><mi onclick="void 0">x</mi></math>',
        'noscript content': '<noscript><p onclick="void 0">x</p></noscript>',
        'template content': '<template><p onclick="void 0">x</p></template>',
        'svg style with markup': '<svg><style><p onclick="void 0">x</p></style></svg>',
    };
    for (const [name, html] of Object.entries(cases)) {
        it(name, () => {
            expect(problems(sanitize(html))).toEqual([]);
        });
    }
});

describe('inertPreviewHtml: requests to other hosts (the "never loads third-party content" claim)', () => {
    const fetchesFrom = output => {
        const host = document.createElement('div');
        host.innerHTML = output;
        const urls = [];
        for (const el of host.querySelectorAll('*')) {
            const style = el.getAttribute('style') || '';
            for (const m of style.matchAll(/url\(\s*["']?([^"')]+)/gi)) urls.push(m[1]);
            for (const a of ['src', 'srcset', 'href', 'xlink:href', 'poster', 'background']) {
                const v = el.getAttribute(a);
                if (v && el.localName !== 'a' && /^https?:/i.test(v.trim())) urls.push(v);
            }
        }
        return urls.filter(u => /example\.invalid/.test(u));
    };
    it('an inline style background is not fetched', () => {
        expect(fetchesFrom(sanitize('<p style="background-image: url(https://example.invalid/bg.png)">x</p>'))).toEqual([]);
    });
    it('an svg image is not fetched', () => {
        expect(fetchesFrom(sanitize('<svg><image href="https://example.invalid/i.png"></image></svg>'))).toEqual([]);
    });
    it('an input type=image is not fetched', () => {
        expect(fetchesFrom(sanitize('<input type="image" src="https://example.invalid/i.png">'))).toEqual([]);
    });
    it('a table background attribute is not fetched', () => {
        expect(fetchesFrom(sanitize('<table background="https://example.invalid/t.png"><tr><td>x</td></tr></table>'))).toEqual([]);
    });
});

// --- Seeded fuzz: nest a probe element in random wrappers (namespace and parsing-mode changes)
// and check the re-parsed output. The probe carries an inert handler; it must not survive as an
// attribute after the output is parsed again.
function mulberry32(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const WRAPPERS = ['svg', 'math', 'mtext', 'mglyph', 'malignmark', 'foreignObject', 'desc', 'title', 'table', 'tr', 'td',
    'select', 'option', 'p', 'a', 'form', 'template', 'noscript', 'style', 'textarea', 'xmp', 'noembed', 'noframes',
    'iframe', 'annotation-xml encoding="text/html"', 'li', 'dl', 'colgroup', 'caption', 'object'];
const PROBE = '<img data-probe src="x.png" onclick="void 0">';

describe('inertPreviewHtml: seeded wrapper fuzz', () => {
    it('no handler survives a parse, sanitize, re-parse cycle (seed 1337, 4000 cases)', () => {
        const rand = mulberry32(1337);
        const failures = [];
        for (let i = 0; i < 4000 && failures.length < 5; i++) {
            const depth = 1 + Math.floor(rand() * 5);
            const open = [];
            const close = [];
            for (let d = 0; d < depth; d++) {
                const w = WRAPPERS[Math.floor(rand() * WRAPPERS.length)];
                open.push(`<${w}>`);
                const tag = w.split(' ')[0];
                // Sometimes leave a wrapper unclosed or close it early, as parser-confusion inputs do.
                if (rand() < 0.7) close.unshift(`</${tag}>`);
                else if (rand() < 0.5) open.push(`</${tag}>`);
            }
            const html = open.join('') + PROBE + close.join('');
            const out = sanitize(html);
            const p = problems(out);
            if (p.length) failures.push({ html, out, p });
        }
        expect(failures).toEqual([]);
    });
});
